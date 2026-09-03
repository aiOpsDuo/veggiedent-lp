/**
 * Verificação das invariantes que o SDD exige de todo esquema de seção.
 *
 * Não é um teste: é uma função de domínio, exportada para que o teste, a API e
 * qualquer script de migração cheguem à mesma resposta sobre um esquema.
 */
import type { FieldSpec, ListSpec } from './contract'
import { LIST_ITEM_BASE_FIELDS, altTextFieldName, isDecorativeImage } from './contract'

export interface InvariantCheckable {
  readonly key: string
  readonly fields: readonly FieldSpec[]
  readonly lists: readonly ListSpec[]
}

const ALT_TEXT_FIELD_TYPE = 'texto-curto'

/**
 * Imagem informativa: o texto alternativo vem no campo seguinte, com o mesmo
 * nome mais o sufixo, do mesmo tipo e com a mesma obrigatoriedade da imagem.
 */
function checkInformativeImage(
  image: FieldSpec,
  fields: readonly FieldSpec[],
  index: number,
  location: string,
): string[] {
  const expectedName = altTextFieldName(image.name)
  const next = fields[index + 1]

  if (!next || next.name !== expectedName) {
    return [`${location}: o campo de imagem "${image.name}" não tem "${expectedName}" no campo seguinte.`]
  }

  const violations: string[] = []
  if (next.type !== ALT_TEXT_FIELD_TYPE) {
    violations.push(`${location}: "${expectedName}" precisa ser do tipo "${ALT_TEXT_FIELD_TYPE}".`)
  }
  if (next.required !== image.required) {
    violations.push(
      `${location}: "${expectedName}" precisa ter a mesma obrigatoriedade da imagem "${image.name}".`,
    )
  }
  return violations
}

/**
 * Imagem decorativa: não existe descrição a preencher. Um campo de texto
 * alternativo ao lado dela devolveria ao operador exatamente a pergunta que
 * declará-la decorativa respondeu.
 */
function checkDecorativeImage(
  image: FieldSpec,
  fields: readonly FieldSpec[],
  location: string,
): string[] {
  const altName = altTextFieldName(image.name)
  if (!fields.some((field) => field.name === altName)) {
    return []
  }
  return [
    `${location}: a imagem decorativa "${image.name}" não pode ter o campo "${altName}" — imagem decorativa entra com texto alternativo vazio e escondida de leitores de tela.`,
  ]
}

/**
 * A escolha consciente que o SDD exige de todo campo de imagem: descrevê-la ou
 * declará-la decorativa. Campo de imagem sem essa declaração é violação — é
 * justamente o descuido que a invariante existe para pegar.
 */
function checkImageAccessibilityChoice(fields: readonly FieldSpec[], location: string): string[] {
  const violations: string[] = []
  fields.forEach((field, index) => {
    if (field.type !== 'imagem') return
    if (field.imageRole === undefined) {
      violations.push(
        `${location}: o campo de imagem "${field.name}" não declara se é informativa ou decorativa.`,
      )
      return
    }
    violations.push(
      ...(isDecorativeImage(field)
        ? checkDecorativeImage(field, fields, location)
        : checkInformativeImage(field, fields, index, location)),
    )
  })
  return violations
}

function checkNoDuplicateNames(names: readonly string[], location: string): string[] {
  const seen = new Set<string>()
  const duplicated = new Set<string>()
  for (const name of names) {
    if (seen.has(name)) duplicated.add(name)
    seen.add(name)
  }
  return [...duplicated].map((name) => `${location}: o nome "${name}" está declarado mais de uma vez.`)
}

function checkListItemBaseIsNotShadowed(list: ListSpec, location: string): string[] {
  return list.itemFields
    .filter((field) => (LIST_ITEM_BASE_FIELDS as readonly string[]).includes(field.name))
    .map((field) => `${location}: "${field.name}" é reservado para visibilidade e ordenação do item.`)
}

/**
 * Devolve a lista de violações do esquema. Esquema válido devolve lista vazia.
 */
export function checkSchemaInvariants(schema: InvariantCheckable): string[] {
  const violations: string[] = [
    ...checkImageAccessibilityChoice(schema.fields, schema.key),
    ...checkNoDuplicateNames(
      [...schema.fields.map((field) => field.name), ...schema.lists.map((list) => list.name)],
      schema.key,
    ),
  ]

  for (const list of schema.lists) {
    const location = `${schema.key}.${list.name}`
    violations.push(
      ...checkImageAccessibilityChoice(list.itemFields, location),
      ...checkNoDuplicateNames(
        list.itemFields.map((field) => field.name),
        location,
      ),
      ...checkListItemBaseIsNotShadowed(list, location),
    )
    if (!list.reorderable) {
      violations.push(`${location}: toda lista precisa ser reordenável.`)
    }
  }

  return violations
}
