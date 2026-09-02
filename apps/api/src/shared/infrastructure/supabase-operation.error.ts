import type { PostgrestError } from '@supabase/supabase-js'

/**
 * Falha vinda do banco, embrulhada antes de subir.
 *
 * O detalhe do PostgREST (mensagem, `hint` com SQL de GRANT, nome de coluna)
 * fica só nesta exceção, que o filtro global registra no log do servidor e
 * responde como `500` com mensagem fixa. Nada do Supabase atravessa a fronteira
 * da resposta — a mesma regra que a T4 estabeleceu para erro interno.
 */
export class SupabaseOperationError extends Error {
  constructor(operation: string, cause: PostgrestError) {
    super(`Falha do Supabase em "${operation}": ${cause.code ?? 'sem código'} — ${cause.message}`)
    this.name = 'SupabaseOperationError'
  }
}

/** A forma comum a toda resposta do PostgREST: ou dados, ou erro. */
interface PostgrestResponseLike<T> {
  readonly data: T | null
  readonly error: PostgrestError | null
}

/** Lança quando a resposta trouxe erro; devolve os dados quando não. */
export function unwrap<T>(
  operation: string,
  response: PostgrestResponseLike<T>,
): T | null {
  if (response.error) {
    throw new SupabaseOperationError(operation, response.error)
  }
  return response.data
}

/**
 * Igual a `unwrap`, para as operações que sempre devolvem uma linha (`single`).
 * Ausência de dados sem erro do PostgREST não deveria acontecer; se acontecer,
 * é falha do servidor — melhor barulhenta no log do que um `null` seguindo
 * adiante disfarçado de registro gravado.
 */
export function unwrapRequired<T>(
  operation: string,
  response: PostgrestResponseLike<T>,
): T {
  const data = unwrap(operation, response)
  if (data === null) {
    throw new Error(`Falha do Supabase em "${operation}": resposta sem dados.`)
  }
  return data
}
