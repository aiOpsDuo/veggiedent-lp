import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  CSV_DO_PERIODO,
  FakeLeadsGateway,
  NOME_DO_ARQUIVO,
  leadDeTeste,
} from '../../test/fake-leads-gateway'
import { montarTela } from '../../test/painel-autenticado'
import type { LeadsExport } from './leads-gateway'
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
async function nomesNaTela(): Promise<string[]> {
  const tabela = await screen.findByRole('table')
  return within(tabela)
    .getAllByRole('row')
    .slice(1)
    .map((linha) => linha.textContent ?? '')
    .map((texto) => TODOS.find((lead) => texto.includes(lead.nome))?.nome ?? texto)
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
    expect(celulas).toContain('sim')
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
   * A coluna de aceite da Política de Privacidade não existe, e não por
   * esquecimento: sem consentimento nenhum lead é gravado, então ela só poderia
   * dizer "sim" (ver `agent_context/CHANGELOG.md`, 2026-09-02).
   */
  it('não tem coluna de aceite da Política de Privacidade', async () => {
    montarLeads(new FakeLeadsGateway({ leads: TODOS }))
    await screen.findByRole('table')

    const cabecalhos = screen.getAllByRole('columnheader').map((cabecalho) => cabecalho.textContent)
    expect(cabecalhos).not.toContain('Aceite LGPD')
    expect(document.body.textContent).not.toMatch(/LGPD/)
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

    expect(gateway.consultas.at(-1)).toEqual({ from: '2026-09-02', to: '2026-09-02', page: 1 })
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

describe('Exportação em CSV (regra de negócio RN-01)', () => {
  it('exporta com os filtros aplicados na tela', async () => {
    const gateway = new FakeLeadsGateway({ leads: TODOS })
    montarLeads(gateway)
    await screen.findByRole('table')
    await filtrarPor('2026-09-02', '2026-09-02')

    await userEvent.click(screen.getByRole('button', { name: 'Exportar CSV do período' }))

    expect(gateway.exportacoes).toEqual([{ from: '2026-09-02', to: '2026-09-02' }])
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

    expect(gateway.exportacoes).toEqual([{ from: '2026-09-01', to: '2026-09-01' }])
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
