import { getSectionSchema } from '@veggiedent/content-schema'
import { forSection, formPathsOf } from './field-errors'
import { buildDraft } from './section-draft'

const faq = getSectionSchema('faq')

const draft = buildDraft(faq, {
  heading: 'Perguntas',
  items: [
    { question: 'a', answer: 'A', ordem: 0, visivel: true },
    { question: 'b', answer: 'B', ordem: 1, visivel: true },
  ],
})

const caminhos = formPathsOf(faq, draft)

describe('Erros por campo vindos da API', () => {
  it('tira o prefixo da seção, que a tela inteira já é', () => {
    const erros = forSection('faq', { 'faq.heading': 'Campo obrigatório.' }, caminhos)

    expect(erros.porCampo).toEqual({ heading: 'Campo obrigatório.' })
    expect(erros.semCampo).toEqual([])
  })

  it('endereça o erro à posição do item que a API apontou', () => {
    const erros = forSection('faq', { 'faq.items.1.question': 'Campo obrigatório.' }, caminhos)

    expect(erros.porCampo).toEqual({ 'items.1.question': 'Campo obrigatório.' })
  })

  it('reconhece o erro da lista inteira', () => {
    const erros = forSection('faq', { 'faq.items': 'Inclua ao menos um item.' }, caminhos)

    expect(erros.porCampo).toEqual({ items: 'Inclua ao menos um item.' })
  })

  it('guarda o erro sem campo correspondente em vez de descartá-lo', () => {
    const erros = forSection(
      'faq',
      { 'faq.items.9.question': 'Campo obrigatório.', secao: 'Seção desconhecida.' },
      caminhos,
    )

    expect(erros.porCampo).toEqual({})
    expect(erros.semCampo).toEqual(['Campo obrigatório.', 'Seção desconhecida.'])
  })
})

describe('Caminhos que o formulário sabe exibir', () => {
  it('cobre os campos da seção, cada lista e cada item existente', () => {
    expect(caminhos).toEqual(
      new Set([
        'heading',
        'items',
        'items.0.question',
        'items.0.answer',
        'items.1.question',
        'items.1.answer',
      ]),
    )
  })
})
