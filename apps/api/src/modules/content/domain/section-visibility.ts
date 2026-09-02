import {
  getSectionSchema,
  type ListSpec,
  type SectionKey,
  type SectionSchema,
} from '@veggiedent/content-schema'
import type { StoredSection } from './section-repository.port'

/**
 * Regras de visibilidade (SDD § "Linguagem ubíqua" e § C-08).
 *
 * Funções puras, sem framework e sem banco: o que a LP recebe é decidido aqui,
 * não no controller nem no adaptador — é a resposta ao risco R-06.
 *
 * Elas são tolerantes com documento fora de forma de propósito. O banco guarda
 * `jsonb` e não impõe estrutura (SDD § D-01); um documento gravado antes de uma
 * mudança de esquema não pode derrubar a página inteira (risco R-03).
 */

/** O conteúdo publicado, indexado por chave de seção. */
export type PublishedSections = Partial<Record<SectionKey, Record<string, unknown>>>

interface ListItemShape {
  readonly visivel?: unknown
  readonly ordem?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isVisible(item: unknown): boolean {
  return !isRecord(item) || (item as ListItemShape).visivel !== false
}

function orderOf(item: unknown): number {
  const ordem = isRecord(item) ? (item as ListItemShape).ordem : undefined
  return typeof ordem === 'number' ? ordem : Number.MAX_SAFE_INTEGER
}

/**
 * Itens visíveis, na ordem definida no painel. A ordenação é estável: itens sem
 * `ordem` legível vão para o fim preservando a ordem em que estavam guardados,
 * que é o comportamento previsível para quem edita.
 */
function visibleItemsInOrder(items: readonly unknown[]): unknown[] {
  return items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => isVisible(item))
    .sort((a, b) => orderOf(a.item) - orderOf(b.item) || a.index - b.index)
    .map(({ item }) => item)
}

function publishedList(document: Record<string, unknown>, list: ListSpec): unknown {
  const items = document[list.name]
  return Array.isArray(items) ? visibleItemsInOrder(items) : items
}

/**
 * O documento como a LP deve vê-lo: itens não publicados omitidos, os demais na
 * ordem do painel. Os campos simples passam intocados — visibilidade de campo
 * não existe no modelo, só de seção e de item.
 */
export function toPublishedDocument(
  schema: SectionSchema,
  document: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const published: Record<string, unknown> = { ...document }
  for (const list of schema.lists) {
    if (list.name in published) {
      published[list.name] = publishedList(published, list)
    }
  }
  return published
}

/**
 * Todo o conteúdo publicado, indexado por chave de seção. Seções não publicadas
 * são omitidas — não aparecem vazias, simplesmente não aparecem (SDD § C-08).
 */
export function toPublishedSections(
  sections: readonly StoredSection[],
): PublishedSections {
  const published: PublishedSections = {}
  for (const section of sections) {
    if (section.isPublished) {
      published[section.key] = toPublishedDocument(
        getSectionSchema(section.key),
        section.data,
      )
    }
  }
  return published
}
