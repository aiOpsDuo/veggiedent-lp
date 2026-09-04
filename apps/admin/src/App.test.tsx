import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { FakeSupabaseAuth, type SessionStorage } from '../test/fake-supabase-auth'
import { AdminApiClient } from './api/admin-api-client'
import { App } from './App'
import type { AuthGateway } from './auth/auth-gateway'
import { SupabaseAuthGateway } from './auth/supabase-auth-gateway'
import { ACTIVATE_PATH } from './routing/paths'

const OPERADORA = {
  id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  email: 'operadora@veggiedent.test',
  password: 'senha-correta',
}

/**
 * As rotas internas do painel. Ficam listadas para que a proteção seja provada
 * em **todas** elas, e não só na primeira: uma tela nova declarada fora da
 * guarda por engano é exatamente o defeito que estes testes existem para pegar.
 */
const ROTAS_INTERNAS = ['/', '/secoes', '/metadados', '/leads'] as const

const ROTA_INTERNA = '/leads'

const ADMIN_SHELL = '[data-testid="area-administrativa"]'

const apiAutorizando = (): AdminApiClient =>
  new AdminApiClient('/api', vi.fn().mockResolvedValue(new Response(null, { status: 200 })))

function gatewayCom(storage: SessionStorage): AuthGateway {
  return new SupabaseAuthGateway(
    new FakeSupabaseAuth({ operators: [OPERADORA], storage }),
  )
}

function renderPainel(gateway: AuthGateway, caminhoInicial = '/'): void {
  render(
    <MemoryRouter initialEntries={[caminhoInicial]}>
      <App authGateway={gateway} apiClient={apiAutorizando()} />
    </MemoryRouter>,
  )
}

/**
 * Observador que registra se a área administrativa **chegou a existir** no
 * documento, ainda que por um único quadro.
 *
 * Uma verificação depois que a tela assenta não serve para o critério C-01: uma
 * guarda que renderizasse o painel enquanto ainda verifica a sessão, e só
 * depois redirigisse, passaria por ela. Registrar cada nó inserido pega o
 * piscar, porque um nó inserido e removido em seguida deixa registro.
 */
function vigiarAreaAdministrativa(): { apareceu: () => boolean; parar: () => void } {
  let apareceu = false
  const inspecionar = (records: MutationRecord[]): void => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (
          node instanceof Element &&
          (node.matches(ADMIN_SHELL) || node.querySelector(ADMIN_SHELL) !== null)
        ) {
          apareceu = true
        }
      }
    }
  }
  const observer = new MutationObserver(inspecionar)
  observer.observe(document.body, { childList: true, subtree: true })
  return {
    apareceu: () => {
      inspecionar(observer.takeRecords())
      return apareceu
    },
    parar: () => observer.disconnect(),
  }
}

async function entrar(email: string, senha: string): Promise<void> {
  await userEvent.type(await screen.findByLabelText('E-mail'), email)
  await userEvent.type(screen.getByLabelText('Senha'), senha)
  await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
}

describe('Proteção de rota (SDD § C-01)', () => {
  it.each(ROTAS_INTERNAS)('leva ao login quem abre %s sem sessão', async (rota) => {
    const vigia = vigiarAreaAdministrativa()

    renderPainel(gatewayCom(new Map()), rota)

    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeInTheDocument()
    expect(vigia.apareceu()).toBe(false)
    vigia.parar()
  })

  it.each(ROTAS_INTERNAS)(
    'não renderiza a área administrativa em %s enquanto a sessão não é confirmada',
    async (rota) => {
      const vigia = vigiarAreaAdministrativa()

      renderPainel(gatewayCom(new Map()), rota)

      expect(screen.getByRole('status')).toHaveTextContent('Verificando sessão')
      expect(vigia.apareceu()).toBe(false)
      await screen.findByRole('button', { name: 'Entrar' })
      expect(vigia.apareceu()).toBe(false)
      vigia.parar()
    },
  )

  it.each(ROTAS_INTERNAS)('deixa o operador com sessão entrar em %s', async (rota) => {
    const storage: SessionStorage = new Map()
    renderPainel(gatewayCom(storage), rota)
    await entrar(OPERADORA.email, OPERADORA.password)

    expect(await screen.findByTestId('area-administrativa')).toBeInTheDocument()
  })
})

describe('Sessão (SDD § C-02)', () => {
  it('identifica o operador no cabeçalho', async () => {
    renderPainel(gatewayCom(new Map()))

    await entrar(OPERADORA.email, OPERADORA.password)

    expect(await screen.findByText(OPERADORA.email)).toBeInTheDocument()
  })

  it('sobrevive a recarregar a página', async () => {
    const storage: SessionStorage = new Map()
    renderPainel(gatewayCom(storage))
    await entrar(OPERADORA.email, OPERADORA.password)
    await screen.findByTestId('area-administrativa')

    cleanup()
    renderPainel(gatewayCom(storage), ROTA_INTERNA)

    expect(await screen.findByTestId('area-administrativa')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Entrar' })).toBeNull()
  })

  it('invalida o acesso ao sair', async () => {
    const storage: SessionStorage = new Map()
    renderPainel(gatewayCom(storage))
    await entrar(OPERADORA.email, OPERADORA.password)
    await screen.findByTestId('area-administrativa')

    await userEvent.click(screen.getByRole('button', { name: 'Sair' }))

    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeInTheDocument()
    expect(screen.queryByTestId('area-administrativa')).toBeNull()
  })

  it('não deixa voltar à rota interna depois de sair', async () => {
    const storage: SessionStorage = new Map()
    renderPainel(gatewayCom(storage))
    await entrar(OPERADORA.email, OPERADORA.password)
    await screen.findByTestId('area-administrativa')
    await userEvent.click(screen.getByRole('button', { name: 'Sair' }))
    await screen.findByRole('button', { name: 'Entrar' })

    cleanup()
    const vigia = vigiarAreaAdministrativa()
    renderPainel(gatewayCom(storage), ROTA_INTERNA)

    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeInTheDocument()
    expect(vigia.apareceu()).toBe(false)
    vigia.parar()
  })

  /**
   * As duas recusas precisam ser indistinguíveis para quem está do lado de fora
   * — inclusive no texto que chega ao DOM. O dublê devolve mensagens diferentes
   * para os dois casos justamente para que um vazamento apareça aqui.
   */
  it('recusa e-mail inexistente e senha errada com a mesma mensagem', async () => {
    const mensagens: string[] = []

    for (const [email, senha] of [
      ['ninguem@veggiedent.test', OPERADORA.password],
      [OPERADORA.email, 'senha-errada'],
    ]) {
      renderPainel(gatewayCom(new Map()))
      await entrar(email, senha)
      mensagens.push((await screen.findByRole('alert')).textContent ?? '')
      expect(document.body.textContent).not.toMatch(/User not found|Invalid login/i)
      cleanup()
    }

    expect(mensagens[0]).toBe('E-mail ou senha inválidos.')
    expect(mensagens[1]).toBe(mensagens[0])
  })

  it('distingue serviço indisponível de credencial inválida', async () => {
    const auth = new FakeSupabaseAuth({
      operators: [OPERADORA],
      signInFailure: { status: 503, message: 'service unavailable' },
    })
    render(
      <MemoryRouter>
        <App authGateway={new SupabaseAuthGateway(auth)} apiClient={apiAutorizando()} />
      </MemoryRouter>,
    )

    await entrar(OPERADORA.email, OPERADORA.password)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível falar com o serviço de autenticação.',
    )
  })
})

/**
 * A tela de ativação (SDD § D-09, § C-13): o defeito real que esta suíte
 * prova corrigido — antes, o link de convite não levava a lugar nenhum.
 *
 * `window.location.hash` é ajustado diretamente, porque é assim que o link de
 * convite entrega os tokens numa navegação de verdade — o `MemoryRouter` não
 * toca nele, e o componente lê do objeto do navegador, não do roteador.
 */
describe('Ativação de convite (SDD § D-09)', () => {
  const ATIVACAO = {
    accessToken: 'token-de-acesso-do-convite',
    refreshToken: 'token-de-renovacao-do-convite',
    operator: OPERADORA,
  }

  afterEach(() => {
    window.location.hash = ''
  })

  function renderAtivacao(auth: FakeSupabaseAuth): void {
    render(
      <MemoryRouter initialEntries={[ACTIVATE_PATH]}>
        <App authGateway={new SupabaseAuthGateway(auth)} apiClient={apiAutorizando()} />
      </MemoryRouter>,
    )
  }

  it('com token válido, define a senha e entra no painel já autenticado', async () => {
    window.location.hash = `#access_token=${ATIVACAO.accessToken}&refresh_token=${ATIVACAO.refreshToken}&type=invite`
    renderAtivacao(new FakeSupabaseAuth({ activation: ATIVACAO }))

    await userEvent.type(await screen.findByLabelText('Senha'), 'senha-nova-e-forte')
    await userEvent.type(screen.getByLabelText('Confirme a senha'), 'senha-nova-e-forte')
    await userEvent.click(screen.getByRole('button', { name: 'Definir senha e entrar' }))

    expect(await screen.findByTestId('area-administrativa')).toBeInTheDocument()
    expect(await screen.findByText(OPERADORA.email)).toBeInTheDocument()
  })

  it('recusa senhas que não coincidem, sem chamar o servidor', async () => {
    window.location.hash = `#access_token=${ATIVACAO.accessToken}&refresh_token=${ATIVACAO.refreshToken}&type=invite`
    renderAtivacao(new FakeSupabaseAuth({ activation: ATIVACAO }))

    await userEvent.type(await screen.findByLabelText('Senha'), 'senha-nova-e-forte')
    await userEvent.type(screen.getByLabelText('Confirme a senha'), 'outra-senha')
    await userEvent.click(screen.getByRole('button', { name: 'Definir senha e entrar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('As senhas não coincidem.')
    expect(screen.queryByTestId('area-administrativa')).toBeNull()
  })

  it('sem tokens no link, mostra um erro claro sem quebrar a tela', async () => {
    window.location.hash = ''
    renderAtivacao(new FakeSupabaseAuth())

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Este link de ativação é inválido ou já expirou.',
    )
    expect(screen.queryByLabelText('Senha')).toBeNull()
    expect(screen.queryByTestId('area-administrativa')).toBeNull()
  })

  it('com tokens que o servidor não reconhece, mostra o mesmo erro do link inválido', async () => {
    window.location.hash = '#access_token=token-de-um-convite-ja-usado&refresh_token=algo&type=invite'
    renderAtivacao(new FakeSupabaseAuth({ activation: ATIVACAO }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Este link de ativação é inválido ou já expirou.',
    )
    expect(document.body.textContent).not.toMatch(/Invalid Refresh Token/i)
  })
})
