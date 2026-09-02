#!/usr/bin/env node

/**
 * Verifica que a chave anonima do Supabase nao alcanca nenhuma das quatro
 * tabelas do CMS.
 *
 * Rastreavel a: PLAN.md § T3 (criterio de "pronto") e SDD § "Modelo de dados".
 *
 * Requisito verificado: "uma requisicao com a chave anonima a cada uma das
 * quatro tabelas retorna erro de permissao ou conjunto vazio, nunca dados".
 *
 * Sobre o "conjunto vazio": uma resposta vazia so prova alguma coisa se a
 * tabela tiver linhas para esconder. Em uma tabela vazia, `[]` e o resultado
 * correto tanto com RLS quanto sem, e aceitar isso como aprovacao seria
 * verificacao de fachada. Por isso o script cruza cada resposta anonima com a
 * contagem real de linhas, obtida com a chave secreta, quando ela e fornecida.
 *
 * Uso:
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... node supabase/scripts/verify-rls.mjs
 *
 * Opcional, e recomendado — torna a verificacao conclusiva:
 *   SUPABASE_SECRET_KEY=...
 *
 * Codigos de saida:
 *   0  todas as tabelas negaram o acesso anonimo
 *   1  ao menos uma tabela devolveu dados a chave anonima
 *   2  nenhuma exposicao encontrada, mas ao menos uma tabela ficou inconclusiva
 */

const TABLES = ['content_sections', 'site_metadata', 'media_assets', 'leads'];

const VERDICT = {
  denied: 'NEGADO',
  exposed: 'EXPOSTO',
  inconclusive: 'INCONCLUSIVO',
};

const EXIT_CODE = {
  allDenied: 0,
  someExposed: 1,
  someInconclusive: 2,
};

/** Le a configuracao do ambiente. Lanca com instrucao acionavel se faltar algo. */
function readConfig(env) {
  const baseUrl = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL;
  const anonKey = env.SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY;
  const secretKey = env.SUPABASE_SECRET_KEY ?? null;

  const missing = [];
  if (!baseUrl) missing.push('SUPABASE_URL');
  if (!anonKey) missing.push('SUPABASE_ANON_KEY');

  if (missing.length > 0) {
    throw new Error(
      `Variaveis de ambiente ausentes: ${missing.join(', ')}.\n` +
        'Pegue os valores em Project Settings > API do projeto Supabase.\n' +
        'Defina tambem SUPABASE_SECRET_KEY para que a verificacao seja conclusiva.',
    );
  }

  return { baseUrl: baseUrl.replace(/\/+$/, ''), anonKey, secretKey };
}

/** Tenta ler uma tabela pela Data API com a chave anonima. */
async function probeWithAnonKey({ baseUrl, anonKey }, table) {
  const response = await fetch(
    `${baseUrl}/rest/v1/${table}?select=*&limit=1`,
    { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } },
  );

  const body = await response.text();
  return { status: response.status, body, rows: parseRows(body) };
}

/** Conta as linhas reais da tabela com a chave secreta, que ignora RLS. */
async function countWithSecretKey({ baseUrl, secretKey }, table) {
  const response = await fetch(
    `${baseUrl}/rest/v1/${table}?select=*&limit=0`,
    {
      headers: {
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
        Prefer: 'count=exact',
      },
    },
  );

  if (!response.ok) return null;

  // PostgREST devolve a contagem no cabecalho Content-Range, no formato "*/12".
  const total = response.headers.get('content-range')?.split('/')[1];
  return total === undefined || total === '*' ? null : Number(total);
}

/** Extrai o array de linhas de uma resposta; devolve null se nao for um array. */
function parseRows(body) {
  try {
    const parsed = JSON.parse(body);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Decide o veredito de uma tabela.
 *
 * @param {{status: number, rows: unknown[] | null, body: string}} probe
 * @param {number | null} rowCount linhas reais na tabela, ou null se desconhecido
 */
function classify(probe, rowCount) {
  if (probe.status === 401 || probe.status === 403) {
    return { verdict: VERDICT.denied, detail: `HTTP ${probe.status} — acesso recusado.` };
  }

  if (probe.status === 404) {
    return {
      verdict: VERDICT.inconclusive,
      detail: 'HTTP 404 — tabela ausente ou nao exposta. Aplique as migracoes antes de verificar.',
    };
  }

  if (!probe.rows) {
    return {
      verdict: VERDICT.inconclusive,
      detail: `HTTP ${probe.status} — resposta inesperada: ${truncate(probe.body, 120)}`,
    };
  }

  if (probe.rows.length > 0) {
    return {
      verdict: VERDICT.exposed,
      detail: `HTTP ${probe.status} — a chave anonima leu ${probe.rows.length} linha(s).`,
    };
  }

  if (rowCount === null) {
    return {
      verdict: VERDICT.inconclusive,
      detail:
        'HTTP 200 com conjunto vazio, mas nao foi possivel saber se a tabela tem linhas. ' +
        'Defina SUPABASE_SECRET_KEY para tornar este resultado conclusivo.',
    };
  }

  if (rowCount === 0) {
    return {
      verdict: VERDICT.inconclusive,
      detail:
        'HTTP 200 com conjunto vazio, mas a tabela esta vazia — nada havia para esconder. ' +
        'Insira ao menos uma linha e verifique de novo.',
    };
  }

  return {
    verdict: VERDICT.denied,
    detail: `HTTP 200 com conjunto vazio, com ${rowCount} linha(s) na tabela — RLS escondeu todas.`,
  };
}

function truncate(text, limit) {
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

/** Executa a verificacao de uma tabela, do sondar ao classificar. */
async function verifyTable(config, table) {
  const probe = await probeWithAnonKey(config, table);
  const rowCount = config.secretKey ? await countWithSecretKey(config, table) : null;
  return { table, ...classify(probe, rowCount) };
}

function render(results) {
  const width = Math.max(...results.map((result) => result.table.length));

  console.log('Isolamento do banco — leitura com a chave anonima\n');
  for (const { table, verdict, detail } of results) {
    console.log(`  ${verdict.padEnd(13)} ${table.padEnd(width)}  ${detail}`);
  }
  console.log('');
}

function summarize(results) {
  if (results.some((result) => result.verdict === VERDICT.exposed)) {
    return {
      code: EXIT_CODE.someExposed,
      message: 'FALHOU: ao menos uma tabela devolveu dados a chave anonima.',
    };
  }

  if (results.some((result) => result.verdict === VERDICT.inconclusive)) {
    return {
      code: EXIT_CODE.someInconclusive,
      message: 'INCONCLUSIVO: nenhuma exposicao encontrada, mas ha tabelas sem prova. Veja acima.',
    };
  }

  return {
    code: EXIT_CODE.allDenied,
    message: 'OK: as quatro tabelas negaram o acesso com a chave anonima.',
  };
}

async function main() {
  const config = readConfig(process.env);
  const results = [];

  for (const table of TABLES) {
    results.push(await verifyTable(config, table));
  }

  render(results);

  const { code, message } = summarize(results);
  console.log(message);
  process.exit(code);
}

main().catch((error) => {
  console.error(`Erro: ${error.message}`);
  process.exit(1);
});
