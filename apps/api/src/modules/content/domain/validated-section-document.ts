import {
  isSectionKey,
  validateSectionDocument,
  type SectionKey,
} from '@veggiedent/content-schema'
import { FieldValidationError } from '../../../shared/domain/field-validation.error'
import { ResourceNotFoundError } from '../../../shared/domain/resource-not-found.error'

declare const validado: unique symbol

/**
 * Documento de seção que **já passou** pelo esquema de `content-schema`.
 *
 * A marca é o que dá dentes ao risco R-03 do SDD ("nenhum caminho de gravação
 * escapa da validação"): a porta de repositório só aceita este tipo, e o único
 * jeito de obtê-lo é chamar `validateSection`. Passar um objeto cru para o
 * repositório deixa de ser um descuido a ser pego em revisão e passa a ser um
 * erro de compilação — a garantia sai da disciplina e vai para o compilador.
 */
export type ValidatedSectionDocument = Readonly<Record<string, unknown>> & {
  readonly [validado]: true
}

/**
 * Converte a chave recebida da requisição em uma das 10 chaves conhecidas.
 * O conjunto é fechado (SDD § "Linguagem ubíqua"): chave fora dele é recurso
 * inexistente, nunca um registro novo.
 */
export function ensureSectionKey(key: string): SectionKey {
  if (!isSectionKey(key)) {
    throw new ResourceNotFoundError(`seção "${key}"`)
  }
  return key
}

/**
 * Valida o documento contra o esquema da seção. Recusa com erro por campo, no
 * mesmo formato que o pipe de validação HTTP produz — a apresentação traduz
 * uma exceção só, e o domínio não sabe que existe um `422`.
 */
export function validateSection(
  key: SectionKey,
  document: unknown,
): ValidatedSectionDocument {
  const result = validateSectionDocument(key, document)
  if (!result.valid) {
    throw new FieldValidationError(result.fields)
  }
  return result.data as unknown as ValidatedSectionDocument
}
