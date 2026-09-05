import type { FieldSpec, ListSpec } from '@veggiedent/content-schema'
import type { EditableSchema } from './editable-schema'

/**
 * O rascunho que o formulário edita, e a tradução dele para o documento que a
 * API recebe.
 *
 * Nada aqui conhece React: são funções puras sobre dados, o que deixa as regras
 * de ordenação, de item novo e de campo vazio testáveis sem montar tela.
 *
 * O rascunho **não** é o documento. Ele guarda, além do conteúdo, um
 * identificador de item que só existe no navegador — é o que mantém a
 * identidade de cada item de lista enquanto ele é movido, para que o campo em
 * edição não perca o foco ao trocar de posição. Esse identificador nunca é
 * enviado: o documento da API só aceita os campos declarados no esquema.
 */

/** Um item de lista em edição. A posição na página é a posição no array. */
export interface DraftListItem {
  readonly id: string
  readonly visivel: boolean
  readonly fields: Readonly<Record<string, unknown>>
}

export interface SectionDraft {
  readonly fields: Readonly<Record<string, unknown>>
  readonly lists: Readonly<Record<string, readonly DraftListItem[]>>
}

/** Campos que todo item carrega além dos declarados no esquema da lista. */
const VISIBILITY_FIELD = 'visivel'
const ORDER_FIELD = 'ordem'

let nextItemNumber = 0

function newItemId(): string {
  nextItemNumber += 1
  return `item-${nextItemNumber}`
}

/**
 * O valor de um campo ainda não preenchido. Texto nasce vazio, booleano nasce
 * `false` e lista de textos nasce sem linha nenhuma — em nenhum caso o painel
 * inventa conteúdo para o operador (nada disso chega à página publicada, porque
 * campo obrigatório vazio é recusado na gravação).
 */
export function emptyValueOf(spec: FieldSpec): unknown {
  if (spec.type === 'booleano') {
    return false
  }
  return spec.type === 'lista-de-textos' ? [] : ''
}

function readFieldValue(spec: FieldSpec, source: Record<string, unknown>): unknown {
  const stored = source[spec.name]
  return stored === undefined || stored === null ? emptyValueOf(spec) : stored
}

function readFields(
  specs: readonly FieldSpec[],
  source: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(specs.map((spec) => [spec.name, readFieldValue(spec, source)]))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function storedOrder(item: Record<string, unknown>): number {
  const order = item[ORDER_FIELD]
  return typeof order === 'number' ? order : Number.MAX_SAFE_INTEGER
}

/**
 * Um item guardado vira um item em edição. A ordem gravada decide a posição;
 * daí em diante quem manda é a posição no array, e `ordem` é recalculada na
 * gravação.
 */
function readListItems(list: ListSpec, stored: unknown): DraftListItem[] {
  if (!Array.isArray(stored)) {
    return []
  }
  return stored
    .filter(isRecord)
    .slice()
    .sort((left, right) => storedOrder(left) - storedOrder(right))
    .map((item) => ({
      id: newItemId(),
      visivel: item[VISIBILITY_FIELD] !== false,
      fields: readFields(list.itemFields, item),
    }))
}

/** Monta o rascunho de uma seção a partir do documento guardado. */
export function buildDraft(
  schema: EditableSchema,
  data: Readonly<Record<string, unknown>>,
): SectionDraft {
  return {
    fields: readFields(schema.fields, { ...data }),
    lists: Object.fromEntries(
      schema.lists.map((list) => [list.name, readListItems(list, data[list.name])]),
    ),
  }
}

/** Um item novo, com todos os campos do esquema vazios e visível na página. */
export function newListItem(list: ListSpec): DraftListItem {
  return {
    id: newItemId(),
    visivel: true,
    fields: Object.fromEntries(list.itemFields.map((spec) => [spec.name, emptyValueOf(spec)])),
  }
}

export function withFieldValue(
  draft: SectionDraft,
  name: string,
  value: unknown,
): SectionDraft {
  return { ...draft, fields: { ...draft.fields, [name]: value } }
}

export function withListItems(
  draft: SectionDraft,
  listName: string,
  items: readonly DraftListItem[],
): SectionDraft {
  return { ...draft, lists: { ...draft.lists, [listName]: items } }
}

/** Troca um item de lugar com o vizinho. Fora dos limites, nada muda. */
export function moveItem(
  items: readonly DraftListItem[],
  from: number,
  to: number,
): readonly DraftListItem[] {
  if (to < 0 || to >= items.length || from === to) {
    return items
  }
  const moved = items.slice()
  const [item] = moved.splice(from, 1)
  moved.splice(to, 0, item)
  return moved
}

export function replaceItem(
  items: readonly DraftListItem[],
  index: number,
  item: DraftListItem,
): readonly DraftListItem[] {
  return items.map((current, position) => (position === index ? item : current))
}

export function withItemField(
  item: DraftListItem,
  name: string,
  value: unknown,
): DraftListItem {
  return { ...item, fields: { ...item.fields, [name]: value } }
}

function isEmptyValue(value: unknown): boolean {
  if (typeof value === 'string') {
    return value.trim().length === 0
  }
  return Array.isArray(value) && value.length === 0
}

/**
 * Campo opcional em branco sai do documento em vez de ir como texto vazio.
 *
 * A diferença importa: o esquema valida um campo opcional de imagem como
 * identificador de mídia, e `""` não é identificador nenhum — enviar o vazio
 * transformaria "não preenchi" em erro de validação. Campo **obrigatório** vazio
 * é enviado do mesmo jeito, de propósito: é a API que recusa, e é a recusa dela
 * que aparece no campo certo.
 */
function collectValues(
  specs: readonly FieldSpec[],
  values: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const document: Record<string, unknown> = {}
  for (const spec of specs) {
    const value = values[spec.name]
    if (spec.required || !isEmptyValue(value)) {
      document[spec.name] = value
    }
  }
  return document
}

/**
 * O documento enviado à API. `ordem` é a posição no array, recalculada aqui:
 * é o que faz a ordem definida no painel ser a ordem exibida na página
 * (SDD § C-05), sem depender de nenhum número digitado pelo operador.
 */
/**
 * Se o rascunho em edição difere do que foi carregado (ou salvo) por último
 * (T30-d). Comparar por valor, não por referência: cada digitação produz um
 * novo objeto de rascunho, e comparar referências marcaria "alterado" mesmo
 * sem nenhuma diferença de conteúdo.
 *
 * Depende de os dois lados terem nascido do mesmo `buildDraft` (mesmos
 * identificadores de item de lista) para não acusar diferença onde não há —
 * é assim que os dois reducers usam esta função, sempre comparando contra o
 * próprio retorno de `buildDraft` guardado no momento do carregamento/gravação.
 */
export function isDraftDirty(draft: SectionDraft, savedDraft: SectionDraft): boolean {
  return JSON.stringify(draft) !== JSON.stringify(savedDraft)
}

export function toDocument(
  schema: EditableSchema,
  draft: SectionDraft,
): Record<string, unknown> {
  const document = collectValues(schema.fields, draft.fields)

  for (const list of schema.lists) {
    const items = draft.lists[list.name] ?? []
    document[list.name] = items.map((item, position) => ({
      ...collectValues(list.itemFields, item.fields),
      [VISIBILITY_FIELD]: item.visivel,
      [ORDER_FIELD]: position,
    }))
  }

  return document
}
