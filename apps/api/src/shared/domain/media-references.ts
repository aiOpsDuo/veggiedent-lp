import { isMediaField, type FieldSpec, type ListSpec } from '@veggiedent/content-schema'

/**
 * Referências de mídia dentro de um documento (SDD § "Contrato do esquema de
 * seção" e § C-06, C-07).
 *
 * Um campo de mídia guarda o **identificador** da mídia, nunca uma URL digitada
 * — é assim que o documento é gravado, e é assim que o painel o edita. Mas quem
 * consome o conteúdo publicado é a LP, que precisa de um endereço para carregar
 * a imagem ou o vídeo: um identificador não vira `<img src>`. Este arquivo é a
 * tradução entre as duas formas, e vale igualmente para o documento de uma
 * seção e para os metadados da página, porque os dois são declarados com o
 * mesmo contrato de campos.
 *
 * Duas funções puras, sem framework e sem banco. Elas dizem **quais** mídias um
 * documento referencia e **como** ele fica quando as URLs já foram buscadas —
 * buscá-las é trabalho da infraestrutura, e é essa separação que mantém a
 * resolução fora do caminho de uma consulta por mídia (risco R-05).
 *
 * Invariante da saída: **um campo de mídia ou é uma URL pública, ou não existe**
 * no documento publicado. Mídia apagada, referência quebrada ou valor fora de
 * forma fazem o campo sumir em vez de entregarem à LP um identificador que ela
 * não sabe renderizar; campo ausente ela já trata como vazio (risco R-03).
 */

/** Endereço público de cada mídia, indexado por identificador. */
export type MediaUrlMap = ReadonlyMap<string, string>

/**
 * A parte do esquema que interessa aqui: campos de topo e listas. Aceita tanto
 * um esquema de seção quanto o de metadados da página, que não é uma seção mas
 * declara seus campos do mesmo jeito.
 */
export interface DocumentSchema {
  readonly fields: readonly FieldSpec[]
  readonly lists: readonly ListSpec[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function mediaFieldNames(fields: readonly FieldSpec[]): string[] {
  return fields.filter(isMediaField).map((field) => field.name)
}

function itemsOf(document: Readonly<Record<string, unknown>>, list: ListSpec): unknown[] {
  const items = document[list.name]
  return Array.isArray(items) ? items : []
}

function collectFrom(
  record: Readonly<Record<string, unknown>>,
  fieldNames: readonly string[],
  into: Set<string>,
): void {
  for (const name of fieldNames) {
    const mediaId = record[name]
    if (typeof mediaId === 'string' && mediaId.length > 0) {
      into.add(mediaId)
    }
  }
}

/**
 * Identificadores de mídia que um documento referencia — campos de topo e
 * campos de item de lista, porque vídeo, card, passo e parceiro carregam mídia
 * tanto quanto o topo da seção. Sem repetição: a mesma imagem usada duas vezes
 * é buscada uma vez.
 */
export function collectMediaIds(
  schema: DocumentSchema,
  document: Readonly<Record<string, unknown>>,
): string[] {
  const mediaIds = new Set<string>()
  collectFrom(document, mediaFieldNames(schema.fields), mediaIds)

  for (const list of schema.lists) {
    const itemFieldNames = mediaFieldNames(list.itemFields)
    for (const item of itemsOf(document, list)) {
      if (isRecord(item)) {
        collectFrom(item, itemFieldNames, mediaIds)
      }
    }
  }

  return [...mediaIds]
}

function withResolvedFields(
  record: Readonly<Record<string, unknown>>,
  fieldNames: readonly string[],
  urls: MediaUrlMap,
): Record<string, unknown> {
  const resolved: Record<string, unknown> = { ...record }
  for (const name of fieldNames) {
    if (!(name in resolved)) {
      continue
    }
    const mediaId = resolved[name]
    const url = typeof mediaId === 'string' ? urls.get(mediaId) : undefined
    if (url === undefined) {
      delete resolved[name]
    } else {
      resolved[name] = url
    }
  }
  return resolved
}

/**
 * O documento como a LP o recebe: cada campo de mídia com o endereço público no
 * lugar do identificador. O restante passa intocado, inclusive o texto
 * alternativo que acompanha cada imagem — ele é texto, não mídia.
 */
export function withResolvedMedia(
  schema: DocumentSchema,
  document: Readonly<Record<string, unknown>>,
  urls: MediaUrlMap,
): Record<string, unknown> {
  const resolved = withResolvedFields(document, mediaFieldNames(schema.fields), urls)

  for (const list of schema.lists) {
    if (!Array.isArray(document[list.name])) {
      continue
    }
    const itemFieldNames = mediaFieldNames(list.itemFields)
    resolved[list.name] = itemsOf(document, list).map((item) =>
      isRecord(item) ? withResolvedFields(item, itemFieldNames, urls) : item,
    )
  }

  return resolved
}
