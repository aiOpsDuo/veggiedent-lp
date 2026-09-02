/**
 * Verificação das invariantes que o SDD exige de todo esquema de seção.
 *
 * Não é um teste: é uma função de domínio, exportada para que o teste, a API e
 * qualquer script de migração cheguem à mesma resposta sobre um esquema.
 */
import type { FieldSpec, ListSpec } from './contract'
import { LIST_ITEM_BASE_FIELDS, altTextFieldName } from './contract'

export interface InvariantCheckable {
  readonly key: string
  readonly fields: readonly FieldSpec[]
  readonly lists: readonly ListSpec[]
}

const ALT_TEXT_FIELD_TYPE = 'texto-curto'

function checkImageHasAdjacentAltText(fields: readonly FieldSpec[], location: string): string[] {
  const violations: string[] = []
  fields.forEach((field, index) => {
    if (field.type !== 'imagem') return
    const expectedName = altTextFieldName(field.name)
    const next = fields[index + 1]
    if (!next || next.name !== expectedName) {
      violations.push(`${location}: o campo de imagem "${field.name}" não tem "${expectedName}" no campo seguinte.`)
      return
    }
    if (next.type !== ALT_TEXT_FIELD_TYPE) {
      violations.push(`${location}: "${expectedName}" precisa ser do tipo "${ALT_TEXT_FIELD_TYPE}".`)
    }
    if (next.required !== field.required) {
      violations.push(
        `${location}: "${expectedName}" precisa ter a mesma obrigatoriedade da imagem "${field.name}".`,
      )
    }
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
    ...checkImageHasAdjacentAltText(schema.fields, schema.key),
    ...checkNoDuplicateNames(
      [...schema.fields.map((field) => field.name), ...schema.lists.map((list) => list.name)],
      schema.key,
    ),
  ]

  for (const list of schema.lists) {
    const location = `${schema.key}.${list.name}`
    violations.push(
      ...checkImageHasAdjacentAltText(list.itemFields, location),
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
