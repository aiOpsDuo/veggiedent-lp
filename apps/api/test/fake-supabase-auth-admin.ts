import { randomUUID } from 'node:crypto'

/**
 * Dublê da Admin API do Supabase Auth (`auth.admin.*`), usada pela gestão de
 * operadores (SDD § D-09). Separado de `FakeSupabaseDatabase` — o dublê do
 * PostgREST em `fake-supabase.ts` — de propósito: um operador não é uma linha
 * de tabela, é uma conta do Supabase Auth, e a distinção entre os dois dublês
 * deixa isso visível para quem lê o teste, do mesmo jeito que `FakeStorage`
 * é separado por representar o armazenamento de arquivos, não o banco.
 *
 * Imita só o que `SupabaseOperatorDirectory` chama — `listUsers`,
 * `generateLink` e `deleteUser` — e nada além disso.
 */

export interface FakeOperator {
  readonly id: string
  readonly email: string
  readonly created_at: string
  readonly last_sign_in_at: string | null
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
  seed(operator: { id: string; email: string; createdAt?: string; lastSignInAt?: string | null }): FakeOperator {
    const stored: FakeOperator = {
      id: operator.id,
      email: operator.email,
      created_at: operator.createdAt ?? new Date().toISOString(),
      last_sign_in_at: operator.lastSignInAt ?? null,
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
   * Imita `generateLink({ type: 'invite', email })`: o Supabase de verdade
   * cria a conta do convidado neste passo (ela existe a partir daqui, mesmo
   * sem senha), e é isso que o dublê reproduz — depois do convite, a nova
   * conta já aparece em `listUsers`.
   */
  async generateLink(params: {
    type: string
    email: string
  }): Promise<{
    data: { properties: { action_link: string }; user: FakeOperator }
    error: null
  }> {
    const existing = [...this.users.values()].find((user) => user.email === params.email)
    const operator = existing ?? this.seed({ id: randomUUID(), email: params.email })
    const token = randomUUID().replace(/-/g, '')
    return {
      data: {
        properties: {
          action_link: `https://fake-supabase.test/auth/v1/verify?type=${params.type}&token=${token}&email=${encodeURIComponent(params.email)}`,
        },
        user: operator,
      },
      error: null,
    }
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
