#!/usr/bin/env node

/**
 * Prova, contra um projeto Supabase real, que a superficie publica do banco e
 * do armazenamento esta isolada como o SDD exige.
 *
 * Rastreavel a: PLAN.md § T3 (criterio de "pronto"), SDD § "Modelo de dados"
 * (Row Level Security), § D-05 e § R-09.
 *
 * Sao tres perguntas independentes, nesta ordem:
 *
 *   1. A chave publicavel alcanca a Data API?
 *      Este projeto Supabase esta configurado para recusa-la no proprio portao,
 *      antes de qualquer tabela ser consultada (ver CHANGELOG de 2026-09-02).
 *      Essa recusa REFORCA, mas nao substitui, a negacao por tabela — e por
 *      isso ela e reportada como camada informativa e nao decide o exit code.
 *      Um projeto que aceita a chave publicavel no portao nao esta errado; ele
 *      apenas depende inteiramente da barreira (2), que continua obrigatoria.
 *
 *   2. Cada uma das quatro tabelas nega a leitura com a chave publicavel?
 *      Esta e a exigencia dura do PLAN.md. Falhar aqui reprova a execucao.
 *
 *   3. Os dois buckets existem com a politica pretendida — leitura publica dos
 *      arquivos, escrita apenas com a credencial de servidor?
 *      Verificado pelo comportamento, nao pela configuracao declarada: o script
 *      envia um arquivo de sonda com a chave secreta, le esse arquivo SEM
 *      nenhuma credencial, tenta enviar outro com a chave publicavel (que
 *      precisa ser recusado) e apaga a sonda ao final, inclusive em caso de
 *      erro.
 *
 * Sobre "conjunto vazio": uma resposta vazia so prova alguma coisa se a tabela
 * tiver linhas para esconder. Em uma tabela vazia, `[]` e o resultado correto
 * com ou sem RLS, e aceitar isso como aprovacao seria verificacao de fachada.
 * Por isso o script cruza toda resposta vazia com a contagem real de linhas,
 * obtida com a chave secreta. O caso comum, porem, nem chega la: com os GRANTs
 * revogados a Data API responde erro de permissao, que e conclusivo mesmo com
 * a tabela vazia.
 *
 * Uso:
 *   SUPABASE_URL=... \
 *   SUPABASE_PUBLISHABLE_KEY=... \
 *   SUPABASE_SECRET_KEY=... \
 *     node supabase/scripts/verify-isolation.mjs
 *
 * Codigos de saida:
 *   0  tudo que precisava ser provado foi provado
 *   1  algo esta exposto — ha dado ou escrita alcancavel da superficie publica
 *   2  nada exposto, mas ao menos uma checagem ficou sem prova
 */

const TABLES = ['content_sections', 'site_metadata', 'media_assets', 'leads'];

/**
 * Um bucket por valor de `media_assets.kind`. O `contentType` de cada sonda
 * precisa estar na lista de tipos aceitos do bucket, senao o proprio
 * armazenamento recusa o envio e a checagem falharia por motivo errado.
 */
const BUCKETS = [
  {
    id: 'veggiedent-images',
    probeExtension: 'png',
    contentType: 'image/png',
    // PNG valido de 1x1 pixel, para o caso de o armazenamento inspecionar bytes.
    probeBody: () =>
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        'base64',
      ),
  },
  {
    id: 'veggiedent-videos',
    probeExtension: 'mp4',
    contentType: 'video/mp4',
    // Cabecalho `ftyp` minimo de um MP4.
    probeBody: () =>
      Buffer.from('0000001c667479706d703432000000006d70343269736f6d', 'hex'),
  },
];

const VERDICT = {
  ok: 'OK',
  failed: 'FALHOU',
  inconclusive: 'INCONCLUSIVO',
  // Exclusivo da camada informativa (1): diz se a barreira extra esta de pe,
  // sem transformar a ausencia dela em reprovacao.
  reinforced: 'REFORCADO',
  absent: 'AUSENTE',
};

const EXIT_CODE = {
  allProven: 0,
  somethingExposed: 1,
  somethingUnproven: 2,
};

const PROBE_PREFIX = 'verificacao-isolamento';

// -- Configuracao -------------------------------------------------------------

/** Le a configuracao do ambiente. Lanca com instrucao acionavel se faltar algo. */
function readConfig(env) {
  const baseUrl = env.SUPABASE_URL;
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY;
  const secretKey = env.SUPABASE_SECRET_KEY;

  const missing = [];
  if (!baseUrl) missing.push('SUPABASE_URL');
  if (!publishableKey) missing.push('SUPABASE_PUBLISHABLE_KEY');
  if (!secretKey) missing.push('SUPABASE_SECRET_KEY');

  if (missing.length > 0) {
    throw new Error(
      `Variaveis de ambiente ausentes: ${missing.join(', ')}.\n` +
        'Pegue os valores em Project Settings > API Keys do projeto Supabase.\n' +
        'A chave secreta e obrigatoria: sem ela nao ha como contar as linhas que\n' +
        'a chave publicavel deveria estar sem enxergar, nem listar os buckets.',
    );
  }

  return { baseUrl: baseUrl.replace(/\/+$/, ''), publishableKey, secretKey };
}

function authHeaders(key) {
  return { apikey: key, Authorization: `Bearer ${key}` };
}

function truncate(text, limit) {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  return collapsed.length > limit ? `${collapsed.slice(0, limit)}...` : collapsed;
}

// -- (1) A chave publicavel alcanca a Data API? -------------------------------

/**
 * O portao da Data API pode estar configurado para so aceitar chaves secretas.
 * Quando esta, nenhuma requisicao do navegador chega sequer ao Postgres.
 */
async function checkPublishableKeyAtGateway({ baseUrl, publishableKey }) {
  const response = await fetch(`${baseUrl}/rest/v1/`, {
    headers: authHeaders(publishableKey),
  });

  if (response.status === 401 || response.status === 403) {
    return {
      name: 'Portao da Data API recusa a chave publicavel',
      verdict: VERDICT.reinforced,
      detail: `HTTP ${response.status} — ${truncate(await response.text(), 90)}`,
    };
  }

  return {
    name: 'Portao da Data API recusa a chave publicavel',
    verdict: VERDICT.absent,
    detail:
      `HTTP ${response.status} — este projeto aceita a chave publicavel no portao. ` +
      'A negacao depende inteiramente da barreira por tabela, verificada abaixo.',
  };
}

/** True quando o portao barra a chave publicavel antes de consultar tabelas. */
function gatewayIsClosed(gatewayResult) {
  return gatewayResult.verdict === VERDICT.reinforced;
}

// -- (2) Cada tabela nega a leitura publica? ----------------------------------

/** Tenta ler uma tabela pela Data API com a chave publicavel. */
async function readTableWithPublishableKey({ baseUrl, publishableKey }, table) {
  const response = await fetch(`${baseUrl}/rest/v1/${table}?select=*&limit=1`, {
    headers: authHeaders(publishableKey),
  });

  const body = await response.text();
  return { status: response.status, body, rows: parseRows(body) };
}

/** Conta as linhas reais da tabela com a chave secreta, que ignora RLS. */
async function countRowsWithSecretKey({ baseUrl, secretKey }, table) {
  const response = await fetch(`${baseUrl}/rest/v1/${table}?select=*&limit=0`, {
    headers: { ...authHeaders(secretKey), Prefer: 'count=exact' },
  });

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
 * Nomeia qual barreira produziu a recusa. As duas negam, mas provam coisas
 * diferentes, e confundi-las e o jeito mais facil de acreditar em uma protecao
 * que nao foi exercida.
 */
function describeBarrier(probe, isGatewayClosed) {
  if (isGatewayClosed) {
    return 'barrado no portao da Data API — a tabela nao chegou a ser consultada';
  }
  if (probe.body.includes('42501')) {
    return 'permissao negada na tabela (GRANT revogado)';
  }
  return 'acesso recusado pela Data API';
}

/**
 * @param {{status: number, rows: unknown[] | null, body: string}} probe
 * @param {number | null} rowCount linhas reais na tabela, ou null se desconhecido
 * @param {boolean} isGatewayClosed
 */
function classifyTable(probe, rowCount, isGatewayClosed) {
  if (probe.status === 401 || probe.status === 403) {
    return {
      verdict: VERDICT.ok,
      detail: `HTTP ${probe.status} — ${describeBarrier(probe, isGatewayClosed)}.`,
    };
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
      detail: `HTTP ${probe.status} — resposta inesperada: ${truncate(probe.body, 110)}`,
    };
  }

  if (probe.rows.length > 0) {
    return {
      verdict: VERDICT.failed,
      detail: `HTTP ${probe.status} — a chave publicavel leu ${probe.rows.length} linha(s).`,
    };
  }

  if (rowCount === null) {
    return {
      verdict: VERDICT.inconclusive,
      detail:
        'HTTP 200 com conjunto vazio, mas nao foi possivel contar as linhas reais ' +
        'com a chave secreta — sem isso o vazio nao prova nada.',
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
    verdict: VERDICT.ok,
    detail: `HTTP 200 com conjunto vazio, com ${rowCount} linha(s) na tabela — RLS escondeu todas.`,
  };
}

async function checkTable(config, isGatewayClosed, table) {
  const probe = await readTableWithPublishableKey(config, table);

  // A contagem so muda o veredito no caso ambiguo: leitura permitida que voltou
  // vazia. Uma recusa explicita ja e conclusiva com a tabela vazia ou cheia.
  const answerIsAmbiguous = probe.status === 200 && probe.rows?.length === 0;
  const rowCount = answerIsAmbiguous ? await countRowsWithSecretKey(config, table) : null;

  return {
    name: `Tabela ${table} nega leitura publica`,
    ...classifyTable(probe, rowCount, isGatewayClosed),
  };
}

// -- (3) Os buckets existem com a politica pretendida? ------------------------

async function listBuckets({ baseUrl, secretKey }) {
  const response = await fetch(`${baseUrl}/storage/v1/bucket`, {
    headers: authHeaders(secretKey),
  });

  if (!response.ok) return null;
  const parsed = await response.json();
  return Array.isArray(parsed) ? parsed : null;
}

function objectUrl(baseUrl, bucketId, path) {
  return `${baseUrl}/storage/v1/object/${bucketId}/${path}`;
}

async function uploadProbe({ baseUrl, secretKey }, bucket, path) {
  return fetch(objectUrl(baseUrl, bucket.id, path), {
    method: 'POST',
    headers: { ...authHeaders(secretKey), 'Content-Type': bucket.contentType },
    body: bucket.probeBody(),
  });
}

async function deleteProbe({ baseUrl, secretKey }, bucket, path) {
  await fetch(objectUrl(baseUrl, bucket.id, path), {
    method: 'DELETE',
    headers: authHeaders(secretKey),
  }).catch(() => undefined);
}

/** Le o arquivo pela rota publica, sem mandar credencial nenhuma. */
async function readProbeAnonymously({ baseUrl }, bucket, path) {
  return fetch(`${baseUrl}/storage/v1/object/public/${bucket.id}/${path}`);
}

/** Tenta escrever com a chave que o navegador carrega. Precisa ser recusado. */
async function writeProbeWithPublishableKey({ baseUrl, publishableKey }, bucket, path) {
  return fetch(objectUrl(baseUrl, bucket.id, path), {
    method: 'POST',
    headers: { ...authHeaders(publishableKey), 'Content-Type': bucket.contentType },
    body: bucket.probeBody(),
  });
}

/**
 * Exercita a politica do bucket de ponta a ponta. A sonda enviada e sempre
 * apagada no `finally`: uma verificacao nao pode deixar lixo no armazenamento,
 * nem quando falha no meio.
 */
async function probeBucketPolicy(config, bucket) {
  const probePath = `${PROBE_PREFIX}/${Date.now()}.${bucket.probeExtension}`;

  try {
    const upload = await uploadProbe(config, bucket, probePath);
    if (!upload.ok) {
      return {
        verdict: VERDICT.inconclusive,
        detail:
          `nao foi possivel enviar a sonda com a chave secreta (HTTP ${upload.status}: ` +
          `${truncate(await upload.text(), 80)}) — politica de leitura nao exercitada.`,
      };
    }

    const publicRead = await readProbeAnonymously(config, bucket, probePath);
    if (!publicRead.ok) {
      return {
        verdict: VERDICT.failed,
        detail: `leitura publica do arquivo respondeu HTTP ${publicRead.status} — a LP nao conseguiria exibir a midia.`,
      };
    }

    const anonymousWrite = await writeProbeWithPublishableKey(config, bucket, `${probePath}.intruso`);
    if (anonymousWrite.ok) {
      await deleteProbe(config, bucket, `${probePath}.intruso`);
      return {
        verdict: VERDICT.failed,
        detail: 'a chave publicavel conseguiu ESCREVER no bucket.',
      };
    }

    return {
      verdict: VERDICT.ok,
      detail: `leitura publica HTTP 200; escrita com a chave publicavel recusada (HTTP ${anonymousWrite.status}).`,
    };
  } finally {
    await deleteProbe(config, bucket, probePath);
  }
}

function describeBucketShape(found) {
  const megabytes = (found.file_size_limit / 1024 / 1024).toFixed(0);
  return `publico=${found.public}, limite=${megabytes}MB, tipos=${(found.allowed_mime_types ?? []).length}`;
}

async function checkBucket(config, buckets, bucket) {
  const name = `Bucket ${bucket.id} publico para leitura, fechado para escrita`;
  const found = buckets.find((candidate) => candidate.id === bucket.id);

  if (!found) {
    return { name, verdict: VERDICT.inconclusive, detail: 'bucket ausente — aplique a migracao dos buckets.' };
  }

  if (found.public !== true) {
    return {
      name,
      verdict: VERDICT.failed,
      detail: 'bucket marcado como privado — a LP nao conseguiria exibir a midia.',
    };
  }

  const policy = await probeBucketPolicy(config, bucket);
  return { name, verdict: policy.verdict, detail: `${describeBucketShape(found)}; ${policy.detail}` };
}

async function checkBuckets(config) {
  const buckets = await listBuckets(config);

  if (!buckets) {
    return BUCKETS.map((bucket) => ({
      name: `Bucket ${bucket.id} publico para leitura, fechado para escrita`,
      verdict: VERDICT.inconclusive,
      detail: 'nao foi possivel listar os buckets com a chave secreta.',
    }));
  }

  const results = [];
  for (const bucket of BUCKETS) {
    results.push(await checkBucket(config, buckets, bucket));
  }
  return results;
}

// -- Relatorio ----------------------------------------------------------------

function render(results) {
  const width = Math.max(...results.map((result) => result.name.length));

  console.log('Isolamento da superficie publica do Supabase\n');
  for (const { name, verdict, detail } of results) {
    console.log(`  ${verdict.padEnd(13)} ${name.padEnd(width)}  ${detail}`);
  }
  console.log('');
}

function summarize(results) {
  if (results.some((result) => result.verdict === VERDICT.failed)) {
    return {
      code: EXIT_CODE.somethingExposed,
      message: 'FALHOU: a superficie publica alcanca algo que deveria estar fechado.',
    };
  }

  if (results.some((result) => result.verdict === VERDICT.inconclusive)) {
    return {
      code: EXIT_CODE.somethingUnproven,
      message: 'INCONCLUSIVO: nada exposto, mas ha checagem sem prova. Veja acima.',
    };
  }

  return {
    code: EXIT_CODE.allProven,
    message: 'OK: tabelas negam a leitura publica e os buckets sao publicos so para leitura.',
  };
}

async function main() {
  const config = readConfig(process.env);

  const gateway = await checkPublishableKeyAtGateway(config);
  const isGatewayClosed = gatewayIsClosed(gateway);

  const results = [gateway];
  for (const table of TABLES) {
    results.push(await checkTable(config, isGatewayClosed, table));
  }
  results.push(...(await checkBuckets(config)));

  render(results);

  const { code, message } = summarize(results);
  console.log(message);
  process.exit(code);
}

main().catch((error) => {
  console.error(`Erro: ${error.message}`);
  process.exit(1);
});
