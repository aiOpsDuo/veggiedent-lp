/**
 * Tradução do esquema declarativo para um validador Zod.
 *
 * Este arquivo é o único lugar que conhece Zod: os esquemas de seção são dados,
 * não código de validação. Acrescentar um tipo de campo é acrescentar uma
 * entrada em `buildersByFieldType`, sem tocar em nenhum esquema existente.
 */
import { z } from 'zod'
import type { FieldSpec, FieldType, ListSpec } from './contract'
import { altTextFieldName, isDecorativeImage } from './contract'
import { MESSAGES, minimumItemsMessage } from './messages'
import { isBlankRichText } from './rich-text'

interface FieldZodBuilder {
  readonly required: () => z.ZodType
  readonly optional: () => z.ZodType
}

const ANCHOR_PREFIX = '#'
const ABSOLUTE_PATH_PREFIX = '/'
const ALLOWED_LINK_PROTOCOLS = ['http:', 'https:', 'mailto:', 'tel:']

function isValidLink(value: string): boolean {
  if (value.startsWith(ANCHOR_PREFIX) || value.startsWith(ABSOLUTE_PATH_PREFIX)) {
    return value.length > 1
  }
  try {
    return ALLOWED_LINK_PROTOCOLS.includes(new URL(value).protocol)
  } catch {
    return false
  }
}

/**
 * Mensagem de erro que distingue "não preencheu" de "preencheu com o tipo
 * errado" — o operador precisa ler "Campo obrigatório." quando esqueceu o
 * campo, não uma mensagem sobre tipos.
 */
function missingOrWrongType(wrongTypeMessage: string) {
  return (issue: { readonly input: unknown }): string =>
    issue.input === undefined ? MESSAGES.required : wrongTypeMessage
}

function text(): z.ZodString {
  return z.string({ error: missingOrWrongType(MESSAGES.expectedText) }).trim()
}

/**
 * Referência de mídia: o identificador do registro em `media_assets`, nunca uma
 * URL digitada à mão (SDD, § "Contrato do esquema de seção").
 */
function mediaReference(): z.ZodType {
  return z.uuid(MESSAGES.mediaReference)
}

const buildersByFieldType: Record<FieldType, FieldZodBuilder> = {
  'texto-curto': {
    required: () => text().min(1, MESSAGES.required),
    optional: () => text().optional(),
  },
  'texto-longo': {
    required: () => text().min(1, MESSAGES.required),
    optional: () => text().optional(),
  },
  /**
   * Texto rico guarda HTML. A sanitizacao nao acontece aqui: a validacao diz se
   * o campo esta preenchido, e quem grava sanitiza antes de validar (API) e
   * quem renderiza sanitiza de novo (LP). Ver `rich-text.ts`.
   */
  'texto-rico': {
    required: () => text().min(1, MESSAGES.required).refine((value) => !isBlankRichText(value), MESSAGES.required),
    optional: () => text().optional(),
  },
  'lista-de-textos': {
    required: () =>
      z
        .array(text().min(1, MESSAGES.required), { error: missingOrWrongType(MESSAGES.expectedTextList) })
        .min(1, MESSAGES.emptyList),
    optional: () => z.array(text(), MESSAGES.expectedTextList).optional(),
  },
  imagem: { required: mediaReference, optional: () => mediaReference().optional() },
  video: { required: mediaReference, optional: () => mediaReference().optional() },
  legenda: { required: mediaReference, optional: () => mediaReference().optional() },
  link: {
    required: () => text().min(1, MESSAGES.required).refine(isValidLink, MESSAGES.invalidLink),
    optional: () =>
      text()
        .refine((value) => value === '' || isValidLink(value), MESSAGES.invalidLink)
        .optional(),
  },
  booleano: {
    required: () => z.boolean({ error: missingOrWrongType(MESSAGES.expectedBoolean) }),
    optional: () => z.boolean(MESSAGES.expectedBoolean).optional(),
  },
}

function fieldToZod(spec: FieldSpec): z.ZodType {
  const builder = buildersByFieldType[spec.type]
  return spec.required ? builder.required() : builder.optional()
}

function fieldsToShape(fields: readonly FieldSpec[]): z.ZodRawShape {
  return Object.fromEntries(fields.map((field) => [field.name, fieldToZod(field)]))
}

function isFilled(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

/**
 * Quando a imagem é opcional, seu texto alternativo também é — mas passa a ser
 * exigido assim que a imagem é preenchida. É o que mantém a invariante de
 * acessibilidade válida também nos campos de imagem opcionais.
 *
 * Imagem **decorativa** fica de fora, e não por descuido: ela não tem campo de
 * descrição no esquema, então exigir um seria pedir o preenchimento de um campo
 * que não existe — e que a validação recusaria como desconhecido se viesse.
 */
function requireAltWhenImageIsFilled(
  document: Record<string, unknown>,
  fields: readonly FieldSpec[],
  ctx: z.RefinementCtx,
): void {
  for (const field of fields) {
    if (field.type !== 'imagem' || field.required || isDecorativeImage(field)) continue
    const altName = altTextFieldName(field.name)
    if (isFilled(document[field.name]) && !isFilled(document[altName])) {
      ctx.addIssue({ code: 'custom', message: MESSAGES.altRequiredWithImage, path: [altName] })
    }
  }
}

const listItemBaseShape = {
  visivel: z.boolean({ error: missingOrWrongType(MESSAGES.itemVisibility) }),
  ordem: z.int({ error: missingOrWrongType(MESSAGES.itemOrder) }).min(0, MESSAGES.itemOrder),
}

function listItemToZod(list: ListSpec): z.ZodType {
  const fields = list.itemFields
  return z
    .strictObject({ ...listItemBaseShape, ...fieldsToShape(fields) }, MESSAGES.expectedObject)
    .superRefine((item, ctx) => requireAltWhenImageIsFilled(item, fields, ctx))
}

function reportDuplicateOrders(items: readonly { ordem: number }[], ctx: z.RefinementCtx): void {
  const seen = new Set<number>()
  items.forEach((item, index) => {
    if (seen.has(item.ordem)) {
      ctx.addIssue({ code: 'custom', message: MESSAGES.duplicateOrder, path: [index, 'ordem'] })
    }
    seen.add(item.ordem)
  })
}

function listToZod(list: ListSpec): z.ZodType {
  const minItems = list.minItems ?? 0
  return z
    .array(listItemToZod(list), { error: missingOrWrongType(MESSAGES.expectedList) })
    .min(minItems, minimumItemsMessage(minItems))
    .superRefine((items, ctx) => reportDuplicateOrders(items as { ordem: number }[], ctx))
}

export interface ZodBuildableSchema {
  readonly fields: readonly FieldSpec[]
  readonly lists: readonly ListSpec[]
}

/** Constrói o validador de um documento a partir do esquema declarativo. */
export function buildZodSchema(schema: ZodBuildableSchema): z.ZodType {
  const listsShape = Object.fromEntries(schema.lists.map((list) => [list.name, listToZod(list)]))
  const fieldsShape = fieldsToShape(schema.fields)
  return z
    .strictObject({ ...fieldsShape, ...listsShape }, MESSAGES.expectedObject)
    .superRefine((document, ctx) => requireAltWhenImageIsFilled(document, schema.fields, ctx))
}
