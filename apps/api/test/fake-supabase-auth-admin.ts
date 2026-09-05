import { randomUUID } from 'node:crypto'

/**
 * Dublê da Admin API do Supabase Auth (`auth.admin.*`), usada pela gestão de
 * operadores (SDD § D-09). Separado de `FakeSupabaseDatabase` — o dublê do
 * PostgREST em `fake-supabase.ts` — de propósito: um operador não é uma linha
 * de tabela, é uma conta do Supabase Auth, e a distinção entre os dois dublês
 * deixa isso visível para quem lê o teste, do mesmo jeito que `FakeStorage`
 * é separado por representar o armazenamento de arquivos, não o banco.
 *
 * Imita só o que `SupabaseOperatorDirectory` chama — `listUsers`, `createUser`
 * e `deleteUser` — e nada além disso.
 */

export interface FakeOperator {
  readonly id: string
  readonly email: string
  readonly created_at: string
  readonly last_sign_in_at: string | null
  readonly user_metadata: Record<string, unknown>
  /** Guardada só para o teste conferir que a senha recebida não vaza na resposta. */
  readonly password: string
  /** Presente quando `createUser` recebeu `email_confirm: true` (SDD § D-09). */
  readonly email_confirmed_at: string | null
}

interface FakeAuthError {
  readonly name: string
  readonly message: string
  readonly status: number
  readonly code: string
}

function authError(message: string): FakeAuthError {
  return { name: 'AuthApiError', message, status: 400, code: 'unexpected_failure' }
}

export class FakeSupabaseAuthAdmin {
  private readonly users = new Map<string, FakeOperator>()

  /** Para o `beforeEach` de cada teste popular quem já é operador. */
  seed(operator: {
    id: string
    email: string
    name?: string
    createdAt?: string
    lastSignInAt?: string | null
  }): FakeOperator {
    const stored: FakeOperator = {
      id: operator.id,
      email: operator.email,
      created_at: operator.createdAt ?? new Date().toISOString(),
      last_sign_in_at: operator.lastSignInAt ?? null,
      user_metadata: operator.name !== undefined ? { name: operator.name } : {},
      password: '',
      email_confirmed_at: new Date().toISOString(),
    }
    this.users.set(stored.id, stored)
    return stored
  }

  count(): number {
    return this.users.size
  }

  has(id: string): boolean {
    return this.users.has(id)
  }

  async listUsers(): Promise<{ data: { users: FakeOperator[] }; error: null }> {
    return { data: { users: [...this.users.values()] }, error: null }
  }

  /**
   * Imita `createUser({ email, password, email_confirm, user_metadata })`
   * (SDD § D-09, revista na T34): a conta nasce pronta para logar nesta
   * mesma chamada, sem link nem segundo passo.
   */
  async createUser(params: {
    email: string
    password: string
    email_confirm?: boolean
    user_metadata?: Record<string, unknown>
  }): Promise<{ data: { user: FakeOperator }; error: FakeAuthError | null }> {
    if ([...this.users.values()].some((user) => user.email === params.email)) {
      return {
        data: { user: undefined as unknown as FakeOperator },
        error: authError('Email address already registered'),
      }
    }
    const operator: FakeOperator = {
      id: randomUUID(),
      email: params.email,
      created_at: new Date().toISOString(),
      last_sign_in_at: null,
      user_metadata: params.user_metadata ?? {},
      password: params.password,
      email_confirmed_at: params.email_confirm === true ? new Date().toISOString() : null,
    }
    this.users.set(operator.id, operator)
    return { data: { user: operator }, error: null }
  }

  async deleteUser(
    id: string,
  ): Promise<{ data: { user: null }; error: FakeAuthError | null }> {
    const existed = this.users.delete(id)
    if (!existed) {
      return { data: { user: null }, error: authError('User not found') }
    }
    return { data: { user: null }, error: null }
  }
}
