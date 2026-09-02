import { describe, expect, it } from 'vitest'
import { MESSAGES } from '../src/messages'
import { SECTION_ERROR_KEY, validateSectionDocument } from '../src/validation'
import { buildZodSchema } from '../src/zod'
import { mediaId, validSectionDocuments } from './fixtures'

describe('formato dos erros', () => {
  it('devolve um mapa de caminho de campo para mensagem', () => {
    const result = validateSectionDocument('hero', { ...validSectionDocuments.hero, headline: '' })

    expect(result.valid ? {} : result.fields).toEqual({ 'hero.headline': MESSAGES.required })
  })

  it('acusa um caminho por campo com problema, inclusive dentro de listas', () => {
    const document = { ...validSectionDocuments.faq, heading: '', items: [{ visivel: true, ordem: 0 }] }

    const result = validateSectionDocument('faq', document)

    expect(result.valid ? {} : result.fields).toEqual({
      'faq.heading': MESSAGES.required,
      'faq.items.0.question': MESSAGES.required,
      'faq.items.0.answer': MESSAGES.required,
    })
  })

  it('recusa uma chave de seção que não existe', () => {
    const result = validateSectionDocument('rodape' as 'footer', {})

    expect(result.valid ? {} : result.fields).toEqual({ [SECTION_ERROR_KEY]: MESSAGES.unknownSection })
  })

  it('recusa um valor que nem sequer é um objeto', () => {
    const result = validateSectionDocument('faq', 'texto solto')

    expect(result.valid ? {} : result.fields).toEqual({ faq: MESSAGES.expectedObject })
  })
})

describe('referência de mídia', () => {
  const schema = buildZodSchema({
    fields: [
      { name: 'foto', type: 'imagem', label: 'Foto', required: true },
      { name: 'fotoAlt', type: 'texto-curto', label: 'Texto alternativo', required: true },
    ],
    lists: [],
  })

  it('aceita o identificador de uma mídia registrada', () => {
    expect(schema.safeParse({ foto: mediaId(1), fotoAlt: 'Descrição' }).success).toBe(true)
  })

  it.each([
    '/images/hero/virbac-kv-hero.png',
    'https://cdn.exemplo.com/hero.png',
    'hero.png',
    '',
  ])('recusa a URL ou caminho digitado à mão "%s"', (value) => {
    const result = schema.safeParse({ foto: value, fotoAlt: 'Descrição' })

    expect(result.success).toBe(false)
    expect(result.success ? [] : result.error.issues[0].message).toBe(MESSAGES.mediaReference)
  })
})

describe('campo de link', () => {
  const schema = buildZodSchema({
    fields: [{ name: 'destino', type: 'link', label: 'Destino', required: true }],
    lists: [],
  })

  it.each(['#educacao', '/politica-de-privacidade', 'https://br.virbac.com/home/veggie.html', 'mailto:a@b.com'])(
    'aceita "%s"',
    (value) => {
      expect(schema.safeParse({ destino: value }).success).toBe(true)
    },
  )

  it.each(['educacao', '#', 'javascript:alert(1)'])('recusa "%s"', (value) => {
    expect(schema.safeParse({ destino: value }).success).toBe(false)
  })

  it('remove espaços em volta do endereço antes de gravar', () => {
    const result = schema.safeParse({ destino: ' https://www.tudodebicho.com.br/busca?busca=veggiedent' })

    expect(result.success ? result.data : null).toEqual({
      destino: 'https://www.tudodebicho.com.br/busca?busca=veggiedent',
    })
  })
})

describe('tipos de campo do contrato', () => {
  const schema = buildZodSchema({
    fields: [
      { name: 'paragrafos', type: 'lista-de-textos', label: 'Parágrafos', required: true },
      { name: 'destaque', type: 'booleano', label: 'Em destaque', required: true },
      { name: 'observacao', type: 'texto-longo', label: 'Observação', required: false },
    ],
    lists: [],
  })

  it('aceita uma lista de textos preenchida e um booleano', () => {
    expect(schema.safeParse({ paragrafos: ['um', 'dois'], destaque: false }).success).toBe(true)
  })

  it('recusa uma lista de textos vazia', () => {
    const result = schema.safeParse({ paragrafos: [], destaque: true })

    expect(result.success ? [] : result.error.issues[0].message).toBe(MESSAGES.emptyList)
  })

  it('recusa um booleano ausente', () => {
    const result = schema.safeParse({ paragrafos: ['um'] })

    expect(result.success ? [] : result.error.issues[0].message).toBe(MESSAGES.required)
  })

  it('aceita a ausência de um campo opcional', () => {
    expect(schema.safeParse({ paragrafos: ['um'], destaque: true }).success).toBe(true)
  })
})

describe('visibilidade e ordenação dos itens de lista', () => {
  it('mantém a ordem em que os itens foram gravados', () => {
    const result = validateSectionDocument('header', validSectionDocuments.header)
    const labels = result.valid ? result.data.navLinks.map((link) => link.label) : []

    expect(labels).toEqual([
      'Saúde oral',
      'Rotina de cuidado',
      'Produto',
      'Onde comprar',
      'Perguntas frequentes',
    ])
  })

  it('aceita um item despublicado sem apagar o conteúdo', () => {
    const result = validateSectionDocument('faq', validSectionDocuments.faq)
    const hidden = result.valid ? result.data.items.filter((item) => !item.visivel) : []

    expect(hidden).toHaveLength(1)
    expect(hidden[0].question).toBe('A partir de que idade posso oferecer Veggiedent®?')
  })

  it('recusa uma posição de ordenação negativa', () => {
    const document = {
      ...validSectionDocuments.faq,
      items: [{ ...validSectionDocuments.faq.items[0], ordem: -1 }],
    }

    expect(validateSectionDocument('faq', document).valid).toBe(false)
  })
})
