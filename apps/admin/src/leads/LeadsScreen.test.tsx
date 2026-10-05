import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  CSV_DO_PERIODO,
  FakeLeadsGateway,
  NOME_DO_ARQUIVO,
  leadDeTeste,
} from '../../test/fake-leads-gateway'
import { montarTela } from '../../test/painel-autenticado'
import type { LeadView, LeadsExport } from './leads-gateway'
import { LeadsScreen } from './LeadsScreen'

/**
 * A tela de leads (SDD § C-12).
 *
 * Os três leads abaixo existem para provar o recorte do dia em horário de
 * Brasília: o mais recente foi recebido às 23h de 2 de setembro no fuso do
 * operador, ainda que o banco o guarde como 3 de setembro em UTC. Um filtro que
 * recortasse o dia em UTC o deixaria de fora do dia 2, que é o defeito que o
 * critério pede para não existir.
 */

const ANTIGO = leadDeTeste({
  id: 'aaaaaaaa-0000-4000-8000-000000000001',
  nome: 'Ana Antiga',
  createdAt: '2026-09-01T15:00:00.000Z',
})

const DO_MEIO = leadDeTeste({
  id: 'bbbbbbbb-0000-4000-8000-000000000002',
  nome: 'Bruno Meio',
  createdAt: '2026-09-02T15:00:00.000Z',
})

/** 3 de setembro às 02h em UTC é 2 de setembro às 23h em Brasília. */
const RECENTE = leadDeTeste({
  id: 'cccccccc-0000-4000-8000-000000000003',
  nome: 'Célia Recente',
  createdAt: '2026-09-03T02:00:00.000Z',
})

const TODOS = [ANTIGO, DO_MEIO, RECENTE]

function montarLeads(
  gateway: FakeLeadsGateway,
  download: (file: LeadsExport) => void = () => undefined,
): void {
  montarTela(<LeadsScreen gateway={gateway} download={download} />)
}

/**
 * Os bytes de um `Blob`. Lidos como bytes, e não como texto, porque é
 * exatamente o BOM que precisa ser observado: o decodificador de texto o
 * remove ao ler, e um teste de texto diria que o arquivo está certo mesmo se o
 * painel tivesse perdido os três primeiros bytes pelo caminho.
 */
function lerBytes(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader()
    leitor.onload = () => resolve(new Uint8Array(leitor.result as ArrayBuffer))
    leitor.onerror = () => reject(leitor.error)
    leitor.readAsArrayBuffer(blob)
  })
}

/** Os três bytes do BOM UTF-8, que fazem o Excel em português ler os acentos. */
const BOM_UTF8 = [0xef, 0xbb, 0xbf]

/** Os nomes exibidos, na ordem em que a tabela os desenha. */
async function nomesNaTela(conhecidos: readonly LeadView[] = TODOS): Promise<string[]> {
  const tabela = await screen.findByRole('table')
  return within(tabela)
    .getAllByRole('row')
    .slice(1)
    .map((linha) => linha.textContent ?? '')
    .map((texto) => conhecidos.find((lead) => texto.includes(lead.nome))?.nome ?? texto)
}

async function filtrarPor(de: string, ate: string): Promise<void> {
  await userEvent.clear(screen.getByLabelText('De'))
  await userEvent.type(screen.getByLabelText('De'), de)
  await userEvent.clear(screen.getByLabelText('Até'))
  await userEvent.type(screen.getByLabelText('Até'), ate)
  await userEvent.click(screen.getByRole('button', { name: 'Filtrar' }))
}

describe('Listagem de leads', () => {
  it('lista do mais recente ao mais antigo, mesmo com a resposta fora de ordem', async () => {
    montarLeads(new FakeLeadsGateway({ leads: TODOS }))

    expect(await nomesNaTela()).toEqual(['Célia Recente', 'Bruno Meio', 'Ana Antiga'])
  })

  it('mostra os campos preenchidos pelo visitante e a data de recebimento', async () => {
    montarLeads(new FakeLeadsGateway({ leads: [DO_MEIO] }))

    const linha = (await screen.findAllByRole('row'))[1] as HTMLElement
    const celulas = within(linha).getAllByRole('cell').map((celula) => celula.textContent)
    expect(celulas).toContain('ana@exemplo.com')
    expect(celulas).toContain('11999999999')
    expect(celulas).toContain('Bidu')
    expect(celulas).toContain('São Paulo/SP')
    // T30-e: o rótulo em português do código, não o código bruto.
    expect(celulas).toContain('Médio')
    expect(celulas).toContain('Sim')
    // 2 de setembro às 15h em UTC é meio-dia em Brasília.
    expect(celulas).toContain('02/09/2026, 12:00')
  })

  it('diz quantos leads o período tem', async () => {
    montarLeads(new FakeLeadsGateway({ leads: TODOS }))

    expect(await screen.findByText('3 leads no período.')).toBeInTheDocument()
  })

  it('avisa quando não há nenhum lead no período', async () => {
    montarLeads(new FakeLeadsGateway({ leads: [] }))

    expect(await screen.findByText('Nenhum lead recebido no período.')).toBeInTheDocument()
  })

  it('mostra a recusa da API em vez de uma tabela vazia', async () => {
    montarLeads(new FakeLeadsGateway({ failListWith: 'A API do CMS não respondeu.' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('A API do CMS não respondeu.')
  })

  /**
   * O registro do consentimento LGPD (pedido do cliente de 2026-10-02): o
   * aceite e quando, na célula; o texto aceito e a política, nos detalhes.
   */
  it('mostra o consentimento LGPD, com o texto aceito e a política nos detalhes', async () => {
    montarLeads(new FakeLeadsGateway({ leads: [DO_MEIO] }))

    const linha = (await screen.findAllByRole('row'))[1] as HTMLElement
    const celulas = within(linha).getAllByRole('cell')
    const consentimento = celulas.find((celula) => celula.textContent?.startsWith('Sim — '))
    expect(consentimento).toHaveTextContent('Sim — 03/09/2026, 09:00')

    await userEvent.click(within(consentimento as HTMLElement).getByText(/Ver detalhes/))

    expect(within(consentimento as HTMLElement).getByText('Li e aceito a Política de Privacidade.')).toBeVisible()
    expect(
      within(consentimento as HTMLElement).getByRole('link', {
        name: 'https://br.virbac.com/home/legal-notice.html',
      }),
    ).toHaveAttribute('target', '_blank')
  })
})

describe('Filtro por período (horário de Brasília)', () => {
  it('recorta o conjunto ao período escolhido', async () => {
    montarLeads(new FakeLeadsGateway({ leads: TODOS }))
    await screen.findByRole('table')

    await filtrarPor('2026-09-02', '2026-09-02')

    expect(await nomesNaTela()).toEqual(['Célia Recente', 'Bruno Meio'])
  })

  it('manda à API o dia escolhido, sem converter fuso no painel', async () => {
    const gateway = new FakeLeadsGateway({ leads: TODOS })
    montarLeads(gateway)
    await screen.findByRole('table')

    await filtrarPor('2026-09-02', '2026-09-02')

    expect(gateway.consultas.at(-1)).toEqual({
      from: '2026-09-02',
      to: '2026-09-02',
      email: '',
      page: 1,
    })
  })

  it('devolve o conjunto inteiro ao limpar o filtro', async () => {
    montarLeads(new FakeLeadsGateway({ leads: TODOS }))
    await screen.findByRole('table')
    await filtrarPor('2026-09-02', '2026-09-02')
    expect(await nomesNaTela()).toHaveLength(2)

    await userEvent.click(screen.getByRole('button', { name: 'Limpar filtro' }))

    expect(await nomesNaTela()).toHaveLength(3)
  })
})

/**
 * A busca por e-mail (pedido do cliente de 2026-10-05): o titular pede a
 * exclusão informando o e-mail, e o Marketing precisa achar o lead dele. Os
 * e-mails têm maiúsculas gravadas de propósito — quem atende copia o endereço
 * de uma mensagem, raramente na mesma caixa em que o visitante o digitou.
 */
describe('Busca por e-mail (pedido do titular, LGPD)', () => {
  const MARIA = leadDeTeste({
    id: 'dddddddd-0000-4000-8000-000000000001',
    nome: 'Maria Souza',
    email: 'Maria_Souza@Gmail.com',
    createdAt: '2026-09-01T15:00:00.000Z',
  })
  const MARIA_DE_NOVO = leadDeTeste({
    id: 'dddddddd-0000-4000-8000-000000000002',
    nome: 'Maria S.',
    email: 'maria_souza@gmail.com',
    createdAt: '2026-09-04T15:00:00.000Z',
  })
  const JOAO = leadDeTeste({
    id: 'dddddddd-0000-4000-8000-000000000003',
    nome: 'João Lima',
    email: 'joao@exemplo.com',
    createdAt: '2026-09-05T15:00:00.000Z',
  })
  const COM_EMAILS = [MARIA, MARIA_DE_NOVO, JOAO]

  const campoDeBusca = (): HTMLElement =>
    screen.getByRole('searchbox', { name: 'Buscar por e-mail' })

  async function montarComEmails(
    options: { readonly pageSize?: number } = {},
  ): Promise<FakeLeadsGateway> {
    const gateway = new FakeLeadsGateway({ leads: COM_EMAILS, ...options })
    montarLeads(gateway)
    await screen.findByRole('table')
    return gateway
  }

  it('oferece o campo de busca com rótulo visível, junto do período', async () => {
    await montarComEmails()

    expect(campoDeBusca()).toHaveAttribute('type', 'search')
    expect(screen.getByText('Buscar por e-mail').tagName).toBe('LABEL')
    expect(campoDeBusca().closest('form')).toBe(screen.getByLabelText('De').closest('form'))
  })

  it('aplica a busca ao apertar Enter, sem diferenciar maiúsculas', async () => {
    const gateway = await montarComEmails()

    await userEvent.type(campoDeBusca(), 'MARIA_souza{Enter}')

    expect(await nomesNaTela(COM_EMAILS)).toEqual(['Maria S.', 'Maria Souza'])
    expect(gateway.consultas.at(-1)).toEqual({ from: '', to: '', email: 'MARIA_souza', page: 1 })
    expect(screen.getByRole('status')).toHaveTextContent('2 leads encontrados para este e-mail.')
  })

  it('não busca enquanto o e-mail só está digitado', async () => {
    const gateway = await montarComEmails()

    await userEvent.type(campoDeBusca(), 'joao@')

    expect(gateway.consultas).toHaveLength(1)
    expect(await nomesNaTela(COM_EMAILS)).toHaveLength(3)
  })

  it('o botão Filtrar aplica a busca junto do período', async () => {
    const gateway = await montarComEmails()
    await userEvent.type(campoDeBusca(), 'maria')

    await filtrarPor('2026-09-04', '2026-09-05')

    expect(gateway.consultas.at(-1)).toEqual({
      from: '2026-09-04',
      to: '2026-09-05',
      email: 'maria',
      page: 1,
    })
    expect(await nomesNaTela(COM_EMAILS)).toEqual(['Maria S.'])
    expect(screen.getByRole('status')).toHaveTextContent('1 lead encontrado para este e-mail.')
  })

  it('volta para a primeira página ao mudar a busca', async () => {
    const gateway = await montarComEmails({ pageSize: 2 })
    await userEvent.click(screen.getByRole('button', { name: 'Próxima página' }))
    expect(await nomesNaTela(COM_EMAILS)).toEqual(['Maria Souza'])

    await userEvent.type(campoDeBusca(), '@gmail{Enter}')

    expect(gateway.consultas.at(-1)).toMatchObject({ email: '@gmail', page: 1 })
    expect(await nomesNaTela(COM_EMAILS)).toEqual(['Maria S.', 'Maria Souza'])
  })

  it('Limpar filtro apaga a busca e devolve a lista inteira', async () => {
    const gateway = await montarComEmails()
    await userEvent.type(campoDeBusca(), 'joao{Enter}')
    expect(await nomesNaTela(COM_EMAILS)).toEqual(['João Lima'])

    await userEvent.click(screen.getByRole('button', { name: 'Limpar filtro' }))

    expect(campoDeBusca()).toHaveValue('')
    expect(gateway.consultas.at(-1)).toEqual({ from: '', to: '', email: '', page: 1 })
    expect(await nomesNaTela(COM_EMAILS)).toHaveLength(3)
  })

  it('diz que nenhum lead tem aquele e-mail, e não que o período está vazio', async () => {
    await montarComEmails()

    await userEvent.type(campoDeBusca(), 'ninguem@exemplo.com{Enter}')

    expect(await screen.findByText('Nenhum lead encontrado para este e-mail.')).toBeInTheDocument()
    expect(screen.queryByText('Nenhum lead recebido no período.')).toBeNull()
    expect(screen.queryByRole('table')).toBeNull()
  })

  /** Para quem atende o titular, "não achei" sem a ressalva do período leva a uma resposta errada. */
  it('com período aplicado, avisa que a busca vazia é só naquele período', async () => {
    await montarComEmails()
    await userEvent.type(campoDeBusca(), 'joao@')

    await filtrarPor('2026-09-01', '2026-09-01')

    expect(
      await screen.findByText('Nenhum lead encontrado para este e-mail no período escolhido.'),
    ).toBeInTheDocument()
  })

  it('exporta só os leads da busca aplicada', async () => {
    const gateway = await montarComEmails()
    await userEvent.type(campoDeBusca(), 'maria_souza{Enter}')
    await nomesNaTela(COM_EMAILS)

    await userEvent.click(screen.getByRole('button', { name: 'Exportar CSV do período' }))

    expect(gateway.exportacoes).toEqual([{ from: '', to: '', email: 'maria_souza' }])
  })

  it('exporta a busca aplicada, não a que está digitada sem aplicar', async () => {
    const gateway = await montarComEmails()
    await userEvent.type(campoDeBusca(), 'maria{Enter}')
    await userEvent.type(campoDeBusca(), '_outra')

    await userEvent.click(screen.getByRole('button', { name: 'Exportar CSV do período' }))

    expect(gateway.exportacoes).toEqual([{ from: '', to: '', email: 'maria' }])
  })
})

describe('Exportação em CSV (regra de negócio RN-01)', () => {
  it('exporta com os filtros aplicados na tela', async () => {
    const gateway = new FakeLeadsGateway({ leads: TODOS })
    montarLeads(gateway)
    await screen.findByRole('table')
    await filtrarPor('2026-09-02', '2026-09-02')

    await userEvent.click(screen.getByRole('button', { name: 'Exportar CSV do período' }))

    expect(gateway.exportacoes).toEqual([{ from: '2026-09-02', to: '2026-09-02', email: '' }])
  })

  /**
   * O filtro digitado só vale depois de aplicado: exportar o que está no campo,
   * e não o que a tabela mostra, entregaria um período que o operador não viu.
   */
  it('usa o filtro aplicado, não o que está digitado sem filtrar', async () => {
    const gateway = new FakeLeadsGateway({ leads: TODOS })
    montarLeads(gateway)
    await screen.findByRole('table')
    await filtrarPor('2026-09-01', '2026-09-01')
    await userEvent.type(screen.getByLabelText('Até'), '2026-09-03')

    await userEvent.click(screen.getByRole('button', { name: 'Exportar CSV do período' }))

    expect(gateway.exportacoes).toEqual([{ from: '2026-09-01', to: '2026-09-01', email: '' }])
  })

  it('entrega ao operador exatamente os bytes que a API respondeu', async () => {
    const baixados: LeadsExport[] = []
    montarLeads(new FakeLeadsGateway({ leads: TODOS }), (file) => baixados.push(file))
    await screen.findByRole('table')

    await userEvent.click(screen.getByRole('button', { name: 'Exportar CSV do período' }))

    expect(baixados).toHaveLength(1)
    const arquivo = baixados[0] as LeadsExport
    expect(arquivo.filename).toBe(NOME_DO_ARQUIVO)
    const bytes = await lerBytes(arquivo.content)
    expect([...bytes.slice(0, BOM_UTF8.length)]).toEqual(BOM_UTF8)
    expect(new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes)).toBe(CSV_DO_PERIODO)
  })

  it('não baixa arquivo nenhum quando a API recusa a exportação', async () => {
    const baixados: LeadsExport[] = []
    montarLeads(
      new FakeLeadsGateway({ leads: TODOS, failExportWith: 'A exportação falhou.' }),
      (file) => baixados.push(file),
    )
    await screen.findByRole('table')

    await userEvent.click(screen.getByRole('button', { name: 'Exportar CSV do período' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('A exportação falhou.')
    expect(baixados).toEqual([])
  })
})

describe('Exclusão a pedido do titular (LGPD)', () => {
  it('não exclui no primeiro clique: pede confirmação', async () => {
    const gateway = new FakeLeadsGateway({ leads: TODOS })
    montarLeads(gateway)
    await screen.findByRole('table')

    await userEvent.click(screen.getByRole('button', { name: 'Excluir o lead de Bruno Meio' }))

    expect(gateway.exclusoes).toEqual([])
    expect(await nomesNaTela()).toHaveLength(3)
    expect(screen.getByText('Excluir para sempre? Não há desfazer.')).toBeInTheDocument()
  })

  it('exclui o lead depois da confirmação', async () => {
    const gateway = new FakeLeadsGateway({ leads: TODOS })
    montarLeads(gateway)
    await screen.findByRole('table')
    await userEvent.click(screen.getByRole('button', { name: 'Excluir o lead de Bruno Meio' }))

    await userEvent.click(
      screen.getByRole('button', { name: 'Confirmar a exclusão do lead de Bruno Meio' }),
    )

    expect(gateway.exclusoes).toEqual([DO_MEIO.id])
    expect(await nomesNaTela()).toEqual(['Célia Recente', 'Ana Antiga'])
    expect(await screen.findByText('Lead excluído definitivamente.')).toBeInTheDocument()
  })

  it('desiste sem excluir quando a confirmação é cancelada', async () => {
    const gateway = new FakeLeadsGateway({ leads: TODOS })
    montarLeads(gateway)
    await screen.findByRole('table')
    await userEvent.click(screen.getByRole('button', { name: 'Excluir o lead de Bruno Meio' }))

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(gateway.exclusoes).toEqual([])
    expect(await nomesNaTela()).toHaveLength(3)
  })

  it('mostra a recusa da API e mantém o lead na tela', async () => {
    const gateway = new FakeLeadsGateway({ leads: TODOS, failDeleteWith: 'Lead não encontrado.' })
    montarLeads(gateway)
    await screen.findByRole('table')
    await userEvent.click(screen.getByRole('button', { name: 'Excluir o lead de Bruno Meio' }))

    await userEvent.click(
      screen.getByRole('button', { name: 'Confirmar a exclusão do lead de Bruno Meio' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent('Lead não encontrado.')
    expect(await nomesNaTela()).toHaveLength(3)
  })
})

/**
 * T30-f: a tabela tem 13 colunas, e a de "Ações" (excluir) ficava fora da
 * área visível em telas normais, sem nenhum indício de que havia mais
 * conteúdo à direita. A coluna passou a ser fixa (`position: sticky`).
 */
describe('Coluna de ações fixa (T30-f)', () => {
  it('mantém a coluna "Ações" fixa à direita, no cabeçalho e nas linhas', async () => {
    montarLeads(new FakeLeadsGateway({ leads: [DO_MEIO] }))
    await screen.findByRole('table')

    const cabecalhoAcoes = screen.getByRole('columnheader', { name: 'Ações' })
    expect(cabecalhoAcoes.className).toContain('sticky')
    expect(cabecalhoAcoes.className).toContain('right-0')

    const linha = (await screen.findAllByRole('row'))[1] as HTMLElement
    const celulaAcoes = within(linha).getByRole('button', { name: /Excluir o lead de/ })
      .closest('td') as HTMLElement
    expect(celulaAcoes.className).toContain('sticky')
    expect(celulaAcoes.className).toContain('right-0')
  })
})

describe('Paginação', () => {
  it('não oferece páginas quando tudo cabe em uma', async () => {
    montarLeads(new FakeLeadsGateway({ leads: TODOS }))
    await screen.findByRole('table')

    expect(screen.queryByRole('navigation', { name: 'Páginas de leads' })).toBeNull()
  })

  it('avança e volta uma página, sem passar da última', async () => {
    const gateway = new FakeLeadsGateway({ leads: TODOS, pageSize: 2 })
    montarLeads(gateway)
    await screen.findByRole('table')
    expect(screen.getByText('Página 1 de 2')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Próxima página' }))

    expect(await nomesNaTela()).toEqual(['Ana Antiga'])
    expect(screen.getByRole('button', { name: 'Próxima página' })).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: 'Página anterior' }))

    expect(await nomesNaTela()).toEqual(['Célia Recente', 'Bruno Meio'])
    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeDisabled()
  })
})
