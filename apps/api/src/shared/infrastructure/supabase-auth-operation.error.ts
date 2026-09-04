import type { AuthError } from '@supabase/supabase-js'

/**
 * Falha vinda da Admin API do Supabase Auth (`auth.admin.*`, SDD § D-09),
 * embrulhada antes de subir — irmã de `SupabaseOperationError`, para a outra
 * metade do cliente Supabase. O formato de erro do GoTrue (`AuthError`) não é
 * o do PostgREST (`PostgrestError`, sem `code`/`status` no mesmo formato), por
 * isso não reaproveita a mesma classe.
 *
 * Como em `SupabaseOperationError`, nada do detalhe atravessa a fronteira da
 * resposta — o filtro global responde `500` com mensagem fixa, e o detalhe
 * fica só no log do servidor.
 */
export class SupabaseAuthOperationError extends Error {
  constructor(operation: string, cause: AuthError) {
    super(
      `Falha da Admin API do Supabase em "${operation}": ${cause.code ?? 'sem código'} — ${cause.message}`,
    )
    this.name = 'SupabaseAuthOperationError'
  }
}
