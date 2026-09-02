import { validateSiteMetadata } from '@veggiedent/content-schema'
import { FieldValidationError } from '../../../shared/domain/field-validation.error'

declare const validado: unique symbol

/**
 * Metadados da página que já passaram pelo esquema de `content-schema`.
 *
 * Mesma marca de tipo dos documentos de seção, pela mesma razão (risco R-03):
 * a porta de repositório só aceita este tipo, e o único jeito de obtê-lo é
 * chamar `validateMetadata`.
 */
export type ValidatedSiteMetadata = Readonly<Record<string, unknown>> & {
  readonly [validado]: true
}

export function validateMetadata(document: unknown): ValidatedSiteMetadata {
  const result = validateSiteMetadata(document)
  if (!result.valid) {
    throw new FieldValidationError(result.fields)
  }
  return result.data as unknown as ValidatedSiteMetadata
}
