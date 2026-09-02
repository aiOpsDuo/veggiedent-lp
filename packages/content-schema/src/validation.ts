/**
 * Validação de um documento de seção e dos metadados da página.
 *
 * Os erros saem no formato consumido pela API e pelo painel: um mapa de caminho
 * de campo para mensagem, como `{ "hero.headline": "Campo obrigatório." }`
 * (SDD, § "Contratos de dados/API/interfaces").
 */
import type { z } from 'zod'
import type { SectionKey } from './contract'
import { SECTION_KEYS, isSectionKey } from './contract'
import { MESSAGES } from './messages'
import { sectionSchemas } from './sections'
import { siteMetadataSchema } from './site-metadata'
import type { SectionDocumentOf, SiteMetadata } from './types'
import { buildZodSchema } from './zod'

export type FieldErrors = Record<string, string>

export type ValidationResult<T> = { readonly valid: true; readonly data: T } | { readonly valid: false; readonly fields: FieldErrors }

/** Chave usada quando o erro não pertence a nenhum campo do documento. */
export const SECTION_ERROR_KEY = 'secao'

export const SITE_METADATA_ERROR_PREFIX = 'metadata'

const sectionValidators: Record<SectionKey, z.ZodType> = Object.fromEntries(
  SECTION_KEYS.map((key) => [key, buildZodSchema(sectionSchemas[key])]),
) as Record<SectionKey, z.ZodType>

const siteMetadataValidator = buildZodSchema(siteMetadataSchema)

export function getSectionValidator(key: SectionKey): z.ZodType {
  return sectionValidators[key]
}

export function getSiteMetadataValidator(): z.ZodType {
  return siteMetadataValidator
}

function joinPath(prefix: string, path: readonly PropertyKey[]): string {
  return [prefix, ...path.map(String)].join('.')
}

function collectFieldErrors(issues: readonly z.core.$ZodIssue[], prefix: string): FieldErrors {
  const fields: FieldErrors = {}
  const remember = (path: string, message: string): void => {
    if (!(path in fields)) fields[path] = message
  }

  for (const issue of issues) {
    if (issue.code === 'unrecognized_keys') {
      for (const key of issue.keys) remember(joinPath(prefix, [...issue.path, key]), MESSAGES.unknownField)
      continue
    }
    remember(joinPath(prefix, issue.path), issue.message || MESSAGES.invalidValue)
  }

  return fields
}

function runValidator<T>(validator: z.ZodType, input: unknown, prefix: string): ValidationResult<T> {
  const parsed = validator.safeParse(input)
  if (parsed.success) {
    // O validador é construído em tempo de execução a partir do esquema
    // declarativo; a correspondência com o tipo derivado é garantida pelos
    // testes de tipo do pacote, não pela inferência do Zod.
    return { valid: true, data: parsed.data as T }
  }
  return { valid: false, fields: collectFieldErrors(parsed.error.issues, prefix) }
}

/**
 * Valida um documento de seção. Os caminhos dos erros são prefixados com a
 * chave da seção, como o painel e a API esperam.
 */
export function validateSectionDocument<K extends SectionKey>(
  key: K,
  input: unknown,
): ValidationResult<SectionDocumentOf<K>> {
  if (!isSectionKey(key)) {
    return { valid: false, fields: { [SECTION_ERROR_KEY]: MESSAGES.unknownSection } }
  }
  return runValidator<SectionDocumentOf<K>>(sectionValidators[key], input, key)
}

export function validateSiteMetadata(input: unknown): ValidationResult<SiteMetadata> {
  return runValidator<SiteMetadata>(siteMetadataValidator, input, SITE_METADATA_ERROR_PREFIX)
}
