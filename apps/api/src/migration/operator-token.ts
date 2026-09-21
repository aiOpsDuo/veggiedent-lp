/**
 * Obtenção do token de operador que a carga usa nas rotas administrativas.
 *
 * A guarda global da API nega por padrão (SDD § C-01), e a carga não é
 * exceção: ela escreve como um operador escreveria, com um token de verdade. O
 * token pode vir pronto (`CMS_ACCESS_TOKEN`) ou ser trocado aqui por e-mail e
 * senha de um operador já existente, via `POST /api/auth/login` (SDD § D-03)
 * — a mesma troca que o painel faz no login, e o mesmo endpoint, só que
 * chamado direto por `fetch` em vez de por `CmsApi` (`cms-api.ts`), que esta
 * carga só instancia depois de já ter o token em mãos.
 */

export interface OperatorCredentials {
  /** Raiz da API, com o prefixo. Ex.: `http://localhost:3000/api`. */
  readonly apiBaseUrl: string
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
  const response = await fetch(`${credentials.apiBaseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: credentials.email, password: credentials.password }),
  })

  if (!response.ok) {
    throw new OperatorSignInError(response.status, await response.text())
  }

  const session = (await response.json()) as { accessToken?: string }
  if (typeof session.accessToken !== 'string') {
    throw new OperatorSignInError(response.status, 'resposta sem accessToken')
  }
  return session.accessToken
}
