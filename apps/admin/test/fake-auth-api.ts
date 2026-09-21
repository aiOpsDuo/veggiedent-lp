/**
 * Dublê de `POST /api/auth/login` para os testes do painel — a rede inteira
 * do login mora aqui, e só aqui. Tudo que os testes exercitam acima dele
 * (`ApiAuthGateway`, o provedor, a guarda, o roteador, as telas) é o código
 * de produção. Substitui `fake-supabase-auth.ts`.
 */
export interface FakeOperator {
  readonly id: string
  readonly email: string
  readonly password: string
}

function base64UrlEncode(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Um JWT que basta ao painel: cabeçalho e "assinatura" são só texto de
 * enfeite — o adaptador só lê o payload, sem verificar a assinatura (quem
 * verifica de verdade é a API real; ver o comentário em `api-auth-gateway.ts`
 * sobre essa limitação, deliberada).
 */
export function tokenFor(operator: FakeOperator): string {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = base64UrlEncode(JSON.stringify({ sub: operator.id, email: operator.email }))
  return `${header}.${payload}.assinatura-de-teste`
}

export interface FakeLoginApiOptions {
  readonly operators?: readonly FakeOperator[]
  /** Quando `true`, toda tentativa de login rejeita como se a rede tivesse caído. */
  readonly networkFailure?: boolean
}

/**
 * Um `fetch` que só entende `POST .../auth/login`, no mesmo contrato do SDD §
 * D-03: `200 { accessToken, expiresInSeconds }` para credenciais que batem
 * com algum operador da lista, `401` genérico para qualquer outro caso — sem
 * distinguir e-mail inexistente de senha errada, porque a API real também
 * não distingue.
 */
export function fakeLoginFetch(options: FakeLoginApiOptions = {}): typeof fetch {
  const operators = options.operators ?? []
  return (async (_input, init) => {
    if (options.networkFailure === true) {
      throw new TypeError('Failed to fetch')
    }
    const body = JSON.parse(String(init?.body ?? '{}')) as { email?: string; password?: string }
    const operator = operators.find(
      (each) => each.email === body.email && each.password === body.password,
    )
    if (operator === undefined) {
      return new Response(JSON.stringify({ error: 'E-mail ou senha inválidos.' }), { status: 401 })
    }
    return new Response(
      JSON.stringify({ accessToken: tokenFor(operator), expiresInSeconds: 3600 }),
      { status: 200 },
    )
  }) as typeof fetch
}
