import type {
  SupabaseAuthApi,
  SupabaseSessionLike,
} from '../src/auth/supabase-auth-gateway'

/**
 * Dublê do cliente do Supabase Auth — a rede inteira do login mora aqui, e só
 * aqui. Tudo o que os testes exercitam acima dele (adaptador, provedor, guarda,
 * roteador, telas) é o código de produção.
 *
 * Ele reproduz o contrato documentado do `@supabase/supabase-js` nos três
 * pontos de que o painel depende:
 *
 * 1. `onAuthStateChange` avisa **assim que assina**, com a sessão lida do
 *    armazenamento ou `null` (o evento `INITIAL_SESSION`), e o aviso é
 *    assíncrono — é esse intervalo que o estado "verificando" cobre.
 * 2. `signInWithPassword` grava a sessão no armazenamento (`persistSession`) e
 *    avisa os assinantes, em vez de devolver a sessão para alguém guardar.
 * 3. `signOut` apaga a sessão do armazenamento e avisa.
 *
 * O armazenamento é injetado para que dois clientes possam compartilhá-lo — é
 * assim que um teste reproduz recarregar a página: mesmo armazenamento, cliente
 * novo, aplicação montada do zero.
 */
export interface FakeOperator {
  readonly id: string
  readonly email: string
  readonly password: string
}

/** Erro no formato em que o `supabase-js` o entrega: com `status` e `message`. */
interface FakeAuthError {
  readonly status: number
  readonly message: string
}

export type SessionStorage = Map<string, SupabaseSessionLike>

const STORED_SESSION_KEY = 'sessao'

/**
 * Mensagens diferentes de propósito para "e-mail inexistente" e "senha errada".
 *
 * O GoTrue real responde a mesma coisa nos dois casos, mas o painel não pode
 * depender disso: se um dia ele diferenciar, o vazamento tem de aparecer aqui,
 * e não na tela de login de produção.
 */
const UNKNOWN_EMAIL_ERROR: FakeAuthError = { status: 400, message: 'User not found' }
const WRONG_PASSWORD_ERROR: FakeAuthError = {
  status: 400,
  message: 'Invalid login credentials',
}

export interface FakeSupabaseAuthOptions {
  readonly operators?: readonly FakeOperator[]
  readonly storage?: SessionStorage
  /** Quando presente, toda tentativa de login falha com este erro. */
  readonly signInFailure?: FakeAuthError
}

export class FakeSupabaseAuth implements SupabaseAuthApi {
  readonly storage: SessionStorage
  private readonly operators: readonly FakeOperator[]
  private readonly listeners = new Set<
    (event: string, session: SupabaseSessionLike | null) => void
  >()

  constructor(private readonly options: FakeSupabaseAuthOptions = {}) {
    this.storage = options.storage ?? new Map()
    this.operators = options.operators ?? []
  }

  onAuthStateChange(
    callback: (event: string, session: SupabaseSessionLike | null) => void,
  ): { data: { subscription: { unsubscribe: () => void } } } {
    this.listeners.add(callback)
    queueMicrotask(() => {
      if (this.listeners.has(callback)) {
        callback('INITIAL_SESSION', this.storage.get(STORED_SESSION_KEY) ?? null)
      }
    })
    return {
      data: { subscription: { unsubscribe: () => this.listeners.delete(callback) } },
    }
  }

  async signInWithPassword(credentials: {
    email: string
    password: string
  }): Promise<{ error: unknown }> {
    if (this.options.signInFailure !== undefined) {
      return { error: this.options.signInFailure }
    }

    const operator = this.operators.find((each) => each.email === credentials.email)
    if (operator === undefined) {
      return { error: UNKNOWN_EMAIL_ERROR }
    }
    if (operator.password !== credentials.password) {
      return { error: WRONG_PASSWORD_ERROR }
    }

    const session: SupabaseSessionLike = {
      access_token: `token-de-${operator.id}`,
      user: { id: operator.id, email: operator.email },
    }
    this.storage.set(STORED_SESSION_KEY, session)
    this.notify('SIGNED_IN', session)
    return { error: null }
  }

  async signOut(): Promise<{ error: unknown }> {
    this.storage.delete(STORED_SESSION_KEY)
    this.notify('SIGNED_OUT', null)
    return { error: null }
  }

  private notify(event: string, session: SupabaseSessionLike | null): void {
    for (const listener of this.listeners) {
      listener(event, session)
    }
  }
}
