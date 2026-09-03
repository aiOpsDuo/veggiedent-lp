import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { getSectionSchema } from '@veggiedent/content-schema'
import { FakeSectionsGateway } from '../../test/fake-sections-gateway'
import { montarTela } from '../../test/painel-autenticado'
import { SAVED_MESSAGE, UNPUBLISHED_MESSAGE } from './editor-state'
import { SectionEditorScreen } from './SectionEditorScreen'
import { SECTION_EDITOR_ROUTE } from '../routing/paths'

const faq = getSectionSchema('faq')
const hero = getSectionSchema('hero')

const PERGUNTAS = [
  { question: 'Primeira', answer: 'Resposta 1', ordem: 0, visivel: true },
  { question: 'Segunda', answer: 'Resposta 2', ordem: 1, visivel: true },
  { question: 'Terceira', answer: 'Resposta 3', ordem: 2, visivel: true },
]

const DOCUMENTO_DO_FAQ = { heading: 'Perguntas frequentes', items: PERGUNTAS }

const IMAGEM_DA_ABERTURA = '11111111-2222-3333-4444-555555555555'

const DOCUMENTO_DA_ABERTURA = {
  overline: 'Chapéu',
  headline: 'Título',
  subheadline: 'Apoio',
  ctaPrimaryLabel: 'Quero o guia',
  ctaSecondaryLabel: 'Ver a rotina',
  image: IMAGEM_DA_ABERTURA,
  imageAlt: 'Cão feliz',
}

function abrir(gateway: FakeSectionsGateway, chave: string): void {
  montarTela(<SectionEditorScreen gateway={gateway} />, {
    routePattern: SECTION_EDITOR_ROUTE,
    initialPath: `/secoes/${chave}`,
  })
}

async function abrirFaq(gateway: FakeSectionsGateway): Promise<void> {
  abrir(gateway, 'faq')
  await screen.findByLabelText('Título da seção')
}

const salvar = async (): Promise<void> => {
  await userEvent.click(screen.getByRole('button', { name: 'Salvar e publicar' }))
}

const perguntasNaTela = (): string[] =>
  screen.getAllByLabelText('Pergunta').map((campo) => (campo as HTMLInputElement).value)

function gatewayComFaq(
  extras: ConstructorParameters<typeof FakeSectionsGateway>[0] = {},
): FakeSectionsGateway {
  return new FakeSectionsGateway({ ...extras, documents: { faq: DOCUMENTO_DO_FAQ } })
}

describe('Formulário gerado a partir do esquema (SDD § D-02, C-04)', () => {
  it('mostra todos os campos declarados no esquema da seção', async () => {
    await abrirFaq(gatewayComFaq())

    for (const spec of faq.fields) {
      expect(screen.getByLabelText(spec.label)).toBeInTheDocument()
    }
    for (const spec of faq.lists[0].itemFields) {
      expect(screen.getAllByLabelText(spec.label)).toHaveLength(PERGUNTAS.length)
    }
  })

  it('mostra o texto de ajuda do esquema como descrição do campo', async () => {
    await abrirFaq(gatewayComFaq())

    expect(screen.getByLabelText('Título da seção')).toHaveAccessibleDescription(
      faq.fields[0].help ?? '',
    )
  })

  it('preenche os campos com o conteúdo guardado, com acentuação intacta', async () => {
    await abrirFaq(gatewayComFaq())

    expect(screen.getByLabelText('Título da seção')).toHaveValue('Perguntas frequentes')
    expect(perguntasNaTela()).toEqual(['Primeira', 'Segunda', 'Terceira'])
  })

  it('recusa a chave que não é seção nenhuma', async () => {
    abrir(new FakeSectionsGateway(), 'inexistente')

    expect(await screen.findByText('Seção desconhecida')).toBeInTheDocument()
  })
})

describe('Gravação (SDD § C-04)', () => {
  it('envia o texto editado e confirma o sucesso na tela', async () => {
    const gateway = gatewayComFaq()
    await abrirFaq(gateway)

    await userEvent.clear(screen.getByLabelText('Título da seção'))
    await userEvent.type(screen.getByLabelText('Título da seção'), 'Dúvidas comuns')
    await salvar()

    expect(await screen.findByRole('status')).toHaveTextContent(SAVED_MESSAGE)
    expect(gateway.lastDocumentOf('faq')?.heading).toBe('Dúvidas comuns')
  })

  it('exibe o erro de validação da API no campo correspondente', async () => {
    const gateway = gatewayComFaq({
      rejectSaveWith: { 'faq.heading': 'Campo obrigatório.' },
    })
    await abrirFaq(gateway)

    await salvar()

    const campo = await screen.findByLabelText('Título da seção')
    await waitFor(() => expect(campo).toHaveAccessibleDescription(/Campo obrigatório\./))
    expect(campo).toHaveAttribute('aria-invalid', 'true')
  })

  it('exibe o erro de um item de lista no item que a API apontou', async () => {
    const gateway = gatewayComFaq({
      rejectSaveWith: { 'faq.items.1.question': 'Campo obrigatório.' },
    })
    await abrirFaq(gateway)

    await salvar()

    await waitFor(() =>
      expect(screen.getAllByLabelText('Pergunta')[1]).toHaveAccessibleDescription(
        /Campo obrigatório\./,
      ),
    )
    expect(screen.getAllByLabelText('Pergunta')[0]).not.toHaveAccessibleDescription(
      /Campo obrigatório\./,
    )
  })

  it('não deixa o erro sumir da tela quando não sabe a que campo ele pertence', async () => {
    const gateway = gatewayComFaq({
      rejectSaveWith: { 'faq.inexistente': 'Campo desconhecido nesta seção.' },
    })
    await abrirFaq(gateway)

    await salvar()

    const alertas = await screen.findAllByRole('alert')
    expect(alertas.map((alerta) => alerta.textContent).join(' ')).toContain(
      'Campo desconhecido nesta seção.',
    )
  })

  it('preserva o que o operador digitou quando a API recusa', async () => {
    const gateway = gatewayComFaq({ rejectSaveWith: { 'faq.heading': 'Campo obrigatório.' } })
    await abrirFaq(gateway)

    await userEvent.type(screen.getByLabelText('Título da seção'), ' 2026')
    await salvar()

    expect(await screen.findByLabelText('Título da seção')).toHaveValue(
      'Perguntas frequentes 2026',
    )
  })

  it('avisa quando a API não respondeu, sem dizer que salvou', async () => {
    const gateway = new FakeSectionsGateway({
      documents: { faq: DOCUMENTO_DO_FAQ },
      failWith: 'Não foi possível falar com a API do CMS.',
    })
    abrir(gateway, 'faq')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível falar com a API do CMS.',
    )
    expect(screen.queryByRole('status')).toBeNull()
  })
})

describe('Itens de lista (SDD § C-05)', () => {
  it('persiste a ordem depois de reordenar', async () => {
    const gateway = gatewayComFaq()
    await abrirFaq(gateway)

    await userEvent.click(
      screen.getByRole('button', { name: 'Mover para cima o item 3 de Perguntas' }),
    )
    expect(perguntasNaTela()).toEqual(['Primeira', 'Terceira', 'Segunda'])
    await salvar()

    const itens = gateway.lastDocumentOf('faq')?.items as Record<string, unknown>[]
    expect(itens.map((item) => [item.question, item.ordem])).toEqual([
      ['Primeira', 0],
      ['Terceira', 1],
      ['Segunda', 2],
    ])

    cleanup()
    await abrirFaq(gateway)
    expect(perguntasNaTela()).toEqual(['Primeira', 'Terceira', 'Segunda'])
  })

  it('acrescenta um item vazio no fim da lista', async () => {
    const gateway = gatewayComFaq()
    await abrirFaq(gateway)

    await userEvent.click(
      screen.getByRole('button', { name: 'Adicionar item em Perguntas' }),
    )

    expect(perguntasNaTela()).toEqual(['Primeira', 'Segunda', 'Terceira', ''])
  })

  it('remove o item pedido, e só ele', async () => {
    const gateway = gatewayComFaq()
    await abrirFaq(gateway)

    await userEvent.click(
      screen.getByRole('button', { name: 'Remover o item 2 de Perguntas' }),
    )
    await salvar()

    const itens = gateway.lastDocumentOf('faq')?.items as Record<string, unknown>[]
    expect(itens.map((item) => item.question)).toEqual(['Primeira', 'Terceira'])
  })

  it('desliga um item sem apagar o conteúdo dele (SDD § C-08)', async () => {
    const gateway = gatewayComFaq()
    await abrirFaq(gateway)

    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Exibir na página o item 2 de Perguntas' }),
    )
    await salvar()

    const itens = gateway.lastDocumentOf('faq')?.items as Record<string, unknown>[]
    expect(itens[1]).toMatchObject({ question: 'Segunda', visivel: false })
  })

  it('não deixa mover o primeiro item para cima nem o último para baixo', async () => {
    await abrirFaq(gatewayComFaq())

    expect(
      screen.getByRole('button', { name: 'Mover para cima o item 1 de Perguntas' }),
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Mover para baixo o item 3 de Perguntas' }),
    ).toBeDisabled()
  })
})

describe('Visibilidade da seção (SDD § C-08)', () => {
  it('desliga a seção e confirma na tela', async () => {
    const gateway = gatewayComFaq()
    await abrirFaq(gateway)

    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Seção aparece na página' }),
    )

    expect(await screen.findByRole('status')).toHaveTextContent(UNPUBLISHED_MESSAGE)
    const listadas = await gateway.listSections()
    expect(
      listadas.status === 'ok' &&
        listadas.value.find((secao) => secao.key === 'faq')?.isPublished,
    ).toBe(false)
  })
})

describe('Campos de mídia (espaço reservado até a tarefa de mídia)', () => {
  it('mostra o campo de imagem sem deixar digitar o identificador', async () => {
    abrir(new FakeSectionsGateway({ documents: { hero: DOCUMENTO_DA_ABERTURA } }), 'hero')

    const campo = await screen.findByLabelText(hero.fields[5].label)
    expect(campo).toHaveValue(IMAGEM_DA_ABERTURA)
    expect(campo).toHaveAttribute('readonly')
  })

  it('devolve a mídia intacta ao salvar apenas o texto', async () => {
    const gateway = new FakeSectionsGateway({ documents: { hero: DOCUMENTO_DA_ABERTURA } })
    abrir(gateway, 'hero')
    await screen.findByLabelText('Título principal')

    await userEvent.type(screen.getByLabelText('Título principal'), '!')
    await salvar()

    expect(gateway.lastDocumentOf('hero')).toMatchObject({
      headline: 'Título!',
      image: IMAGEM_DA_ABERTURA,
      imageAlt: 'Cão feliz',
    })
  })
})
