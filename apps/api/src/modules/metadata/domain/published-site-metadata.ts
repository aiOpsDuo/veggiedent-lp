import { siteMetadataSchema } from '@veggiedent/content-schema'
import {
  withResolvedMedia,
  type MediaUrlMap,
} from '../../../shared/domain/media-references'
import type { StoredSiteMetadata } from './site-metadata-repository.port'

/**
 * Os metadados como a LP os recebe dentro de `GET /api/content`.
 *
 * Mesma regra que vale para as seções: a imagem de compartilhamento sai como
 * URL pública, não como identificador. Aqui ela não custa consulta nenhuma — o
 * repositório já traz a URL embutida na mesma leitura, que é o que mantém
 * `GET /api/seo` em uma consulta só.
 */
function ogImageUrls(stored: StoredSiteMetadata): MediaUrlMap {
  const mediaId = stored.document.ogImage
  return typeof mediaId === 'string' && stored.ogImageUrl !== null
    ? new Map([[mediaId, stored.ogImageUrl]])
    : new Map()
}

export function toPublishedMetadata(
  stored: StoredSiteMetadata | null,
): Record<string, unknown> | null {
  return stored === null
    ? null
    : withResolvedMedia(siteMetadataSchema, stored.document, ogImageUrls(stored))
}
