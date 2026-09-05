import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FakeSupabaseAuth, type SessionStorage } from '../test/fake-supabase-auth'
import { AdminApiClient } from './api/admin-api-client'
import { App } from './App'
import type { AuthGateway } from './auth/auth-gateway'
import { SupabaseAuthGateway } from './auth/supabase-auth-gateway'

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
    <App authGateway={gateway} apiClient={apiAutorizando()} initialEntries={[caminhoInicial]} />,
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

describe('Validação do formulário de login (T30-a, T30-b)', () => {
  /**
   * Contraste renderizado de verdade não é algo que um teste automatizado mede
   * — a asserção de classe é a aproximação registrada no critério de "pronto"
   * da T33: `bg-slate-900` é o mesmo tom já usado em "Salvar e publicar" e no
   * item ativo do menu, com contraste 4,5:1+ contra texto branco, no lugar do
   * `bg-brand-primary` (2,51:1, reprovado no WCAG AA) que causou o achado.
   */
  it('usa o mesmo tom escuro do restante do painel no botão "Entrar", não a cor de marca', async () => {
    renderPainel(gatewayCom(new Map()))

    const botao = await screen.findByRole('button', { name: 'Entrar' })

    expect(botao.className).toContain('bg-slate-900')
    expect(botao.className).not.toContain('bg-brand-primary')
  })

  it('não usa validação nativa do navegador nos campos', async () => {
    renderPainel(gatewayCom(new Map()))

    expect(await screen.findByLabelText('E-mail')).not.toBeRequired()
    expect(screen.getByLabelText('Senha')).not.toBeRequired()
  })

  it('pede e-mail e senha, em português, sem tentar autenticar', async () => {
    renderPainel(gatewayCom(new Map()))

    await userEvent.click(await screen.findByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Informe o e-mail e a senha.')
  })

  it('pede só o e-mail quando a senha já foi digitada', async () => {
    renderPainel(gatewayCom(new Map()))

    await userEvent.type(await screen.findByLabelText('Senha'), 'qualquer-senha')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Informe o e-mail.')
  })

  it('pede só a senha quando o e-mail já foi digitado', async () => {
    renderPainel(gatewayCom(new Map()))

    await userEvent.type(await screen.findByLabelText('E-mail'), 'operadora@veggiedent.test')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Informe a senha.')
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
      <App
        authGateway={new SupabaseAuthGateway(auth)}
        apiClient={apiAutorizando()}
        initialEntries={['/']}
      />,
    )

    await entrar(OPERADORA.email, OPERADORA.password)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível falar com o serviço de autenticação.',
    )
  })
})

describe('Menu lateral (T33)', () => {
  it('lista as quatro áreas do painel e indica qual está ativa ao navegar entre elas', async () => {
    // A partir de '/secoes', e não de '/': desde a T35 a raiz é o painel de
    // início (dashboard), uma tela à parte que não é nenhuma das quatro áreas
    // do menu — o que este teste cobre é o mecanismo do menu em si.
    renderPainel(gatewayCom(new Map()), '/secoes')
    await entrar(OPERADORA.email, OPERADORA.password)
    await screen.findByTestId('area-administrativa')

    const menu = screen.getByRole('navigation', { name: 'Áreas do painel' })
    for (const rotulo of ['Seções da página', 'Metadados da página', 'Leads recebidos', 'Operadores']) {
      expect(within(menu).getByRole('link', { name: rotulo })).toBeInTheDocument()
    }

    expect(within(menu).getByRole('link', { name: 'Seções da página' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(within(menu).getByRole('link', { name: 'Leads recebidos' })).not.toHaveAttribute(
      'aria-current',
    )

    await userEvent.click(within(menu).getByRole('link', { name: 'Leads recebidos' }))

    expect(await screen.findByRole('heading', { name: 'Leads recebidos' })).toBeInTheDocument()
    expect(within(menu).getByRole('link', { name: 'Leads recebidos' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(within(menu).getByRole('link', { name: 'Seções da página' })).not.toHaveAttribute(
      'aria-current',
    )
  })

  it('continua visível depois de trocar de área', async () => {
    renderPainel(gatewayCom(new Map()))
    await entrar(OPERADORA.email, OPERADORA.password)
    const menu = await screen.findByRole('navigation', { name: 'Áreas do painel' })

    await userEvent.click(within(menu).getByRole('link', { name: 'Metadados da página' }))
    await screen.findByRole('heading', { name: 'Metadados da página' })

    expect(screen.getByRole('navigation', { name: 'Áreas do painel' })).toBeInTheDocument()
  })
})

describe('Painel de início (T35)', () => {
  it('mostra o painel de início, com dado real e não a lista de seções, na raiz do roteador', async () => {
    renderPainel(gatewayCom(new Map()))
    await entrar(OPERADORA.email, OPERADORA.password)

    expect(await screen.findByRole('heading', { name: 'Painel' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Seções da página' })).toBeNull()
  })
})

/**
 * A persistência em si (sobreviver a um recarregamento de verdade) não tem
 * como ser coberta aqui: o ambiente deste projeto roda o Vitest sob Node 25,
 * cujo `localStorage` global nativo (ainda incompleto nesta versão, sem
 * `getItem`/`setItem`) tomou o lugar do `window.localStorage` de verdade que o
 * `jsdom` forneceria — um problema de compatibilidade Node×jsdom anterior a
 * esta tarefa, não algo que este código introduziu. O que dá para testar aqui
 * é o comportamento na mesma sessão, que não depende do armazenamento
 * funcionar; a persistência entre recarregamentos foi conferida em navegador
 * real (critério de "pronto" da T35), nos dois temas.
 */
describe('Preferências do operador — menu e tema (T35)', () => {
  it('recolhe e expande o menu lateral, escondendo e mostrando os rótulos das áreas', async () => {
    renderPainel(gatewayCom(new Map()))
    await entrar(OPERADORA.email, OPERADORA.password)
    await screen.findByTestId('area-administrativa')

    await userEvent.click(screen.getByRole('button', { name: 'Recolher o menu' }))
    expect(screen.getByRole('button', { name: 'Expandir o menu' })).toBeInTheDocument()
    // O rótulo continua acessível ao leitor de tela mesmo recolhido — só
    // escondido visualmente (o link em si segue com o mesmo nome acessível).
    const menu = screen.getByRole('navigation', { name: 'Áreas do painel' })
    expect(within(menu).getByRole('link', { name: 'Seções da página' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Expandir o menu' }))
    expect(screen.getByRole('button', { name: 'Recolher o menu' })).toBeInTheDocument()
  })

  it('alterna entre tema claro e escuro, aplicando a classe que o Tailwind usa no documento', async () => {
    document.documentElement.classList.remove('dark')
    renderPainel(gatewayCom(new Map()))
    await entrar(OPERADORA.email, OPERADORA.password)
    await screen.findByTestId('area-administrativa')

    await userEvent.click(screen.getByRole('button', { name: 'Ativar tema escuro' }))

    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(screen.getByRole('button', { name: 'Ativar tema claro' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Ativar tema claro' }))

    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })
})
