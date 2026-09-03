import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FIELD_TYPES, type FieldSpec, type SectionSchema } from '@veggiedent/content-schema'
import { NO_ERRORS } from './field-errors'
import { buildDraft, type DraftListItem } from './section-draft'
import { SectionForm } from './SectionForm'

/**
 * Prova de que o formulário é **gerado** (SDD § D-02).
 *
 * Os esquemas usados aqui não existem no pacote: os nomes e rótulos são
 * inventados neste arquivo. Se o painel tivesse formulário escrito à mão por
 * seção, nada disto apareceria na tela. O que estes testes exercitam é a única
 * coisa que o painel de fato sabe fazer — desenhar o que o esquema declara.
 */

interface Montagem {
  readonly campoAlterado: ReturnType<typeof vi.fn>
  readonly listaAlterada: ReturnType<typeof vi.fn>
}

function esquemaCom(fields: readonly FieldSpec[], lists: SectionSchema['lists'] = []): SectionSchema {
  return { key: 'faq', label: 'Seção inventada', fields, lists }
}

function montar(
  schema: SectionSchema,
  data: Record<string, unknown> = {},
): Montagem {
  const campoAlterado = vi.fn()
  const listaAlterada = vi.fn()
  render(
    <SectionForm
      schema={schema}
      draft={buildDraft(schema, data)}
      errors={NO_ERRORS}
      onFieldChange={campoAlterado}
      onListChange={listaAlterada}
    />,
  )
  return { campoAlterado, listaAlterada }
}

describe('Um campo novo no esquema aparece sem tocar no painel', () => {
  it.each(FIELD_TYPES)('desenha um campo inédito do tipo %s', (type) => {
    const rotulo = `Campo que só existe neste teste (${type})`
    montar(esquemaCom([{ name: 'campoInedito', type, label: rotulo, required: false }]))

    expect(screen.getByText(rotulo)).toBeInTheDocument()
  })

  it('desenha a ajuda declarada no esquema, qualquer que seja o texto', () => {
    montar(
      esquemaCom([
        {
          name: 'campoInedito',
          type: 'texto-curto',
          label: 'Rótulo inventado',
          help: 'Ajuda inventada para este teste.',
          required: false,
        },
      ]),
    )

    expect(screen.getByLabelText('Rótulo inventado')).toHaveAccessibleDescription(
      'Ajuda inventada para este teste.',
    )
  })

  it('desenha um campo inédito dentro de um item de lista', () => {
    montar(
      esquemaCom(
        [],
        [
          {
            name: 'listaInventada',
            label: 'Lista inventada',
            reorderable: true,
            itemFields: [
              {
                name: 'campoInedito',
                type: 'texto-curto',
                label: 'Campo inédito do item',
                required: true,
              },
            ],
          },
        ],
      ),
      { listaInventada: [{ campoInedito: 'valor', ordem: 0, visivel: true }] },
    )

    expect(screen.getByLabelText('Campo inédito do item')).toHaveValue('valor')
  })
})

describe('Controles por tipo de campo', () => {
  it('texto curto devolve o texto digitado', async () => {
    const { campoAlterado } = montar(
      esquemaCom([{ name: 'curto', type: 'texto-curto', label: 'Curto', required: true }]),
    )

    await userEvent.type(screen.getByLabelText('Curto'), 'a')

    expect(campoAlterado).toHaveBeenCalledWith('curto', 'a')
  })

  it('texto longo usa uma área de texto, não uma linha', () => {
    montar(esquemaCom([{ name: 'longo', type: 'texto-longo', label: 'Longo', required: true }]))

    expect(screen.getByLabelText('Longo').tagName).toBe('TEXTAREA')
  })

  it('booleano devolve verdadeiro ao ser marcado', async () => {
    const { campoAlterado } = montar(
      esquemaCom([{ name: 'ligado', type: 'booleano', label: 'Ligado', required: false }]),
    )

    await userEvent.click(screen.getByLabelText('Ligado'))

    expect(campoAlterado).toHaveBeenCalledWith('ligado', true)
  })

  it('lista de textos acrescenta uma linha vazia', async () => {
    const { campoAlterado } = montar(
      esquemaCom([
        { name: 'linhas', type: 'lista-de-textos', label: 'Linhas', required: false },
      ]),
      { linhas: ['primeira'] },
    )

    await userEvent.click(screen.getByRole('button', { name: 'Adicionar linha em Linhas' }))

    expect(campoAlterado).toHaveBeenCalledWith('linhas', ['primeira', ''])
  })

  it('lista de textos remove a linha pedida', async () => {
    const { campoAlterado } = montar(
      esquemaCom([
        { name: 'linhas', type: 'lista-de-textos', label: 'Linhas', required: false },
      ]),
      { linhas: ['primeira', 'segunda'] },
    )

    await userEvent.click(
      screen.getByRole('button', { name: 'Remover a linha 1 de Linhas' }),
    )

    expect(campoAlterado).toHaveBeenCalledWith('linhas', ['segunda'])
  })

  it('link aceita texto livre, porque quem julga o endereço é a API', async () => {
    const { campoAlterado } = montar(
      esquemaCom([{ name: 'destino', type: 'link', label: 'Destino', required: true }]),
    )

    await userEvent.type(screen.getByLabelText('Destino'), '#')

    expect(campoAlterado).toHaveBeenCalledWith('destino', '#')
  })
})

describe('Erros por campo', () => {
  const schema = esquemaCom([
    { name: 'primeiro', type: 'texto-curto', label: 'Primeiro', required: true },
    { name: 'segundo', type: 'texto-curto', label: 'Segundo', required: true },
  ])

  it('pendura a mensagem no campo que a API apontou, e só nele', () => {
    render(
      <SectionForm
        schema={schema}
        draft={buildDraft(schema, {})}
        errors={{ porCampo: { segundo: 'Campo obrigatório.' }, semCampo: [] }}
        onFieldChange={vi.fn()}
        onListChange={vi.fn()}
      />,
    )

    expect(screen.getByLabelText('Segundo')).toHaveAccessibleDescription('Campo obrigatório.')
    expect(screen.getByLabelText('Primeiro')).toHaveAccessibleDescription('')
  })
})

describe('Itens de lista', () => {
  const schema = esquemaCom(
    [],
    [
      {
        name: 'itens',
        label: 'Itens',
        reorderable: true,
        itemFields: [
          { name: 'texto', type: 'texto-curto', label: 'Texto do item', required: true },
        ],
      },
    ],
  )

  const dados = {
    itens: [
      { texto: 'um', ordem: 0, visivel: true },
      { texto: 'dois', ordem: 1, visivel: true },
    ],
  }

  it('entrega a lista reordenada ao mover um item', async () => {
    const { listaAlterada } = montar(schema, dados)

    await userEvent.click(
      screen.getByRole('button', { name: 'Mover para baixo o item 1 de Itens' }),
    )

    const [nome, itens] = listaAlterada.mock.calls[0] as [string, DraftListItem[]]
    expect(nome).toBe('itens')
    expect(itens.map((item) => item.fields.texto)).toEqual(['dois', 'um'])
  })

  it('avisa quando a lista está vazia em vez de não mostrar nada', () => {
    montar(schema, { itens: [] })

    expect(screen.getByText('Nenhum item nesta lista.')).toBeInTheDocument()
  })
})
