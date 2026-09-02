import { faqSchema, getSectionSchema } from '@veggiedent/content-schema'
import type { StoredSection } from './section-repository.port'
import { toPublishedDocument, toPublishedSections } from './section-visibility'

const item = (ordem: number, question: string, visivel = true) => ({
  visivel,
  ordem,
  question,
  answer: 'Resposta.',
})

const perguntas = (items: unknown[]) => ({ heading: 'Perguntas frequentes', items })

const stored = (
  key: StoredSection['key'],
  data: Record<string, unknown>,
  isPublished: boolean,
): StoredSection => ({ key, data, isPublished, updatedAt: '2026-09-02T00:00:00.000Z' })

describe('toPublishedDocument', () => {
  it('remove o item despublicado sem tocar nos campos simples', () => {
    const publicado = toPublishedDocument(
      faqSchema,
      perguntas([item(0, 'Fica'), item(1, 'Some', false)]),
    )

    expect(publicado.heading).toBe('Perguntas frequentes')
    expect(publicado.items).toEqual([item(0, 'Fica')])
  })

  it('ordena pelo campo de ordenação, não pela ordem de gravação', () => {
    const publicado = toPublishedDocument(
      faqSchema,
      perguntas([item(2, 'C'), item(0, 'A'), item(1, 'B')]),
    )

    expect((publicado.items as { question: string }[]).map((i) => i.question)).toEqual([
      'A',
      'B',
      'C',
    ])
  })

  it('mantém a ordem de gravação entre itens com a mesma posição', () => {
    const publicado = toPublishedDocument(
      faqSchema,
      perguntas([item(0, 'Primeiro'), item(0, 'Segundo')]),
    )

    expect((publicado.items as { question: string }[]).map((i) => i.question)).toEqual([
      'Primeiro',
      'Segundo',
    ])
  })

  it('não derruba a página quando o documento está fora de forma', () => {
    // O banco guarda `jsonb` e não impõe estrutura (SDD § D-01, risco R-03):
    // um documento antigo precisa degradar, não explodir.
    expect(toPublishedDocument(faqSchema, { items: 'não é uma lista' })).toEqual({
      items: 'não é uma lista',
    })
    expect(toPublishedDocument(faqSchema, { items: [null, 42] })).toEqual({
      items: [null, 42],
    })
    expect(toPublishedDocument(faqSchema, {})).toEqual({})
  })

  it('não altera o documento recebido', () => {
    const original = perguntas([item(1, 'B'), item(0, 'A')])
    const copia = JSON.parse(JSON.stringify(original)) as unknown

    toPublishedDocument(faqSchema, original)

    expect(original).toEqual(copia)
  })
})

describe('toPublishedSections', () => {
  it('omite a seção despublicada em vez de entregá-la vazia', () => {
    const publicado = toPublishedSections([
      stored('faq', perguntas([item(0, 'Fica')]), true),
      stored('hero', { headline: 'Escondido' }, false),
    ])

    expect(Object.keys(publicado)).toEqual(['faq'])
    expect('hero' in publicado).toBe(false)
  })

  it('aplica a visibilidade de item em cada seção publicada', () => {
    const publicado = toPublishedSections([
      stored('faq', perguntas([item(0, 'Fica'), item(1, 'Some', false)]), true),
    ])

    expect(publicado.faq?.items).toHaveLength(1)
  })

  it('usa o esquema da seção correspondente', () => {
    expect(getSectionSchema('faq')).toBe(faqSchema)
  })
})
