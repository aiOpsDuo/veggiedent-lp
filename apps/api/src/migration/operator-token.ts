/**
 * Obtenção do token de operador que a migração usa nas rotas administrativas.
 *
 * A guarda global da API nega por padrão (SDD § C-01), e a migração não é
 * exceção: ela escreve como um operador escreveria, com um token de verdade. O
 * token pode vir pronto (`CMS_ACCESS_TOKEN`) ou ser trocado aqui por e-mail e
 * senha de um operador já existente no Supabase Auth — a mesma troca que o
 * painel fará no login (T10).
 */

export interface OperatorCredentials {
  readonly supabaseUrl: string
  readonly publishableKey: string
  readonly email: string
  readonly password: string
}

export class OperatorSignInError extends Error {
  constructor(status: number, body: string) {
    super(`Não consegui autenticar o operador (${status}): ${body}`)
    this.name = 'OperatorSignInError'
  }
}

export async function signInOperator(credentials: OperatorCredentials): Promise<string> {
  const response = await fetch(
    `${credentials.supabaseUrl}/auth/v1/token?grant_type=password`,
    {
      method: 'POST',
      headers: {
        apikey: credentials.publishableKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ email: credentials.email, password: credentials.password }),
    },
  )

  if (!response.ok) {
    throw new OperatorSignInError(response.status, await response.text())
  }

  const session = (await response.json()) as { access_token?: string }
  if (typeof session.access_token !== 'string') {
    throw new OperatorSignInError(response.status, 'resposta sem access_token')
  }
  return session.access_token
}
