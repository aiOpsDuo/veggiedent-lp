import { FakeSupabaseAuth } from '../../test/fake-supabase-auth'
import type { OperatorSession } from './operator-session'
import {
  ADMIN_AUTH_OPTIONS,
  SupabaseAuthGateway,
  type SupabaseAuthApi,
} from './supabase-auth-gateway'

const OPERADORA = {
  id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  email: 'operadora@veggiedent.test',
  password: 'senha-correta',
}

const nextSession = (gateway: SupabaseAuthGateway): Promise<OperatorSession | null> =>
  new Promise((resolve) => {
    const stop = gateway.observeSession((session) => {
      stop()
      resolve(session)
    })
  })

describe('ADMIN_AUTH_OPTIONS', () => {
  /**
   * Estas duas opções são o mecanismo inteiro da sessão persistente exigida
   * pelo SDD § C-02: sem `persistSession` a sessão morre ao recarregar; sem
   * `autoRefreshToken` ela morre quando o token expira, no meio de uma edição.
   */
  it('mantém a sessão entre recarregamentos e renova o token', () => {
    expect(ADMIN_AUTH_OPTIONS.persistSession).toBe(true)
    expect(ADMIN_AUTH_OPTIONS.autoRefreshToken).toBe(true)
  })

  it('não lê sessão da URL, porque o painel só entra por e-mail e senha', () => {
    expect(ADMIN_AUTH_OPTIONS.detectSessionInUrl).toBe(false)
  })
})

describe('SupabaseAuthGateway', () => {
  it('avisa que não há sessão quando o armazenamento está vazio', async () => {
    const gateway = new SupabaseAuthGateway(new FakeSupabaseAuth())

    await expect(nextSession(gateway)).resolves.toBeNull()
  })

  it('entrega a sessão do operador depois do login', async () => {
    const gateway = new SupabaseAuthGateway(
      new FakeSupabaseAuth({ operators: [OPERADORA] }),
    )
    const avisos: (OperatorSession | null)[] = []
    gateway.observeSession((session) => avisos.push(session))

    await expect(
      gateway.signIn({ email: OPERADORA.email, password: OPERADORA.password }),
    ).resolves.toEqual({ ok: true })

    expect(avisos).toContainEqual({
      operatorId: OPERADORA.id,
      operatorEmail: OPERADORA.email,
      accessToken: `token-de-${OPERADORA.id}`,
    })
  })

  it('avisa a ausência de sessão ao sair', async () => {
    const auth = new FakeSupabaseAuth({ operators: [OPERADORA] })
    const gateway = new SupabaseAuthGateway(auth)
    const avisos: (OperatorSession | null)[] = []
    gateway.observeSession((session) => avisos.push(session))
    await gateway.signIn({ email: OPERADORA.email, password: OPERADORA.password })

    await gateway.signOut()

    expect(avisos.at(-1)).toBeNull()
    expect(auth.storage.size).toBe(0)
  })

  it('para de observar depois de cancelar', async () => {
    const auth = new FakeSupabaseAuth({ operators: [OPERADORA] })
    const gateway = new SupabaseAuthGateway(auth)
    const avisos: (OperatorSession | null)[] = []

    gateway.observeSession((session) => avisos.push(session))()
    await gateway.signIn({ email: OPERADORA.email, password: OPERADORA.password })

    expect(avisos).toHaveLength(0)
  })

  /**
   * O ponto do SDD § C-02: quem tenta entrar não descobre se o e-mail existe.
   * O dublê devolve mensagens **diferentes** para "e-mail inexistente" e "senha
   * errada" de propósito — se o adaptador algum dia repassar a distinção, é aqui
   * que aparece, e não na tela de login de produção.
   */
  it.each([
    ['e-mail inexistente', 'ninguem@veggiedent.test', OPERADORA.password],
    ['senha errada', OPERADORA.email, 'senha-errada'],
  ])('recusa %s com o mesmo motivo', async (_caso, email, password) => {
    const gateway = new SupabaseAuthGateway(
      new FakeSupabaseAuth({ operators: [OPERADORA] }),
    )

    await expect(gateway.signIn({ email, password })).resolves.toEqual({
      ok: false,
      rejection: 'credenciais-invalidas',
    })
  })

  it.each([
    ['serviço fora do ar', 503],
    ['limite de tentativas', 429],
    ['rede indisponível', 0],
  ])('não chama de credencial inválida uma falha de %s', async (_caso, status) => {
    const gateway = new SupabaseAuthGateway(
      new FakeSupabaseAuth({ signInFailure: { status, message: 'falha' } }),
    )

    await expect(
      gateway.signIn({ email: OPERADORA.email, password: OPERADORA.password }),
    ).resolves.toEqual({ ok: false, rejection: 'indisponivel' })
  })

  it('trata uma exceção do cliente como indisponibilidade', async () => {
    const explosivo: SupabaseAuthApi = {
      signInWithPassword: () => Promise.reject(new TypeError('fetch failed')),
      signOut: () => Promise.resolve({ error: null }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => undefined } },
      }),
      setSession: () => Promise.resolve({ error: null }),
      updateUser: () => Promise.resolve({ error: null }),
    }

    await expect(
      new SupabaseAuthGateway(explosivo).signIn({
        email: OPERADORA.email,
        password: OPERADORA.password,
      }),
    ).resolves.toEqual({ ok: false, rejection: 'indisponivel' })
  })

  it('sai mesmo quando o servidor falha ao invalidar o token', async () => {
    const recusaSair: SupabaseAuthApi = {
      signInWithPassword: () => Promise.resolve({ error: null }),
      signOut: () => Promise.reject(new Error('falha ao invalidar')),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => undefined } },
      }),
      setSession: () => Promise.resolve({ error: null }),
      updateUser: () => Promise.resolve({ error: null }),
    }

    await expect(new SupabaseAuthGateway(recusaSair).signOut()).resolves.toBeUndefined()
  })

  /** SDD § D-09: o link de convite estabelece sessão a partir dos tokens do fragmento. */
  describe('activate', () => {
    const ATIVACAO = {
      accessToken: 'token-de-acesso-do-convite',
      refreshToken: 'token-de-renovacao-do-convite',
      operator: OPERADORA,
    }

    it('estabelece a sessão e avisa quem observa, com o par de tokens correto', async () => {
      const gateway = new SupabaseAuthGateway(
        new FakeSupabaseAuth({ activation: ATIVACAO }),
      )
      const avisos: (OperatorSession | null)[] = []
      gateway.observeSession((session) => avisos.push(session))

      await expect(
        gateway.activate({
          accessToken: ATIVACAO.accessToken,
          refreshToken: ATIVACAO.refreshToken,
        }),
      ).resolves.toEqual({ ok: true })

      expect(avisos).toContainEqual({
        operatorId: OPERADORA.id,
        operatorEmail: OPERADORA.email,
        accessToken: ATIVACAO.accessToken,
      })
    })

    it('recusa com link-invalido um par de tokens que não confere', async () => {
      const gateway = new SupabaseAuthGateway(
        new FakeSupabaseAuth({ activation: ATIVACAO }),
      )

      await expect(
        gateway.activate({ accessToken: 'errado', refreshToken: 'errado' }),
      ).resolves.toEqual({ ok: false, rejection: 'link-invalido' })
    })

    it('recusa com link-invalido quando nenhum convite foi configurado', async () => {
      const gateway = new SupabaseAuthGateway(new FakeSupabaseAuth())

      await expect(
        gateway.activate({ accessToken: 'qualquer', refreshToken: 'qualquer' }),
      ).resolves.toEqual({ ok: false, rejection: 'link-invalido' })
    })

    it('trata uma exceção do cliente como link inválido', async () => {
      const explosivo: SupabaseAuthApi = {
        signInWithPassword: () => Promise.resolve({ error: null }),
        signOut: () => Promise.resolve({ error: null }),
        onAuthStateChange: () => ({
          data: { subscription: { unsubscribe: () => undefined } },
        }),
        setSession: () => Promise.reject(new TypeError('fetch failed')),
        updateUser: () => Promise.resolve({ error: null }),
      }

      await expect(
        new SupabaseAuthGateway(explosivo).activate({
          accessToken: 'x',
          refreshToken: 'y',
        }),
      ).resolves.toEqual({ ok: false, rejection: 'link-invalido' })
    })
  })

  describe('setPassword', () => {
    it('salva a senha de quem já está autenticado', async () => {
      const auth = new FakeSupabaseAuth({
        activation: {
          accessToken: 'token-de-acesso-do-convite',
          refreshToken: 'token-de-renovacao-do-convite',
          operator: OPERADORA,
        },
      })
      const gateway = new SupabaseAuthGateway(auth)
      await gateway.activate({
        accessToken: 'token-de-acesso-do-convite',
        refreshToken: 'token-de-renovacao-do-convite',
      })

      await expect(gateway.setPassword('senha-nova-e-forte')).resolves.toEqual({ ok: true })
    })

    it('recusa com indisponivel quando o servidor falha ao salvar', async () => {
      const gateway = new SupabaseAuthGateway(
        new FakeSupabaseAuth({ updateUserFailure: { status: 500, message: 'falha' } }),
      )

      await expect(gateway.setPassword('senha-nova-e-forte')).resolves.toEqual({
        ok: false,
        rejection: 'indisponivel',
      })
    })

    it('trata uma exceção do cliente como indisponibilidade', async () => {
      const explosivo: SupabaseAuthApi = {
        signInWithPassword: () => Promise.resolve({ error: null }),
        signOut: () => Promise.resolve({ error: null }),
        onAuthStateChange: () => ({
          data: { subscription: { unsubscribe: () => undefined } },
        }),
        setSession: () => Promise.resolve({ error: null }),
        updateUser: () => Promise.reject(new TypeError('fetch failed')),
      }

      await expect(
        new SupabaseAuthGateway(explosivo).setPassword('senha-nova-e-forte'),
      ).resolves.toEqual({ ok: false, rejection: 'indisponivel' })
    })
  })
})
