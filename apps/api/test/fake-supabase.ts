import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import { FakeStorage } from './fake-storage'

/**
 * Banco em memória com a forma de resposta do PostgREST.
 *
 * Existe por duas razões. A primeira é a exigência de que a suíte não dependa
 * de rede: o dublê entra no lugar do cliente Supabase e o resto da aplicação
 * sobe inteiro — controllers, guarda, casos de uso e os repositórios **reais**.
 * A segunda é o risco R-05: como os repositórios de verdade são exercitados,
 * dá para contar quantas idas ao banco uma rota faz, o que um dublê no nível da
 * porta de repositório não conseguiria enxergar.
 *
 * Ele imita só o que os adaptadores usam, e falha alto no que não conhece —
 * um dublê que aceita tudo em silêncio mente sobre o que foi verificado.
 */

export type Row = Record<string, unknown>

/** Chave primária de cada tabela, para o `upsert`. */
const PRIMARY_KEYS: Readonly<Record<string, string>> = {
  content_sections: 'key',
  site_metadata: 'id',
  media_assets: 'id',
}

/**
 * Relações embutidas que o `select` pode pedir, na sintaxe `alias:tabela(cols)`.
 * Declaradas porque o PostgREST as resolve pela chave estrangeira, e o dublê
 * não tem catálogo de onde deduzi-las.
 */
const RELATIONS: Readonly<Record<string, { table: string; localKey: string }>> = {
  'site_metadata.og_image': { table: 'media_assets', localKey: 'og_image_media_id' },
}

const EMBEDDED_SELECT = /(\w+):(\w+)\(([^)]*)\)/g

export interface RecordedCall {
  readonly table: string
  readonly operation: 'select' | 'insert' | 'upsert' | 'update' | 'delete'
}

type Cardinality = 'many' | 'single' | 'maybe'

/** Um filtro de `where`, na forma que o dublê sabe aplicar sobre a linha. */
type RowFilter = (row: Row) => boolean

interface Result {
  data: unknown
  error: PostgrestError | null
}

function postgrestError(message: string, code: string): PostgrestError {
  return { message, code, details: '', hint: '' } as PostgrestError
}

class FakeQueryBuilder implements PromiseLike<Result> {
  private operation: RecordedCall['operation'] = 'select'
  private columns = '*'
  private values: Row = {}
  private cardinality: Cardinality = 'many'
  private readonly filters: RowFilter[] = []

  constructor(
    private readonly database: FakeSupabaseDatabase,
    private readonly table: string,
  ) {}

  select(columns = '*'): this {
    this.columns = columns
    return this
  }

  eq(column: string, value: unknown): this {
    this.filters.push((row) => row[column] === value)
    return this
  }

  /** `in` do PostgREST: a coluna precisa estar entre os valores pedidos. */
  in(column: string, values: readonly unknown[]): this {
    this.filters.push((row) => values.includes(row[column]))
    return this
  }

  insert(values: Row): this {
    this.operation = 'insert'
    this.values = values
    return this
  }

  delete(): this {
    this.operation = 'delete'
    return this
  }

  upsert(values: Row): this {
    this.operation = 'upsert'
    this.values = values
    return this
  }

  update(values: Row): this {
    this.operation = 'update'
    this.values = values
    return this
  }

  /** `returns<T>()` só carrega tipo no cliente real; aqui não muda nada. */
  returns(): this {
    return this
  }

  single(): this {
    this.cardinality = 'single'
    return this
  }

  maybeSingle(): this {
    this.cardinality = 'maybe'
    return this
  }

  then<TResult1 = Result, TResult2 = never>(
    onfulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve()
      .then(() => this.run())
      .then(onfulfilled, onrejected)
  }

  private run(): Result {
    this.database.record({ table: this.table, operation: this.operation })

    const failure = this.database.failureFor(this.table)
    if (failure) {
      return { data: null, error: failure }
    }

    const rows = this.apply()
    return this.shape(rows.map((row) => this.project(row)))
  }

  private apply(): Row[] {
    switch (this.operation) {
      case 'select':
        return this.matching()
      case 'insert':
        return [this.database.insert(this.table, this.values)]
      case 'delete':
        return this.database.delete(this.table, this.matching())
      case 'upsert':
        return [this.database.upsert(this.table, this.values)]
      case 'update':
        return this.database.update(this.table, this.matching(), this.values)
      /* c8 ignore next */
    }
  }

  private matching(): Row[] {
    return this.database
      .rows(this.table)
      .filter((row) => this.filters.every((matches) => matches(row)))
  }

  private project(row: Row): Row {
    const projected: Row = { ...row }
    for (const [, alias] of [...this.columns.matchAll(EMBEDDED_SELECT)].map(
      (match) => [match[0], match[1] as string] as const,
    )) {
      const relation = RELATIONS[`${this.table}.${alias}`]
      if (!relation) {
        throw new Error(`Relação embutida desconhecida no dublê: ${this.table}.${alias}`)
      }
      const foreignKey = row[relation.localKey]
      projected[alias] =
        this.database.rows(relation.table).find((candidate) => candidate.id === foreignKey) ?? null
    }
    return projected
  }

  private shape(rows: Row[]): Result {
    if (this.cardinality === 'many') {
      return { data: rows, error: null }
    }
    if (rows.length === 0) {
      return this.cardinality === 'maybe'
        ? { data: null, error: null }
        : {
            data: null,
            error: postgrestError('JSON object requested, multiple (or no) rows returned', 'PGRST116'),
          }
    }
    return { data: rows[0] as Row, error: null }
  }
}

/**
 * O dublê propriamente dito. `calls` é o que os testes de consulta única leem.
 */
export class FakeSupabaseDatabase {
  readonly calls: RecordedCall[] = []
  /** O armazenamento de arquivos do mesmo cliente (`supabase.storage`). */
  readonly storage = new FakeStorage()
  private readonly tables = new Map<string, Row[]>()
  private readonly failures = new Map<string, PostgrestError>()

  seed(table: string, rows: readonly Row[]): void {
    this.tables.set(table, rows.map((row) => ({ ...row })))
  }

  /** Faz a próxima operação naquela tabela falhar, como o PostgREST faria. */
  failOn(table: string, message = 'permission denied', code = '42501'): void {
    this.failures.set(table, postgrestError(message, code))
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

  failureFor(table: string): PostgrestError | undefined {
    return this.failures.get(table)
  }

  /** `insert` do PostgREST: linha nova sempre, com a unicidade da chave. */
  insert(table: string, values: Row): Row {
    const key = PRIMARY_KEYS[table] as string
    const rows = this.tables.get(table) ?? []
    if (rows.some((row) => row[key] === values[key])) {
      throw new Error(`Chave duplicada no dublê: ${table}.${key} = ${String(values[key])}`)
    }
    const inserted = { ...values }
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

  from(table: string): FakeQueryBuilder {
    if (!(table in PRIMARY_KEYS)) {
      throw new Error(`Tabela desconhecida no dublê: ${table}`)
    }
    return new FakeQueryBuilder(this, table)
  }

  /** O dublê no lugar do cliente real, para o `overrideProvider`. */
  asSupabaseClient(): SupabaseClient {
    return this as unknown as SupabaseClient
  }
}
