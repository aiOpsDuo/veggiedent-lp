import { FieldValidationError } from '../../../shared/domain/field-validation.error'
import { ResourceNotFoundError } from '../../../shared/domain/resource-not-found.error'
import type { SectionRepository, StoredSection } from './section-repository.port'
import { ensureSectionKey, validateSection } from './validated-section-document'

const faqValido = {
  heading: 'Perguntas frequentes',
  items: [{ visivel: true, ordem: 0, question: 'Pergunta?', answer: 'Resposta.' }],
}

describe('ensureSectionKey', () => {
  it('aceita uma das 9 chaves conhecidas', () => {
    expect(ensureSectionKey('faq')).toBe('faq')
  })

  it('recusa chave fora do conjunto fechado', () => {
    expect(() => ensureSectionKey('promocao')).toThrow(ResourceNotFoundError)
  })
})

describe('validateSection', () => {
  it('devolve o documento já normalizado pelo esquema', () => {
    expect(validateSection('faq', faqValido)).toEqual(faqValido)
  })

  it('recusa com erro por campo, no caminho do campo', () => {
    expect.assertions(2)
    try {
      validateSection('faq', {})
    } catch (error) {
      expect(error).toBeInstanceOf(FieldValidationError)
      expect((error as FieldValidationError).fields['faq.heading']).toBe('Campo obrigatório.')
    }
  })
})

/**
 * RISCO R-03 verificado pelo compilador, não em tempo de execução.
 *
 * A porta só aceita `ValidatedSectionDocument`, e o único jeito de obter esse
 * tipo é passar por `validateSection`. A função abaixo nunca roda — ela existe
 * para ser **compilada**: se alguém tirar a marca do tipo, o `@ts-expect-error`
 * fica sem erro para justificar e o `ts-jest` derruba esta suíte.
 */
function _gravacaoSemValidacaoNaoCompila(repository: SectionRepository): void {
  const documento = { heading: 'Perguntas frequentes', items: [] }

  // @ts-expect-error documento cru não é ValidatedSectionDocument
  void repository.save('faq', documento, 'operador')

  void repository.save('faq', validateSection('faq', faqValido), 'operador')
}

describe('gravação sem validação', () => {
  it('é impossível de escrever: a porta só aceita documento validado', () => {
    // O que este teste afirma foi verificado na compilação, acima. Aqui só se
    // confirma que a função existe e não foi apagada junto da garantia.
    expect(typeof _gravacaoSemValidacaoNaoCompila).toBe('function')
  })
})

/** Só para tipar a função acima sem depender de nenhuma implementação. */
export type _StoredSection = StoredSection
