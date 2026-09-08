import {
  getSectionSchema,
  siteMetadataSchema,
  type SectionKey,
} from '@veggiedent/content-schema'
import { withResolvedMedia } from '../shared/domain/media-references'
import type { CmsApi } from './cms-api'
import {
  reconcileMedia,
  type DocumentPair,
  type MediaResolution,
  type MediaResolutionEntry,
} from './media-reconciliation'
import type { MediaUploader, SnapshotMediaSource, TargetStorage } from './media-transfer'
import {
  sectionKeysMissingFromSnapshot,
  snapshotSections,
  type ContentSnapshot,
} from './content-snapshot'

/**
 * A carga do CMS a partir do instantâneo de conteúdo (PLAN.md § T23).
 *
 * Ela grava **pelos mesmos endpoints administrativos que o painel usa**, com
 * token de operador de verdade. Não existe atalho até o banco: um documento
 * fora de forma é recusado com `422` aqui do mesmo jeito que seria para quem
 * edita pelo painel (SDD § D-01 e § R-03).
 *
 * **Rodar duas vezes não duplica nada.** As mídias são conciliadas em
 * `media-reconciliation.ts`; as seções e os metadados são substituições, não
 * inserções — uma seção é uma linha só, pela chave, e os metadados são um
 * registro único.
 *
 * A ordem dos passos é a regra, e não conveniência:
 *
 * - as mídias precisam existir **antes** dos documentos, porque um campo de
 *   imagem guarda o identificador de uma mídia e o esquema recusa qualquer
 *   outra coisa;
 * - a visibilidade vem **depois** da gravação, porque salvar publica
 *   (SDD § "Linguagem ubíqua") e porque desligar uma seção sem documento
 *   gravado é recusado como recurso inexistente.
 */

export interface SnapshotLoadDependencies {
  readonly api: CmsApi
  readonly source: SnapshotMediaSource
  readonly uploader: MediaUploader
  readonly targetStorage: TargetStorage
  readonly snapshot: ContentSnapshot
  readonly onProgress?: (message: string) => void
}

export interface SnapshotLoadReport {
  readonly media: readonly MediaResolutionEntry[]
  readonly savedSections: readonly SectionKey[]
  /** Seções ausentes do instantâneo que estavam publicadas e foram desligadas. */
  readonly unpublishedSections: readonly SectionKey[]
  /** `null` quando o instantâneo não traz metadados da página. */
  readonly metadataTitle: string | null
}

const METADATA_SCOPE = 'site_metadata'

/** Os documentos a semear, cada um ao lado do que já está gravado no lugar. */
interface DocumentsToSeed {
  readonly sections: readonly [SectionKey, DocumentPair][]
  /** `null` quando o instantâneo não traz metadados da página. */
  readonly metadata: DocumentPair | null
}

/**
 * Lê o lado gravado de cada documento do instantâneo. É esse lado que permite
 * reaproveitar as mídias da execução anterior.
 */
async function readDocuments(
  api: CmsApi,
  snapshot: ContentSnapshot,
): Promise<DocumentsToSeed> {
  const sections: [SectionKey, DocumentPair][] = []

  for (const [key, document] of snapshotSections(snapshot)) {
    const stored = await api.getSection(key)
    sections.push([
      key,
      { scope: key, schema: getSectionSchema(key), snapshot: document, stored: stored.data },
    ])
  }

  if (snapshot.metadata === null) {
    return { sections, metadata: null }
  }

  const stored = await api.getMetadata()
  return {
    sections,
    metadata: {
      scope: METADATA_SCOPE,
      schema: siteMetadataSchema,
      snapshot: snapshot.metadata,
      stored: stored.metadata,
    },
  }
}

function allDocuments(documents: DocumentsToSeed): DocumentPair[] {
  const pairs = documents.sections.map(([, pair]) => pair)
  return documents.metadata === null ? pairs : [...pairs, documents.metadata]
}

/**
 * Troca a URL pública de cada campo de mídia pelo identificador da mídia
 * correspondente. É a mesma função com que a API troca identificador por URL
 * ao servir a LP: um percurso de documento guiado pelo esquema, escrito uma vez
 * (`shared/domain/media-references`), aqui percorrido no sentido inverso.
 */
function withMediaIds(
  pair: DocumentPair,
  media: MediaResolution,
): Record<string, unknown> {
  return withResolvedMedia(pair.schema, pair.snapshot, media.idsByUrl)
}

/**
 * Seções ausentes do instantâneo terminam **não publicadas**, que é o estado em
 * que estavam quando ele foi gerado. Uma seção sem documento gravado já nasce
 * assim e não é tocada — publicar ou desligar exigiria inventar um documento.
 */
async function unpublishSectionsMissingFromSnapshot(
  api: CmsApi,
  snapshot: ContentSnapshot,
  report: (message: string) => void,
): Promise<SectionKey[]> {
  const unpublished: SectionKey[] = []

  for (const key of sectionKeysMissingFromSnapshot(snapshot)) {
    const stored = await api.getSection(key)
    if (!stored.isPublished) {
      continue
    }
    await api.setSectionVisibility(key, false)
    unpublished.push(key)
    report(`seção desligada por não estar no instantâneo: ${key}`)
  }

  return unpublished
}

export async function loadSnapshotIntoCms(
  dependencies: SnapshotLoadDependencies,
): Promise<SnapshotLoadReport> {
  const { api, snapshot } = dependencies
  const report = dependencies.onProgress ?? ((): void => {})

  const documents = await readDocuments(api, snapshot)
  const media = await reconcileMedia(
    { ...dependencies, onProgress: report },
    allDocuments(documents),
  )

  const savedSections: SectionKey[] = []
  for (const [key, pair] of documents.sections) {
    await api.saveSection(key, withMediaIds(pair, media))
    savedSections.push(key)
    report(`seção gravada: ${key}`)
  }

  const unpublishedSections = await unpublishSectionsMissingFromSnapshot(
    api,
    snapshot,
    report,
  )

  let metadataTitle: string | null = null
  if (documents.metadata !== null) {
    const saved = await api.saveMetadata(withMediaIds(documents.metadata, media))
    metadataTitle = typeof saved.metadata.title === 'string' ? saved.metadata.title : null
    report('metadados da página gravados')
  }

  return { media: media.entries, savedSections, unpublishedSections, metadataTitle }
}
