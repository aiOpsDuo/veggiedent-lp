import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Environment } from '../../config/environment.schema'

/** Token de injeção do cliente Supabase. Só a infraestrutura o injeta. */
export const SUPABASE_CLIENT = Symbol('SupabaseClient')

/**
 * Cliente Supabase do servidor, criado com a **chave secreta** (SDD §
 * "Modelo de dados"): as quatro tabelas negam tudo para os papéis anônimo e
 * autenticado, e a Data API deste projeto recusa a chave publicável já no
 * portão. Todo acesso ao banco passa por aqui, e este arquivo é o único ponto
 * do sistema onde a chave é lida.
 *
 * `persistSession` e `autoRefreshToken` desligados porque não há sessão a
 * guardar: o processo é um servidor, não um navegador — deixá-los ligados
 * criaria um temporizador de renovação que nunca serve para nada.
 */
export function createSupabaseClient(environment: Environment): SupabaseClient {
  return createClient(environment.SUPABASE_URL, environment.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
