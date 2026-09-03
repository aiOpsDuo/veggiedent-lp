import type { EditableSchema } from './editable-schema'
import type { SectionDraft } from './section-draft'
import type { FieldErrors } from './sections-gateway'

/**
 * Tradução dos caminhos de erro da API para os caminhos que o formulário usa.
 *
 * A API devolve `{ "hero.headline": "Campo obrigatório." }` e, dentro de uma
 * lista, `{ "faq.items.1.question": "…" }` (SDD § "Contratos de dados"). O
 * formulário não repete a chave da seção — ela já é o assunto da tela inteira —,
 * então o prefixo cai aqui, em um lugar só.
 *
 * O que não corresponde a nenhum campo continua existindo: sobra em
 * `semCampo`, e a tela o mostra. Um erro que a API considerou digno de resposta
 * nunca é descartado em silêncio só porque o painel não soube onde pendurá-lo.
 */
export interface SectionFieldErrors {
  readonly porCampo: Readonly<Record<string, string>>
  readonly semCampo: readonly string[]
}

export const NO_ERRORS: SectionFieldErrors = { porCampo: {}, semCampo: [] }

/** Caminho de um campo simples da seção. */
export function fieldPath(name: string): string {
  return name
}

/** Caminho de um campo de um item de lista, na posição em que ele foi enviado. */
export function listItemFieldPath(
  listName: string,
  position: number,
  name: string,
): string {
  return `${listName}.${position}.${name}`
}

/** Caminho da lista inteira — onde entram erros como "Inclua ao menos um item.". */
export function listPath(listName: string): string {
  return listName
}

/**
 * Todos os caminhos que o formulário desta seção é capaz de exibir, do jeito
 * que ele está montado agora — inclusive um caminho por item de cada lista.
 */
export function formPathsOf(schema: EditableSchema, draft: SectionDraft): Set<string> {
  const paths = new Set<string>(schema.fields.map((spec) => fieldPath(spec.name)))

  for (const list of schema.lists) {
    paths.add(listPath(list.name))
    const items = draft.lists[list.name] ?? []
    items.forEach((_item, position) => {
      for (const spec of list.itemFields) {
        paths.add(listItemFieldPath(list.name, position, spec.name))
      }
    })
  }

  return paths
}

export function forSection(
  sectionKey: string,
  fields: FieldErrors,
  knownPaths: ReadonlySet<string>,
): SectionFieldErrors {
  const prefix = `${sectionKey}.`
  const porCampo: Record<string, string> = {}
  const semCampo: string[] = []

  for (const [path, message] of Object.entries(fields)) {
    const formPath = path.startsWith(prefix) ? path.slice(prefix.length) : null
    if (formPath !== null && knownPaths.has(formPath)) {
      porCampo[formPath] = message
      continue
    }
    semCampo.push(message)
  }

  return { porCampo, semCampo }
}
