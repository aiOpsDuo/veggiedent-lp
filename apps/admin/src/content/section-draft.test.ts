import type { SectionSchema } from '@veggiedent/content-schema'
import { buildDraft, moveItem, newListItem, toDocument } from './section-draft'

/**
 * Esquema de teste: nenhuma seção real aparece aqui de propósito. O que está
 * sob verificação é a mecânica do rascunho, que não sabe qual seção edita.
 */
const esquema = {
  key: 'faq',
  label: 'Seção de teste',
  fields: [
    { name: 'titulo', type: 'texto-curto', label: 'Título', required: true },
    { name: 'apoio', type: 'texto-longo', label: 'Apoio', required: false },
    {
      name: 'imagem',
      type: 'imagem',
      label: 'Imagem',
      required: false,
      imageRole: 'informativa',
    },
  ],
  lists: [
    {
      name: 'itens',
      label: 'Itens',
      reorderable: true,
      itemFields: [{ name: 'texto', type: 'texto-curto', label: 'Texto', required: true }],
    },
  ],
} as const satisfies SectionSchema

describe('Rascunho de seção', () => {
  it('preenche com vazio o campo que ainda não existe no documento', () => {
    const draft = buildDraft(esquema, {})

    expect(draft.fields).toEqual({ titulo: '', apoio: '', imagem: '' })
  })

  it('ordena os itens de lista pela ordem gravada, não pela ordem do array', () => {
    const draft = buildDraft(esquema, {
      itens: [
        { texto: 'segundo', ordem: 1, visivel: true },
        { texto: 'primeiro', ordem: 0, visivel: true },
      ],
    })

    expect(draft.lists.itens.map((item) => item.fields.texto)).toEqual([
      'primeiro',
      'segundo',
    ])
  })

  it('trata item sem visibilidade gravada como visível', () => {
    const draft = buildDraft(esquema, { itens: [{ texto: 'a', ordem: 0 }] })

    expect(draft.lists.itens[0].visivel).toBe(true)
  })

  it('dá identidade própria a cada item, para que mover não confunda um com outro', () => {
    const draft = buildDraft(esquema, {
      itens: [
        { texto: 'a', ordem: 0, visivel: true },
        { texto: 'a', ordem: 1, visivel: true },
      ],
    })

    expect(draft.lists.itens[0].id).not.toBe(draft.lists.itens[1].id)
  })
})

describe('Documento enviado à API', () => {
  it('recalcula a ordem a partir da posição dos itens', () => {
    const draft = buildDraft(esquema, {
      itens: [
        { texto: 'a', ordem: 7, visivel: true },
        { texto: 'b', ordem: 9, visivel: false },
      ],
    })

    expect(toDocument(esquema, draft).itens).toEqual([
      { texto: 'a', visivel: true, ordem: 0 },
      { texto: 'b', visivel: false, ordem: 1 },
    ])
  })

  it('omite campo opcional em branco em vez de enviar texto vazio', () => {
    const documento = toDocument(esquema, buildDraft(esquema, { titulo: 'Título' }))

    expect(documento).not.toHaveProperty('imagem')
    expect(documento).not.toHaveProperty('apoio')
  })

  it('envia campo obrigatório em branco, para que a API o recuse por campo', () => {
    const documento = toDocument(esquema, buildDraft(esquema, {}))

    expect(documento.titulo).toBe('')
  })

  it('não envia a identidade de item, que só existe no navegador', () => {
    const draft = buildDraft(esquema, { itens: [{ texto: 'a', ordem: 0, visivel: true }] })
    const itens = toDocument(esquema, draft).itens as Record<string, unknown>[]

    expect(itens[0]).not.toHaveProperty('id')
  })

  it('nasce com todos os campos vazios ao acrescentar um item', () => {
    const item = newListItem(esquema.lists[0])

    expect(item).toMatchObject({ visivel: true, fields: { texto: '' } })
  })
})

describe('Mover item', () => {
  const itens = buildDraft(esquema, {
    itens: [
      { texto: 'a', ordem: 0, visivel: true },
      { texto: 'b', ordem: 1, visivel: true },
      { texto: 'c', ordem: 2, visivel: true },
    ],
  }).lists.itens

  it('troca o item com o vizinho', () => {
    expect(moveItem(itens, 2, 1).map((item) => item.fields.texto)).toEqual(['a', 'c', 'b'])
  })

  it.each([
    ['antes do primeiro', 0, -1],
    ['depois do último', 2, 3],
  ])('não move %s', (_caso, from, to) => {
    expect(moveItem(itens, from, to)).toBe(itens)
  })
})
