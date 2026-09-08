import { extname } from 'node:path'
import { isMediaField, type FieldSpec } from '@veggiedent/content-schema'
import { policyForBucket } from '../modules/media/domain/media-kind'
import { splitStoragePath } from '../modules/media/domain/storage-path'
import type { DocumentSchema } from '../shared/domain/media-references'
import type { CmsApi } from './cms-api'
import type { MediaUploader, SnapshotMediaSource, TargetStorage } from './media-transfer'
import { parsePublicObjectUrl } from './public-object-url'

/**
 * A conciliação entre o que o instantâneo guarda e o que as tabelas guardam.
 *
 * O instantâneo guarda **URLs públicas** — é a forma publicada, a única que a
 * LP sabe renderizar. As tabelas guardam **identificadores**: um campo de
 * mídia aponta para uma linha de `media_assets`, e o esquema recusa qualquer
 * outra coisa (SDD § "Contrato do esquema de seção"). Traduzir de uma forma
 * para a outra é o trabalho deste arquivo, e é onde mora a idempotência da
 * carga.
 *
 * Uma URL do instantâneo é conciliada por três caminhos, nesta ordem:
 *
 * 1. **Registro existente no destino.** A URL diz em que bucket e em que
 *    caminho o arquivo estava. Se o mesmo objeto está no armazenamento do
 *    ambiente de destino, a confirmação de upload devolve o registro que já
 *    existe em vez de criar outro (é a idempotência de `POST /admin/media`, por
 *    caminho de armazenamento) — e nenhum byte se move. É o caminho de quem
 *    zerou as tabelas de um projeto cujos arquivos continuam lá.
 * 2. **Documento já gravado.** O campo `hero.image` do documento gravado já
 *    aponta para alguma mídia; se o nome do arquivo dela é o mesmo que o da URL
 *    do instantâneo, é a mesma mídia. É o caminho da **segunda execução** contra
 *    um projeto novo, onde o passo 1 não acha nada: os arquivos foram
 *    reenviados e ganharam caminhos novos, então só o endereço do campo liga
 *    uma execução à seguinte.
 * 3. **Baixar e reenviar.** É o caminho do projeto Supabase **novo**, onde
 *    nenhuma mídia existe: os bytes vêm da URL pública do instantâneo e sobem
 *    pelo mesmo fluxo de três passos que o painel usa (SDD § D-05).
 */

/**
 * Tipo de arquivo por extensão. A lista é deduzida da extensão, e não do
 * cabeçalho que o servidor de origem devolve, porque a decisão precisa ser a
 * mesma em qualquer rede e revisável no diff do instantâneo. Cada tipo aqui é
 * aceito por algum bucket — `media-reconciliation.spec.ts` prende isso.
 */
const CONTENT_TYPE_BY_EXTENSION: Readonly<Record<string, string>> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
}

export class UnknownMediaTypeError extends Error {
  constructor(publicUrl: string) {
    super(`Não sei que tipo de arquivo é ${publicUrl}.`)
    this.name = 'UnknownMediaTypeError'
  }
}

/**
 * Nome do arquivo dentro da URL. Vale como identidade porque quem gera o
 * instantâneo é a própria API: o caminho de armazenamento nasce em
 * `planUpload`, na forma `identificador/nome-seguro-do-arquivo`.
 */
export function fileNameFromUrl(publicUrl: string): string {
  const withoutQuery = publicUrl.split(/[?#]/)[0]
  const segments = withoutQuery.split('/').filter((segment) => segment.length > 0)
  return segments[segments.length - 1] ?? ''
}

export function contentTypeOfUrl(publicUrl: string): string {
  const contentType = CONTENT_TYPE_BY_EXTENSION[extname(fileNameFromUrl(publicUrl)).toLowerCase()]
  if (contentType === undefined) {
    throw new UnknownMediaTypeError(publicUrl)
  }
  return contentType
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function collectInto(
  record: Readonly<Record<string, unknown>>,
  fields: readonly FieldSpec[],
  prefix: string,
  into: Map<string, string>,
): void {
  for (const field of fields) {
    const value = record[field.name]
    if (isMediaField(field) && typeof value === 'string' && value.length > 0) {
      into.set(`${prefix}${field.name}`, value)
    }
  }
}

/**
 * Valor de cada campo de mídia do documento, indexado pelo **endereço** do
 * campo (`image`, `videos[1].video`).
 *
 * Complementa `collectMediaIds` de `shared/domain/media-references`, que devolve
 * o conjunto de valores sem dizer onde cada um estava — o suficiente para
 * resolver URLs ao servir a página, insuficiente para casar duas execuções da
 * carga.
 */
export function mediaValuesByAddress(
  schema: DocumentSchema,
  document: Readonly<Record<string, unknown>>,
): Map<string, string> {
  const values = new Map<string, string>()
  collectInto(document, schema.fields, '', values)

  for (const list of schema.lists) {
    const items = document[list.name]
    if (!Array.isArray(items)) {
      continue
    }
    items.forEach((item, index) => {
      if (isRecord(item)) {
        collectInto(item, list.itemFields, `${list.name}[${index}].`, values)
      }
    })
  }

  return values
}

/** Um documento do instantâneo ao lado do que está gravado no mesmo lugar. */
export interface DocumentPair {
  /** Como o documento é dito nas mensagens de progresso. */
  readonly scope: string
  readonly schema: DocumentSchema
  readonly snapshot: Readonly<Record<string, unknown>>
  readonly stored: Readonly<Record<string, unknown>>
}

export type MediaOrigin =
  | 'registro-existente'
  | 'documento-gravado'
  | 'enviada-nesta-execucao'

export interface MediaResolutionEntry {
  readonly publicUrl: string
  readonly mediaId: string
  readonly origin: MediaOrigin
}

export interface MediaResolution {
  readonly entries: readonly MediaResolutionEntry[]
  /** Identificador da mídia de cada URL do instantâneo. */
  readonly idsByUrl: ReadonlyMap<string, string>
}

export interface MediaReconciliationDependencies {
  readonly api: CmsApi
  readonly source: SnapshotMediaSource
  readonly uploader: MediaUploader
  readonly targetStorage: TargetStorage
  readonly onProgress: (message: string) => void
}

/**
 * URLs que os documentos referenciam, sem repetição e na ordem em que aparecem
 * — o mesmo vídeo usado no banner e na lista é uma mídia só.
 */
export function referencedUrls(pairs: readonly DocumentPair[]): string[] {
  const urls = new Set<string>()
  for (const pair of pairs) {
    for (const url of mediaValuesByAddress(pair.schema, pair.snapshot).values()) {
      urls.add(url)
    }
  }
  return [...urls]
}

/**
 * Mídias que já ocupam, no documento gravado, o mesmo endereço que o
 * instantâneo vai ocupar.
 *
 * Só entram as que ainda existem e cujo arquivo tem o mesmo nome do arquivo da
 * URL. As duas condições evitam o mesmo tipo de erro em direções opostas: um
 * registro apagado à mão deixaria o documento apontando para um identificador
 * morto, e um instantâneo que passou a apontar para outro arquivo seria semeado
 * com a mídia antiga, em silêncio.
 */
async function matchStoredDocuments(
  api: CmsApi,
  pairs: readonly DocumentPair[],
): Promise<Map<string, string>> {
  const idsByUrl = new Map<string, string>()

  for (const pair of pairs) {
    const storedIds = mediaValuesByAddress(pair.schema, pair.stored)

    for (const [address, publicUrl] of mediaValuesByAddress(pair.schema, pair.snapshot)) {
      const mediaId = storedIds.get(address)
      if (mediaId === undefined || idsByUrl.has(publicUrl)) {
        continue
      }
      const media = await api.findMedia(mediaId)
      if (media === null) {
        continue
      }
      if (splitStoragePathFileName(media.storagePath) === fileNameFromUrl(publicUrl)) {
        idsByUrl.set(publicUrl, mediaId)
      }
    }
  }

  return idsByUrl
}

function splitStoragePathFileName(storagePath: string): string {
  return fileNameFromUrl(splitStoragePath(storagePath).objectPath)
}

/**
 * Registro da mídia quando o próprio objeto do instantâneo está no
 * armazenamento de destino. A confirmação de upload é reaproveitada de
 * propósito: ela devolve o registro existente quando o caminho já está
 * registrado, e cria o registro quando o arquivo está no armazenamento sem
 * linha correspondente.
 */
async function findRegisteredAtSamePath(
  dependencies: MediaReconciliationDependencies,
  publicUrl: string,
): Promise<string | null> {
  const location = parsePublicObjectUrl(publicUrl)
  if (location === null) {
    return null
  }
  const policy = policyForBucket(location.bucket)
  if (policy === undefined) {
    return null
  }
  if (!(await dependencies.targetStorage.hasObject(location.bucket, location.objectPath))) {
    return null
  }

  const media = await dependencies.api.registerMedia({
    kind: policy.kind,
    path: location.objectPath,
    originalFilename: fileNameFromUrl(publicUrl),
  })
  return media.id
}

/** Baixa os bytes da URL do instantâneo e os reenvia ao ambiente de destino. */
async function uploadFromSnapshot(
  dependencies: MediaReconciliationDependencies,
  publicUrl: string,
): Promise<string> {
  const originalFilename = fileNameFromUrl(publicUrl)
  const contentType = contentTypeOfUrl(publicUrl)
  const bytes = await dependencies.source.download(publicUrl)

  const credential = await dependencies.api.issueUploadCredential({
    originalFilename,
    contentType,
    sizeBytes: bytes.byteLength,
  })
  await dependencies.uploader.upload(credential, { bytes, contentType })
  const media = await dependencies.api.registerMedia({
    kind: credential.kind,
    path: credential.path,
    originalFilename,
  })

  return media.id
}

/** Garante uma mídia registrada para cada URL que os documentos referenciam. */
export async function reconcileMedia(
  dependencies: MediaReconciliationDependencies,
  pairs: readonly DocumentPair[],
): Promise<MediaResolution> {
  const fromStoredDocuments = await matchStoredDocuments(dependencies.api, pairs)
  const idsByUrl = new Map<string, string>()
  const entries: MediaResolutionEntry[] = []

  const remember = (publicUrl: string, mediaId: string, origin: MediaOrigin): void => {
    idsByUrl.set(publicUrl, mediaId)
    entries.push({ publicUrl, mediaId, origin })
    dependencies.onProgress(`mídia ${origin}: ${fileNameFromUrl(publicUrl)} (${mediaId})`)
  }

  for (const publicUrl of referencedUrls(pairs)) {
    const registered = await findRegisteredAtSamePath(dependencies, publicUrl)
    if (registered !== null) {
      remember(publicUrl, registered, 'registro-existente')
      continue
    }

    const stored = fromStoredDocuments.get(publicUrl)
    if (stored !== undefined) {
      remember(publicUrl, stored, 'documento-gravado')
      continue
    }

    remember(publicUrl, await uploadFromSnapshot(dependencies, publicUrl), 'enviada-nesta-execucao')
  }

  return { entries, idsByUrl }
}
