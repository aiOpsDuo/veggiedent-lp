import { stat } from 'node:fs/promises'
import { basename, extname } from 'node:path'
import { getSectionSchema, isMediaField, type SectionKey } from '@veggiedent/content-schema'
import type { DocumentSchema } from '../shared/domain/media-references'
import type { CmsApi } from './cms-api'
import type { MediaUploader } from './media-uploader'
import type { SectionDocumentDrafts } from './section-documents'

/**
 * A correspondência entre um arquivo do repositório e a mídia registrada no CMS.
 *
 * É aqui que mora a idempotência da migração. Enviar o mesmo arquivo duas vezes
 * criaria duas mídias, porque a API sorteia um caminho novo a cada credencial
 * emitida — de propósito, para que dois envios de mesmo nome não se sobreponham
 * (SDD § D-05). Então a segunda execução não pergunta ao armazenamento se o
 * arquivo já está lá: ela pergunta ao **conteúdo já gravado** qual mídia ocupa
 * cada campo, e reaproveita esse identificador.
 *
 * A correspondência é possível porque a tradução do conteúdo é determinística:
 * `hero.image` sempre vem do mesmo arquivo, `educacao.cards[1].image` também. O
 * endereço do campo é a chave que liga uma execução à seguinte.
 */

/** Tipos de arquivo aceitos, na mesma lista que os buckets declaram. */
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
  '.vtt': 'text/vtt',
}

export function contentTypeOf(filePath: string): string {
  const contentType = CONTENT_TYPE_BY_EXTENSION[extname(filePath).toLowerCase()]
  if (contentType === undefined) {
    throw new Error(`Não sei que tipo de arquivo é ${filePath}.`)
  }
  return contentType
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function collectInto(
  record: Readonly<Record<string, unknown>>,
  schema: { readonly fields: DocumentSchema['fields'] },
  prefix: string,
  into: Map<string, string>,
): void {
  for (const field of schema.fields) {
    const value = record[field.name]
    if (isMediaField(field) && typeof value === 'string' && value.length > 0) {
      into.set(`${prefix}${field.name}`, value)
    }
  }
}

/**
 * Valor de cada campo de mídia do documento, indexado pelo endereço do campo
 * (`hero.image`, `demonstracao.videos[1].poster`).
 *
 * Complementa `collectMediaIds` de `shared/domain/media-references`, que devolve
 * o conjunto de valores sem dizer onde cada um estava — o suficiente para
 * resolver URLs, insuficiente para casar duas execuções da migração.
 */
export function mediaValuesByAddress(
  schema: DocumentSchema,
  document: Readonly<Record<string, unknown>>,
): Map<string, string> {
  const values = new Map<string, string>()
  collectInto(document, schema, '', values)

  for (const list of schema.lists) {
    const items = document[list.name]
    if (!Array.isArray(items)) {
      continue
    }
    items.forEach((item, index) => {
      if (isRecord(item)) {
        collectInto(item, { fields: list.itemFields }, `${list.name}[${index}].`, values)
      }
    })
  }

  return values
}

export interface MediaResolution {
  /** Identificador da mídia de cada arquivo do repositório. */
  readonly idsByFile: ReadonlyMap<string, string>
  /** Arquivos enviados nesta execução. */
  readonly uploaded: readonly string[]
  /** Arquivos que já tinham mídia registrada e não foram enviados de novo. */
  readonly reused: readonly string[]
}

export interface MediaRegistryDependencies {
  readonly api: CmsApi
  readonly uploader: MediaUploader
  readonly onProgress: (message: string) => void
}

/**
 * Arquivos que os documentos referenciam, sem repetição e na ordem em que
 * aparecem — o mesmo logo usado no cabeçalho e no rodapé é uma mídia só.
 */
export function referencedFiles(drafts: SectionDocumentDrafts): string[] {
  const files = new Set<string>()
  for (const key of Object.keys(drafts) as SectionKey[]) {
    for (const file of mediaValuesByAddress(getSectionSchema(key), drafts[key]).values()) {
      files.add(file)
    }
  }
  return [...files]
}

/**
 * Mídias que já ocupam, no conteúdo gravado, o mesmo endereço que os documentos
 * novos vão ocupar. Só entram as que ainda existem: um registro apagado à mão
 * entre execuções faz o arquivo ser enviado de novo, em vez de deixar o
 * documento apontando para um identificador morto.
 */
async function findAlreadyRegistered(
  api: CmsApi,
  drafts: SectionDocumentDrafts,
): Promise<Map<string, string>> {
  const idsByFile = new Map<string, string>()

  for (const key of Object.keys(drafts) as SectionKey[]) {
    const schema = getSectionSchema(key)
    const stored = await api.getSection(key)
    const storedIds = mediaValuesByAddress(schema, stored.data)

    for (const [address, file] of mediaValuesByAddress(schema, drafts[key])) {
      const mediaId = storedIds.get(address)
      if (mediaId === undefined || idsByFile.has(file)) {
        continue
      }
      if ((await api.findMedia(mediaId)) !== null) {
        idsByFile.set(file, mediaId)
      }
    }
  }

  return idsByFile
}

/** Envia um arquivo e devolve o identificador da mídia registrada. */
async function uploadFile(
  dependencies: MediaRegistryDependencies,
  filePath: string,
): Promise<string> {
  const originalFilename = basename(filePath)
  const contentType = contentTypeOf(filePath)
  const sizeBytes = (await stat(filePath)).size

  const credential = await dependencies.api.issueUploadCredential({
    originalFilename,
    contentType,
    sizeBytes,
  })
  await dependencies.uploader.upload(credential, { path: filePath, contentType, sizeBytes })
  const media = await dependencies.api.registerMedia({
    kind: credential.kind,
    path: credential.path,
    originalFilename,
  })

  dependencies.onProgress(`mídia enviada: ${originalFilename} (${media.id})`)
  return media.id
}

/** Garante uma mídia registrada para cada arquivo referenciado pelos documentos. */
export async function resolveMedia(
  dependencies: MediaRegistryDependencies,
  drafts: SectionDocumentDrafts,
): Promise<MediaResolution> {
  const idsByFile = await findAlreadyRegistered(dependencies.api, drafts)
  const reused = [...idsByFile.keys()]
  const uploaded: string[] = []

  for (const filePath of referencedFiles(drafts)) {
    if (idsByFile.has(filePath)) {
      continue
    }
    idsByFile.set(filePath, await uploadFile(dependencies, filePath))
    uploaded.push(filePath)
  }

  return { idsByFile, uploaded, reused }
}
