import { FieldValidationError } from '../../../shared/domain/field-validation.error'
import {
  ACCEPTED_MIME_TYPES,
  policyForMimeType,
  type MediaKindPolicy,
} from './media-kind'

/**
 * O que o painel declara antes de enviar um arquivo, e o destino que a API
 * decide a partir disso (SDD § D-05, passo 1 de 3).
 *
 * Aqui não passa nenhum byte: só nome, tipo e tamanho. É este arquivo que
 * recusa tipo não suportado e arquivo grande demais — antes de emitir
 * credencial, com mensagem em português no formato de erro por campo, em vez de
 * deixar o navegador descobrir a recusa depois de enviar 400 MB.
 */
export interface UploadRequest {
  readonly originalFilename: string
  readonly contentType: string
  readonly sizeBytes: number
}

/** Onde o arquivo vai ficar, já decidido pela API. */
export interface UploadTarget {
  readonly policy: MediaKindPolicy
  /** Caminho dentro do bucket. Único, e é ele que a confirmação repete. */
  readonly path: string
  readonly contentType: string
  readonly sizeBytes: number
  readonly originalFilename: string
}

const MEGABYTE = 1024 * 1024
const MAX_FILENAME_LENGTH = 80
const FALLBACK_FILENAME = 'arquivo'

export const UNSUPPORTED_TYPE_MESSAGE = `Tipo de arquivo não suportado. Tipos aceitos: ${ACCEPTED_MIME_TYPES.join(', ')}.`

function megabytes(bytes: number): string {
  return String(Math.round(bytes / MEGABYTE))
}

export function fileTooLargeMessage(policy: MediaKindPolicy): string {
  return `Arquivo maior que o limite de ${megabytes(policy.maxBytes)} MB para ${policy.label}.`
}

/**
 * O nome vira um pedaço de URL pública, então perde acento, espaço e qualquer
 * caractere que precise de escape — o nome original continua guardado inteiro
 * em `media_assets.original_filename`, que é o que o painel exibe.
 */
export function toSafeFilename(originalFilename: string): string {
  const withoutAccents = originalFilename
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  const sanitized = withoutAccents
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/-*\.-*/g, '.')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, MAX_FILENAME_LENGTH)
  return sanitized.length > 0 ? sanitized : FALLBACK_FILENAME
}

/**
 * Decide o destino do arquivo ou recusa o pedido. `uniqueId` é o que garante
 * que dois envios do mesmo nome não se sobreponham — a credencial é emitida
 * sem `upsert`, então um caminho já ocupado seria recusado pelo armazenamento.
 */
export function planUpload(request: UploadRequest, uniqueId: string): UploadTarget {
  const policy = policyForMimeType(request.contentType)
  if (!policy) {
    throw new FieldValidationError({ contentType: UNSUPPORTED_TYPE_MESSAGE })
  }
  if (request.sizeBytes > policy.maxBytes) {
    throw new FieldValidationError({ sizeBytes: fileTooLargeMessage(policy) })
  }

  return {
    policy,
    path: `${uniqueId}/${toSafeFilename(request.originalFilename)}`,
    contentType: request.contentType.trim().toLowerCase(),
    sizeBytes: request.sizeBytes,
    originalFilename: request.originalFilename,
  }
}
