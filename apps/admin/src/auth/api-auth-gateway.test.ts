import { fakeLoginFetch, tokenFor } from '../../test/fake-auth-api'
import { MemoryStorage } from '../../test/memory-storage'
import { ApiAuthGateway, AUTH_STORAGE_KEY } from './api-auth-gateway'
import type { OperatorSession } from './operator-session'

const OPERADORA = {
  id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  email: 'operadora@veggiedent.test',
  password: 'senha-correta',
}

function gatewayCom(
  storage: MemoryStorage,
  options: Parameters<typeof fakeLoginFetch>[0] = { operators: [OPERADORA] },
): ApiAuthGateway {
  return new ApiAuthGateway('/api', storage, fakeLoginFetch(options))
}

describe('ApiAuthGateway', () => {
  describe('observeSession', () => {
    it('avisa de imediato, de forma síncrona, que não há sessão quando o armazenamento está vazio', () => {
      const avisos: (OperatorSession | null)[] = []

      gatewayCom(new MemoryStorage()).observeSession((session) => avisos.push(session))

      expect(avisos).toEqual([null])
    })

    it('avisa de imediato a sessão já guardada, sem esperar rede', () => {
      const storage = new MemoryStorage()
      storage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ accessToken: tokenFor(OPERADORA) }))
      const avisos: (OperatorSession | null)[] = []

      gatewayCom(storage).observeSession((session) => avisos.push(session))

      expect(avisos).toEqual([
        { operatorId: OPERADORA.id, operatorEmail: OPERADORA.email, accessToken: tokenFor(OPERADORA) },
      ])
    })

    it('ignora uma sessão guardada em formato ilegível, em vez de quebrar', () => {
      const storage = new MemoryStorage()
      storage.setItem(AUTH_STORAGE_KEY, 'isto não é JSON')
      const avisos: (OperatorSession | null)[] = []

      gatewayCom(storage).observeSession((session) => avisos.push(session))

      expect(avisos).toEqual([null])
    })

    it('para de observar depois de cancelar', async () => {
      const gateway = gatewayCom(new MemoryStorage())
      const avisos: (OperatorSession | null)[] = []

      gateway.observeSession((session) => avisos.push(session))()
      await gateway.signIn(OPERADORA)

      expect(avisos).toEqual([null])
    })
  })

  describe('signIn', () => {
    it('entrega a sessão do operador, decodificada do token, e guarda no armazenamento', async () => {
      const storage = new MemoryStorage()
      const gateway = gatewayCom(storage)
      const avisos: (OperatorSession | null)[] = []
      gateway.observeSession((session) => avisos.push(session))

      await expect(gateway.signIn(OPERADORA)).resolves.toEqual({ ok: true })

      expect(avisos.at(-1)).toEqual({
        operatorId: OPERADORA.id,
        operatorEmail: OPERADORA.email,
        accessToken: tokenFor(OPERADORA),
      })
      expect(JSON.parse(storage.getItem(AUTH_STORAGE_KEY) ?? '{}')).toEqual({
        accessToken: tokenFor(OPERADORA),
      })
    })

    /**
     * O ponto do SDD § C-02: quem tenta entrar não descobre se o e-mail
     * existe. A API já devolve `401` genérico nos dois casos — o adaptador
     * não pode (nem tenta) refinar essa distinção.
     */
    it.each([
      ['e-mail inexistente', 'ninguem@veggiedent.test', OPERADORA.password],
      ['senha errada', OPERADORA.email, 'senha-errada'],
    ])('recusa %s com o mesmo motivo (401 genérico)', async (_caso, email, password) => {
      const gateway = gatewayCom(new MemoryStorage())

      await expect(gateway.signIn({ email, password })).resolves.toEqual({
        ok: false,
        rejection: 'credenciais-invalidas',
      })
    })

    /**
     * Decisão explícita desta tarefa: como o contrato de `POST /api/auth/login`
     * (SDD § D-03) só documenta `200` e `401`, este adaptador trata **qualquer**
     * status diferente de `200` — inclusive um erro de servidor — como
     * `credenciais-invalidas`, não como `indisponivel`. Só a ausência completa
     * de resposta (a chamada de rede falhando antes de qualquer status) conta
     * como indisponibilidade. Difere de propósito do `SupabaseAuthGateway`
     * anterior, que classificava `503`/`429`/rede como indisponibilidade: ali
     * o provedor era externo e podia falhar por conta própria; aqui é a mesma
     * API que o painel já trata como "fora do ar" via outros caminhos
     * (`AdminApiClient.checkAccess`), então login não precisa duplicar essa
     * distinção.
     */
    it('trata um erro de servidor (500) no login como credencial inválida, não indisponibilidade', async () => {
      const semRede: typeof fetch = async () => new Response(null, { status: 500 })
      const gateway = new ApiAuthGateway('/api', new MemoryStorage(), semRede)

      await expect(gateway.signIn(OPERADORA)).resolves.toEqual({
        ok: false,
        rejection: 'credenciais-invalidas',
      })
    })

    it('trata a ausência completa de resposta (falha de rede) como indisponibilidade', async () => {
      const gateway = gatewayCom(new MemoryStorage(), { networkFailure: true })

      await expect(gateway.signIn(OPERADORA)).resolves.toEqual({
        ok: false,
        rejection: 'indisponivel',
      })
    })

    it('trata uma exceção da chamada como indisponibilidade', async () => {
      const explosivo: typeof fetch = () => Promise.reject(new TypeError('fetch failed'))
      const gateway = new ApiAuthGateway('/api', new MemoryStorage(), explosivo)

      await expect(gateway.signIn(OPERADORA)).resolves.toEqual({
        ok: false,
        rejection: 'indisponivel',
      })
    })

    it('trata um 200 sem accessToken utilizável como indisponibilidade', async () => {
      const respostaInesperada: typeof fetch = async () =>
        new Response(JSON.stringify({}), { status: 200 })
      const gateway = new ApiAuthGateway('/api', new MemoryStorage(), respostaInesperada)

      await expect(gateway.signIn(OPERADORA)).resolves.toEqual({
        ok: false,
        rejection: 'indisponivel',
      })
    })
  })

  describe('signOut', () => {
    it('limpa o armazenamento e avisa a ausência de sessão', async () => {
      const storage = new MemoryStorage()
      const gateway = gatewayCom(storage)
      const avisos: (OperatorSession | null)[] = []
      gateway.observeSession((session) => avisos.push(session))
      await gateway.signIn(OPERADORA)

      await gateway.signOut()

      expect(avisos.at(-1)).toBeNull()
      expect(storage.getItem(AUTH_STORAGE_KEY)).toBeNull()
    })

    /**
     * Não há endpoint de logout na API (design stateless, SDD § D-03) — este
     * `signOut` não faz nenhuma chamada de rede, de propósito. Ele nunca falha
     * do lado do painel porque não há nada de externo que possa falhar.
     */
    it('funciona mesmo sem nenhuma sessão para encerrar', async () => {
      const gateway = gatewayCom(new MemoryStorage())

      await expect(gateway.signOut()).resolves.toBeUndefined()
    })
  })

  it('sobrevive a "recarregar a página": uma segunda instância lê a mesma sessão do armazenamento compartilhado', async () => {
    const storage = new MemoryStorage()
    await gatewayCom(storage).signIn(OPERADORA)

    const avisos: (OperatorSession | null)[] = []
    gatewayCom(storage).observeSession((session) => avisos.push(session))

    expect(avisos).toEqual([
      { operatorId: OPERADORA.id, operatorEmail: OPERADORA.email, accessToken: tokenFor(OPERADORA) },
    ])
  })
})
