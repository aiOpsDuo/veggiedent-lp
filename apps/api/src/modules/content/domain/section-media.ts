import { getSectionSchema, isSectionKey } from '@veggiedent/content-schema'
import {
  collectMediaIds,
  withResolvedMedia,
  type MediaUrlMap,
} from '../../../shared/domain/media-references'
import type { PublishedSections } from './section-visibility'

/**
 * As referências de mídia de todas as seções publicadas, tratadas em bloco.
 *
 * Duas funções puras sobre o mesmo conjunto de seções, na ordem em que o caso
 * de uso as chama: primeiro descobrir **todos** os identificadores, para uma
 * busca só; depois trocar cada um pela URL correspondente. Nenhuma das duas
 * sabe de onde as URLs vêm, e é por isso que resolver mídia não vira uma
 * consulta por item (risco R-05).
 */

/** Todos os identificadores de mídia referenciados pelo conteúdo publicado. */
export function collectSectionMediaIds(sections: PublishedSections): string[] {
  const mediaIds = new Set<string>()
  for (const [key, document] of Object.entries(sections)) {
    if (isSectionKey(key) && document !== undefined) {
      for (const mediaId of collectMediaIds(getSectionSchema(key), document)) {
        mediaIds.add(mediaId)
      }
    }
  }
  return [...mediaIds]
}

/** O conteúdo publicado com as URLs públicas no lugar dos identificadores. */
export function withResolvedSectionMedia(
  sections: PublishedSections,
  urls: MediaUrlMap,
): PublishedSections {
  const resolved: PublishedSections = {}
  for (const [key, document] of Object.entries(sections)) {
    if (isSectionKey(key) && document !== undefined) {
      resolved[key] = withResolvedMedia(getSectionSchema(key), document, urls)
    }
  }
  return resolved
}
