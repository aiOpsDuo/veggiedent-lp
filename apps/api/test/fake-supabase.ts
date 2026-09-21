import { FakeMinioClient } from './fake-storage'

/**
 * Banco em memória, table-driven, com a forma de dado que o PostgREST usava
 * quando este projeto ainda falava com o Supabase — chave primária declarada,
 * `default` de coluna imitado no `insert`, falha simulada por tabela.
 *
 * Existe por duas razões. A primeira é a exigência de que a suíte não dependa
 * de rede: o dublê entra no lugar do banco e o resto da aplicação sobe
 * inteiro — controllers, guarda, casos de uso e os repositórios **reais**
 * (`MySqlSectionRepository` e afins são substituídos, nos testes, por um
 * `Fake<Módulo>Repository` que fala com a tabela genérica daqui — ver
 * `fake-section-repository.ts`, `fake-site-metadata-repository.ts`,
 * `fake-lead-repository.ts`, `fake-media-repository.ts`). A segunda é o risco
 * R-05: como os repositórios de verdade são exercitados, dá para contar
 * quantas idas ao banco uma rota faz, o que um dublê no nível da porta de
 * repositório não conseguiria enxergar.
 *
 * O nome (`FakeSupabaseDatabase`) e as colunas em `snake_case` das tabelas são
 * herança do desenho anterior (Supabase/PostgREST) e não foram renomeados
 * nesta tarefa: é infraestrutura de teste interna, o nome não aparece em
 * nenhum contrato externo, e os testes que a usam (`*.e2e-spec.ts`) já
 * conhecem essas colunas — renomear só para "ficar correto" seria escopo a
 * mais sem necessidade real.
 */

export type Row = Record<string, unknown>

/** Chave primária de cada tabela, para o `upsert`. */
const PRIMARY_KEYS: Readonly<Record<string, string>> = {
  content_sections: 'key',
  site_metadata: 'id',
  media_assets: 'id',
  leads: 'id',
}

/**
 * Valores que a migração declara como `default` e que o banco preenche
 * sozinho no `insert`. O dublê os imita para que uma linha recém-gravada tenha
 * a mesma forma que teria no banco — sem isso, um lead gravado pelo teste
 * voltaria sem `created_at`, e a listagem ordenada por data não teria o que
 * ordenar.
 */
const COLUMN_DEFAULTS: Readonly<Record<string, Readonly<Record<string, () => unknown>>>> = {
  leads: { created_at: () => new Date().toISOString() },
}

export interface RecordedCall {
  readonly table: string
  readonly operation: 'select' | 'insert' | 'upsert' | 'update' | 'delete'
}

/** Forma mínima de uma falha simulada — só o que `failOn`/`failureFor` precisam. */
interface DatabaseFailure {
  readonly message: string
  readonly code: string
}

/** Preenche as colunas com `default` na migração que o `insert` não trouxe. */
function withDefaults(table: string, values: Row): Row {
  const defaults = COLUMN_DEFAULTS[table]
  if (!defaults) {
    return values
  }
  const completed: Row = { ...values }
  for (const [column, produce] of Object.entries(defaults)) {
    if (completed[column] === undefined) {
      completed[column] = produce()
    }
  }
  return completed
}

/**
 * O dublê propriamente dito. `calls` é o que os testes de consulta única leem.
 */
export class FakeSupabaseDatabase {
  readonly calls: RecordedCall[] = []
  /**
   * O armazenamento de arquivos, exposto aqui por conveniência histórica: os
   * testes de mídia (`admin-midia.e2e-spec.ts`, `carga-do-instantaneo.e2e-spec.ts`)
   * manipulam `harness.database.storage` diretamente para fazer o papel do
   * navegador (SDD § D-05). Desde 2026-09-21 é um `FakeMinioClient` — a mídia
   * não fala mais com este dublê para nada além disso; `media_assets`
   * continua sendo uma tabela genérica aqui embaixo, mas quem a lê/grava é o
   * `FakeMediaRepository`/`FakeMediaUrlRepository` de `fake-media-repository.ts`.
   */
  readonly storage = new FakeMinioClient()
  private readonly tables = new Map<string, Row[]>()
  private readonly failures = new Map<string, DatabaseFailure>()

  seed(table: string, rows: readonly Row[]): void {
    this.tables.set(table, rows.map((row) => ({ ...row })))
  }

  /** Faz a próxima operação naquela tabela falhar, como o banco faria. */
  failOn(table: string, message = 'permission denied', code = '42501'): void {
    this.failures.set(table, { message, code })
  }

  rows(table: string): Row[] {
    return this.tables.get(table) ?? []
  }

  callsTo(table: string): RecordedCall[] {
    return this.calls.filter((call) => call.table === table)
  }

  reset(): void {
    this.calls.length = 0
  }

  record(call: RecordedCall): void {
    this.calls.push(call)
  }

  failureFor(table: string): DatabaseFailure | undefined {
    return this.failures.get(table)
  }

  /** `insert`: linha nova sempre, com a unicidade da chave. */
  insert(table: string, values: Row): Row {
    const key = PRIMARY_KEYS[table] as string
    const rows = this.tables.get(table) ?? []
    if (rows.some((row) => row[key] === values[key])) {
      throw new Error(`Chave duplicada no dublê: ${table}.${key} = ${String(values[key])}`)
    }
    const inserted = { ...withDefaults(table, values) }
    rows.push(inserted)
    this.tables.set(table, rows)
    return inserted
  }

  delete(table: string, matching: readonly Row[]): Row[] {
    const rows = this.tables.get(table) ?? []
    this.tables.set(
      table,
      rows.filter((row) => !matching.includes(row)),
    )
    return [...matching]
  }

  upsert(table: string, values: Row): Row {
    const key = PRIMARY_KEYS[table]
    if (!key) {
      throw new Error(`Tabela sem chave primária declarada no dublê: ${table}`)
    }
    const rows = this.tables.get(table) ?? []
    const index = rows.findIndex((row) => row[key] === values[key])
    const merged = index >= 0 ? { ...rows[index], ...values } : { ...values }
    if (index >= 0) {
      rows[index] = merged
    } else {
      rows.push(merged)
    }
    this.tables.set(table, rows)
    return merged
  }

  update(table: string, matching: readonly Row[], values: Row): Row[] {
    const rows = this.tables.get(table) ?? []
    return matching.map((match) => {
      const index = rows.indexOf(match)
      const merged = { ...match, ...values }
      rows[index] = merged
      return merged
    })
  }
}
