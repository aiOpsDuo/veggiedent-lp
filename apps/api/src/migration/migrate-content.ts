import { SECTION_KEYS, getSectionSchema, type SectionKey } from '@veggiedent/content-schema'
import { withResolvedMedia } from '../shared/domain/media-references'
import type { CmsApi } from './cms-api'
import type { LandingPageContent } from './content-source'
import type { MediaUploader } from './media-uploader'
import { resolveMedia } from './media-registry'
import {
  buildPageMetadata,
  buildSectionDocuments,
  unpublishedSections,
  type SectionDocumentDrafts,
} from './section-documents'

/**
 * Carga inicial do CMS: leva o conteúdo que hoje vive em código para o banco,
 * pelos mesmos endpoints que o painel usa (PLAN.md § T9).
 *
 * **Rodar duas vezes não duplica nada.** As mídias são reaproveitadas pelo
 * endereço do campo que já as referencia (ver `media-registry.ts`), e as seções
 * e os metadados são substituições, não inserções — uma seção é uma linha só,
 * pela chave, desde sempre.
 *
 * A ordem dos passos é a regra: as mídias precisam existir antes dos
 * documentos, porque um campo de imagem guarda o identificador da mídia e o
 * esquema recusa qualquer outra coisa; e a visibilidade vem depois da gravação,
 * porque salvar publica (SDD § "Linguagem ubíqua").
 */

export interface MigrationDependencies {
  readonly api: CmsApi
  readonly uploader: MediaUploader
  readonly content: LandingPageContent
  readonly onProgress?: (message: string) => void
}

export interface MigrationReport {
  readonly uploadedMedia: readonly string[]
  readonly reusedMedia: readonly string[]
  /** Identificador da mídia de cada arquivo do repositório, enviado ou reaproveitado. */
  readonly mediaIdsByFile: ReadonlyMap<string, string>
  readonly savedSections: readonly SectionKey[]
  readonly unpublishedSections: readonly SectionKey[]
  readonly metadataTitle: string
}

/**
 * Troca o caminho de cada arquivo pelo identificador da mídia correspondente.
 * Usa a mesma função com que a API troca identificador por URL ao servir a LP —
 * um percurso de documento, escrito uma vez (`shared/domain/media-references`).
 */
function withMediaIds(
  drafts: SectionDocumentDrafts,
  idsByFile: ReadonlyMap<string, string>,
): SectionDocumentDrafts {
  const resolved = {} as SectionDocumentDrafts
  for (const key of SECTION_KEYS) {
    resolved[key] = withResolvedMedia(getSectionSchema(key), drafts[key], idsByFile)
  }
  return resolved
}

export async function migrateContent(
  dependencies: MigrationDependencies,
): Promise<MigrationReport> {
  const { api, content } = dependencies
  const report = dependencies.onProgress ?? ((): void => {})

  const drafts = buildSectionDocuments(content)
  const media = await resolveMedia({ ...dependencies, onProgress: report }, drafts)
  const documents = withMediaIds(drafts, media.idsByFile)

  for (const key of SECTION_KEYS) {
    await api.saveSection(key, documents[key])
    report(`seção gravada: ${key}`)
  }

  const naoPublicadas = unpublishedSections(content)
  for (const key of naoPublicadas) {
    await api.setSectionVisibility(key, false)
    report(`seção despublicada: ${key}`)
  }

  const metadata = buildPageMetadata(content)
  await api.saveMetadata(metadata)
  report('metadados da página gravados')

  return {
    uploadedMedia: media.uploaded,
    reusedMedia: media.reused,
    mediaIdsByFile: media.idsByFile,
    savedSections: [...SECTION_KEYS],
    unpublishedSections: naoPublicadas,
    metadataTitle: content.metadata.title,
  }
}
