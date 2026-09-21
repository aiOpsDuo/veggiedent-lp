#!/usr/bin/env node

/**
 * Prova, contra um MySQL real, que as cinco tabelas do schema Prisma existem
 * e que suas colunas batem com o que o SDD declara — nome, tipo e
 * obrigatoriedade.
 *
 * Rastreavel a: PLAN.md § migracao-mysql/persistencia-orm (criterio de
 * "pronto"), SDD § "Modelo de dados", § D-10.
 *
 * Mesmo espirito de `supabase/scripts/verify-isolation.mjs` (que provava o
 * isolamento da superficie publica do Supabase): aqui nao ha RLS para provar
 * — MySQL nao tem esse recurso, e o SDD § "Isolamento de acesso" (revisto em
 * 2026-09-21) explica por que a garantia passou a ser inteiramente
 * arquitetural (nenhum cliente alem da API tem endereco/credencial do MySQL).
 * O que este script prova em vez disso e a fidelidade do schema fisico ao que
 * o SDD promete: a MESMA preocupacao de fundo (nao confiar em configuracao
 * declarada, verificar o banco de verdade), aplicada ao problema que este
 * banco de fato tem.
 *
 * Uso:
 *   DATABASE_URL=mysql://usuario:senha@host:porta/banco \
 *     node apps/api/scripts/verify-schema.mjs
 *
 * Codigos de saida:
 *   0  todas as checagens bateram com o SDD
 *   1  ao menos uma tabela ou coluna diverge do SDD (ausente, tipo errado,
 *      nulabilidade errada) — o schema fisico nao e o que a documentacao promete
 *   2  nao foi possivel conectar ou consultar o banco — nada foi provado
 */

import mariadb from 'mariadb'

const VERDICT = { ok: 'OK', failed: 'FALHOU' }

const EXIT_CODE = { allMatch: 0, mismatch: 1, inconclusive: 2 }

/**
 * Fonte da verdade: SDD § "Modelo de dados", conferida coluna a coluna contra
 * `apps/api/prisma/schema.prisma` e a migracao gerada
 * (`apps/api/prisma/migrations/*_init/migration.sql`). `columnType` é o valor
 * exato que `information_schema.columns.COLUMN_TYPE` devolve no MySQL 8 para
 * o tipo declarado no schema Prisma — inclui o tamanho/precisão, não só o
 * nome do tipo, porque "VARCHAR" sem tamanho não é o mesmo contrato que
 * `VARCHAR(64)`.
 */
const EXPECTED_TABLES = {
  content_sections: [
    { name: 'key', columnType: 'varchar(64)', nullable: false },
    { name: 'data', columnType: 'json', nullable: false },
    { name: 'is_published', columnType: 'tinyint(1)', nullable: false },
    { name: 'updated_at', columnType: 'datetime(3)', nullable: false },
    { name: 'updated_by', columnType: 'char(36)', nullable: true },
  ],
  site_metadata: [
    { name: 'id', columnType: 'varchar(16)', nullable: false },
    { name: 'title', columnType: 'text', nullable: true },
    { name: 'description', columnType: 'text', nullable: true },
    { name: 'og_image_alt', columnType: 'text', nullable: true },
    { name: 'og_image_media_id', columnType: 'char(36)', nullable: true },
    { name: 'updated_at', columnType: 'datetime(3)', nullable: false },
    { name: 'updated_by', columnType: 'char(36)', nullable: true },
    // Sem `canonical_url`: removida em
    // supabase/migrations/20260905120000_remove_canonical_url_and_option_codes.sql.
  ],
  media_assets: [
    { name: 'id', columnType: 'char(36)', nullable: false },
    { name: 'kind', columnType: 'varchar(16)', nullable: false },
    { name: 'storage_path', columnType: 'varchar(512)', nullable: false },
    { name: 'public_url', columnType: 'varchar(1024)', nullable: false },
    { name: 'mime_type', columnType: 'varchar(255)', nullable: false },
    { name: 'size_bytes', columnType: 'bigint', nullable: false },
    { name: 'original_filename', columnType: 'varchar(255)', nullable: false },
    { name: 'width', columnType: 'int', nullable: true },
    { name: 'height', columnType: 'int', nullable: true },
    { name: 'duration_seconds', columnType: 'decimal(10,3)', nullable: true },
    { name: 'created_at', columnType: 'datetime(3)', nullable: false },
    { name: 'created_by', columnType: 'char(36)', nullable: true },
  ],
  leads: [
    { name: 'id', columnType: 'char(36)', nullable: false },
    { name: 'nome', columnType: 'varchar(255)', nullable: false },
    { name: 'email', columnType: 'varchar(255)', nullable: false },
    { name: 'telefone', columnType: 'varchar(255)', nullable: true },
    { name: 'nome_cachorro', columnType: 'varchar(255)', nullable: true },
    { name: 'porte_cachorro', columnType: 'varchar(255)', nullable: true },
    { name: 'cidade_estado', columnType: 'varchar(255)', nullable: true },
    { name: 'conhece_virbac', columnType: 'varchar(255)', nullable: true },
    { name: 'usa_produto_virbac', columnType: 'varchar(255)', nullable: true },
    { name: 'qual_produto_virbac', columnType: 'varchar(255)', nullable: true },
    { name: 'aceite_comunicacoes', columnType: 'tinyint(1)', nullable: false },
    { name: 'origem', columnType: 'varchar(64)', nullable: true },
    { name: 'created_at', columnType: 'datetime(3)', nullable: false },
    // Sem `aceite_lgpd`/`rdstation_status`/`rdstation_error` — removidas nas
    // migracoes Postgres originais (ver docs/BANCO-DE-DADOS.md).
  ],
  operators: [
    { name: 'id', columnType: 'char(36)', nullable: false },
    { name: 'email', columnType: 'varchar(255)', nullable: false },
    { name: 'password_hash', columnType: 'varchar(255)', nullable: false },
    { name: 'name', columnType: 'varchar(255)', nullable: false },
    { name: 'created_at', columnType: 'datetime(3)', nullable: false },
  ],
}

// -- Configuracao -------------------------------------------------------------

function readConfig(env) {
  const databaseUrl = env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error(
      'Variavel de ambiente ausente: DATABASE_URL.\n' +
        'Formato esperado: mysql://usuario:senha@host:porta/banco (mesmo formato de apps/api/.env.example).',
    )
  }
  return { databaseUrl }
}

/**
 * O pacote `mariadb` (usado pelo driver adapter do Prisma, ver
 * shared/infrastructure/prisma-client.ts) só reconhece o esquema
 * `mariadb://` na propria string de conexao — o mesmo ajuste que
 * `@prisma/adapter-mariadb` faz por baixo dos panos antes de entregar a URL
 * ao driver.
 */
function toMariaDbUrl(databaseUrl) {
  return databaseUrl.replace(/^mysql:\/\//, 'mariadb://')
}

// -- Consulta -------------------------------------------------------------

async function fetchColumns(connection, table) {
  const rows = await connection.query(
    `SELECT COLUMN_NAME AS name, COLUMN_TYPE AS columnType, IS_NULLABLE AS isNullable
       FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = ?
      ORDER BY ORDINAL_POSITION`,
    [table],
  )
  return rows
}

async function tableExists(connection, table) {
  const rows = await connection.query(
    `SELECT COUNT(*) AS total
       FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name = ?`,
    [table],
  )
  return Number(rows[0].total) > 0
}

/** Compara as colunas reais contra as esperadas; devolve um resultado por coluna esperada. */
function compareColumns(expectedColumns, actualColumns) {
  const actualByName = new Map(actualColumns.map((column) => [column.name, column]))

  return expectedColumns.map((expected) => {
    const actual = actualByName.get(expected.name)

    if (!actual) {
      return {
        verdict: VERDICT.failed,
        detail: `coluna ausente no banco.`,
      }
    }

    const actualNullable = actual.isNullable === 'YES'
    const typeMatches = actual.columnType.toLowerCase() === expected.columnType.toLowerCase()
    const nullableMatches = actualNullable === expected.nullable

    if (typeMatches && nullableMatches) {
      return {
        verdict: VERDICT.ok,
        detail: `${actual.columnType} ${actualNullable ? 'NULL' : 'NOT NULL'}`,
      }
    }

    const problems = []
    if (!typeMatches) {
      problems.push(`tipo é ${actual.columnType}, SDD declara ${expected.columnType}`)
    }
    if (!nullableMatches) {
      problems.push(
        `${actualNullable ? 'aceita NULL' : 'é NOT NULL'}, SDD declara ${expected.nullable ? 'anulável' : 'obrigatório'}`,
      )
    }
    return { verdict: VERDICT.failed, detail: problems.join('; ') }
  })
}

async function checkTable(connection, table, expectedColumns) {
  const exists = await tableExists(connection, table)
  if (!exists) {
    return [
      {
        name: `Tabela ${table} existe`,
        verdict: VERDICT.failed,
        detail: 'tabela ausente — rode `npx prisma migrate deploy` antes de verificar.',
      },
    ]
  }

  const actualColumns = await fetchColumns(connection, table)
  const comparisons = compareColumns(expectedColumns, actualColumns)

  return [
    { name: `Tabela ${table} existe`, verdict: VERDICT.ok, detail: `${actualColumns.length} coluna(s) no banco.` },
    ...comparisons.map((comparison, index) => ({
      name: `Coluna ${table}.${expectedColumns[index].name}`,
      ...comparison,
    })),
  ]
}

// -- Relatorio ----------------------------------------------------------------

function render(results) {
  const width = Math.max(...results.map((result) => result.name.length))

  console.log('Schema MySQL contra o SDD § "Modelo de dados"\n')
  for (const { name, verdict, detail } of results) {
    console.log(`  ${verdict.padEnd(7)} ${name.padEnd(width)}  ${detail}`)
  }
  console.log('')
}

function summarize(results) {
  const total = results.length
  const failed = results.filter((result) => result.verdict === VERDICT.failed).length

  if (failed > 0) {
    return {
      code: EXIT_CODE.mismatch,
      message: `FALHOU: ${failed} de ${total} checagem(ns) divergem do SDD.`,
    }
  }

  return {
    code: EXIT_CODE.allMatch,
    message: `OK: ${total} checagem(ns) confirmam as 5 tabelas e suas colunas contra o SDD.`,
  }
}

async function main() {
  const { databaseUrl } = readConfig(process.env)
  const connection = await mariadb.createConnection(toMariaDbUrl(databaseUrl))

  try {
    const results = []
    for (const [table, expectedColumns] of Object.entries(EXPECTED_TABLES)) {
      results.push(...(await checkTable(connection, table, expectedColumns)))
    }

    render(results)

    const { code, message } = summarize(results)
    console.log(message)
    process.exit(code)
  } finally {
    await connection.end()
  }
}

main().catch((error) => {
  console.error(`Erro: ${error.message}`)
  process.exit(EXIT_CODE.inconclusive)
})
