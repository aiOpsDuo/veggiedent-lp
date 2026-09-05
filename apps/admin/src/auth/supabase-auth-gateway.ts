import { createClient } from '@supabase/supabase-js'
import type { AdminEnvironment } from '../config/env'
import type { AuthGateway, SignInRejection, SignInResult, Unsubscribe } from './auth-gateway'
import type { OperatorCredentials, OperatorSession } from './operator-session'

/**
 * Opções de autenticação do cliente do Supabase.
 *
 * `persistSession` guarda a sessão no armazenamento do navegador e é o que faz
 * a sessão sobreviver a recarregar a página (SDD § C-02); `autoRefreshToken`
 * renova o token antes de ele expirar, sem o que o operador seria deslogado no
 * meio de uma edição. `detectSessionInUrl` fica desligada de propósito: essa
 * opção varre a URL **inteira** a cada carregamento em busca de um fragmento
 * de sessão, um comportamento implícito e global que este painel não quer para
 * nenhuma tela. `storageKey` é próprio do painel para que a LP, servida no
 * mesmo domínio (T16), nunca compartilhe esta chave.
 */
export const ADMIN_AUTH_OPTIONS = {
  persistSession: true,
  autoRefreshToken: true,
  detectSessionInUrl: false,
  storageKey: 'veggiedent-admin-auth',
} as const

/** Sessão como o Supabase a entrega, no recorte que o painel consome. */
export interface SupabaseSessionLike {
  readonly access_token: string
  readonly user: { readonly id: string; readonly email?: string }
}

/**
 * O recorte do cliente do Supabase que o painel usa — e nada além dele
 * (segregação de interfaces). O cliente real satisfaz esta interface; o dublê
 * dos testes também, sem precisar imitar armazenamento, realtime ou Postgrest.
 */
export interface SupabaseAuthApi {
  signInWithPassword(credentials: {
    email: string
    password: string
  }): Promise<{ error: unknown }>
  signOut(): Promise<{ error: unknown }>
  onAuthStateChange(
    callback: (event: string, session: SupabaseSessionLike | null) => void,
  ): { data: { subscription: { unsubscribe: () => void } } }
}

/** Estados HTTP em que ninguém chegou a julgar as credenciais. */
const TOO_MANY_REQUESTS = 429
const FIRST_SERVER_ERROR_STATUS = 500

function statusOf(error: unknown): number | undefined {
  return typeof error === 'object' && error !== null && 'status' in error
    ? (error as { status?: number }).status
    : undefined
}

/**
 * Traduz a falha do provedor para um dos dois motivos do domínio.
 *
 * Todo julgamento de credencial — senha errada, e-mail inexistente, usuário não
 * confirmado — cai em `credenciais-invalidas`, sem exceção. É deliberado: é
 * exatamente a distinção entre esses casos que revelaria se um e-mail existe.
 */
function classifyRejection(error: unknown): SignInRejection {
  const status = statusOf(error)
  const noOneJudged =
    status === undefined ||
    status === 0 ||
    status === TOO_MANY_REQUESTS ||
    status >= FIRST_SERVER_ERROR_STATUS
  return noOneJudged ? 'indisponivel' : 'credenciais-invalidas'
}

function toOperatorSession(session: SupabaseSessionLike | null): OperatorSession | null {
  if (session === null) {
    return null
  }
  return {
    operatorId: session.user.id,
    operatorEmail: session.user.email ?? '',
    accessToken: session.access_token,
  }
}

/**
 * Adaptador do Supabase Auth para a porta do painel (SDD § D-03).
 *
 * Recebe o cliente pronto em vez de construí-lo, pelo mesmo motivo que o
 * `JwksTokenVerifier` da API recebe o resolvedor de chaves: é o que permite ao
 * teste exercitar este adaptador sem tocar a rede.
 */
export class SupabaseAuthGateway implements AuthGateway {
  constructor(private readonly auth: SupabaseAuthApi) {}

  observeSession(
    listener: (session: OperatorSession | null) => void,
  ): Unsubscribe {
    const { data } = this.auth.onAuthStateChange((_event, session) => {
      listener(toOperatorSession(session))
    })
    return () => data.subscription.unsubscribe()
  }

  async signIn(credentials: OperatorCredentials): Promise<SignInResult> {
    try {
      const { error } = await this.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      })
      return error === null || error === undefined
        ? { ok: true }
        : { ok: false, rejection: classifyRejection(error) }
    } catch (error) {
      return { ok: false, rejection: classifyRejection(error) }
    }
  }

  /**
   * Encerra a sessão. Uma falha do servidor ao invalidar o token não impede o
   * operador de sair: o cliente do Supabase apaga a sessão local de qualquer
   * jeito, e é a ausência dela que a guarda observa.
   */
  async signOut(): Promise<void> {
    try {
      await this.auth.signOut()
    } catch {
      // Sair é sempre possível do lado do painel — ver o comentário acima.
    }
  }

}

/** Monta o gateway de produção, com o cliente real do Supabase. */
export function createSupabaseAuthGateway(environment: AdminEnvironment): AuthGateway {
  const client = createClient(
    environment.supabaseUrl,
    environment.supabasePublishableKey,
    { auth: { ...ADMIN_AUTH_OPTIONS } },
  )
  return new SupabaseAuthGateway(client.auth)
}
