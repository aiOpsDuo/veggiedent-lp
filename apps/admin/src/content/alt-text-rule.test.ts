import { getSectionSchema, type SectionSchema } from '@veggiedent/content-schema'
import { altTextErrors } from './alt-text-rule'
import { buildDraft } from './section-draft'

/**
 * A invariante de acessibilidade do produto, do lado do painel: imagem
 * informativa preenchida exige descrição; imagem decorativa não tem descrição a
 * exigir (SDD § "Contrato do esquema de seção").
 */

const MIDIA = '11111111-2222-3333-4444-555555555555'

function erros(schema: SectionSchema, data: Record<string, unknown>): Record<string, string> {
  return { ...altTextErrors(schema, buildDraft(schema, data)) }
}

describe('imagem informativa', () => {
  const hero = getSectionSchema('hero')

  it('exige a descrição quando a imagem está preenchida', () => {
    expect(erros(hero, { image: MIDIA })).toEqual({
      imageAlt: 'O texto alternativo é obrigatório quando há imagem.',
    })
  })

  it('não exige nada quando a descrição está preenchida', () => {
    expect(erros(hero, { image: MIDIA, imageAlt: 'Cão feliz' })).toEqual({})
  })

  it('trata descrição só com espaços como ausente', () => {
    expect(erros(hero, { image: MIDIA, imageAlt: '   ' })).toHaveProperty('imageAlt')
  })

  it('não exige descrição enquanto não há imagem — quem recusa o vazio é a API', () => {
    expect(erros(hero, {})).toEqual({})
  })
})

describe('imagem decorativa', () => {
  const capturaLead = getSectionSchema('captura_lead')

  it('não exige descrição nenhuma, porque não tem campo de descrição', () => {
    const comMosaico = {
      mosaico: [{ image: MIDIA, ordem: 0, visivel: true }],
    }

    expect(erros(capturaLead, comMosaico)).toEqual({})
  })

  it('o esquema do mosaico não declara campo de texto alternativo', () => {
    const mosaico = capturaLead.lists.find((list) => list.name === 'mosaico')

    expect(mosaico?.itemFields.map((spec) => spec.name)).toEqual(['image'])
  })
})

describe('imagem dentro de item de lista', () => {
  const educacao = getSectionSchema('educacao')

  it('endereça o erro à posição do item que está sem descrição', () => {
    const doisCards = {
      cards: [
        { image: MIDIA, imageAlt: 'Cão escovando', ordem: 0, visivel: true },
        { image: MIDIA, ordem: 1, visivel: true },
      ],
    }

    expect(erros(educacao, doisCards)).toEqual({
      'cards.1.imageAlt': 'O texto alternativo é obrigatório quando há imagem.',
    })
  })
})
