import { randomUUID } from 'node:crypto'
import { Inject, Injectable } from '@nestjs/common'
import { FieldValidationError } from '../../../shared/domain/field-validation.error'
import type { MediaKind, MediaKindPolicy } from '../domain/media-kind'
import { policyFor, policyForMimeType } from '../domain/media-kind'
import { MEDIA_REPOSITORY, type MediaRepository } from '../domain/media-repository.port'
import { MEDIA_STORAGE, type MediaStorage } from '../domain/media-storage.port'
import { toStoragePath } from '../domain/storage-path'
import { UNSUPPORTED_TYPE_MESSAGE, fileTooLargeMessage } from '../domain/upload-plan'
import { toMediaView, type MediaView } from './media-view'

/** O que o painel confirma depois que o navegador terminou o envio. */
export interface UploadConfirmation {
  readonly kind: MediaKind
  readonly path: string
  readonly originalFilename: string
  readonly width?: number
  readonly height?: number
  readonly durationSeconds?: number
}

const FILE_NOT_FOUND_MESSAGE =
  'Nenhum arquivo neste caminho do armazenamento. Envie o arquivo com a credencial antes de confirmar.'
const EMPTY_FILE_MESSAGE = 'O arquivo enviado está vazio.'

function kindMismatchMessage(policy: MediaKindPolicy): string {
  return `O arquivo enviado não é um arquivo de ${policy.label}.`
}

/**
 * Confere o tamanho do arquivo que está no armazenamento contra a política do
 * bucket. Segunda barreira: a primeira é o próprio bucket, que recusa o envio
 * fora da faixa.
 */
function ensureAcceptableSize(sizeBytes: number, policy: MediaKindPolicy): void {
  if (sizeBytes <= 0) {
    throw new FieldValidationError({ path: EMPTY_FILE_MESSAGE })
  }
  if (sizeBytes > policy.maxBytes) {
    throw new FieldValidationError({ path: fileTooLargeMessage(policy) })
  }
}

/**
 * Devolve o tipo do arquivo que está no armazenamento, se ele for aceito para
 * esta natureza de mídia. Uma imagem confirmada como vídeo é recusada aqui: o
 * bucket de destino é decidido pela natureza, e os dois precisam concordar.
 */
function ensureAcceptableType(mimeType: string | null, policy: MediaKindPolicy): string {
  const storedPolicy = mimeType === null ? undefined : policyForMimeType(mimeType)
  if (mimeType === null || storedPolicy === undefined) {
    throw new FieldValidationError({ path: UNSUPPORTED_TYPE_MESSAGE })
  }
  if (storedPolicy.kind !== policy.kind) {
    throw new FieldValidationError({ kind: kindMismatchMessage(policy) })
  }
  return mimeType
}

/**
 * Passo 3 de 3 do envio de mídia (SDD § D-05): o upload terminou e a API
 * registra a mídia, devolvendo o registro com a URL pública.
 *
 * **É aqui, e só aqui, que uma linha de `media_assets` nasce** (risco R-04). E
 * ela só nasce depois de o armazenamento confirmar que o arquivo está lá: quem
 * decide é o armazenamento, não o que o painel afirma ter enviado. Tamanho e
 * tipo vêm do arquivo de verdade — ninguém registra uma mídia que não existe,
 * nem descreve a que existe de forma diferente do que ela é.
 *
 * Confirmar duas vezes o mesmo caminho devolve o registro que já existe, em vez
 * de duplicar ou de falhar: o painel pode reenviar a confirmação depois de uma
 * queda de conexão sem consequência, e é o que a migração de conteúdo da T9
 * precisa para ser idempotente.
 */
@Injectable()
export class RegisterMediaUseCase {
  constructor(
    @Inject(MEDIA_REPOSITORY) private readonly repository: MediaRepository,
    @Inject(MEDIA_STORAGE) private readonly storage: MediaStorage,
  ) {}

  async execute(
    confirmation: UploadConfirmation,
    operatorId: string,
  ): Promise<MediaView> {
    const policy = policyFor(confirmation.kind)
    const storagePath = toStoragePath(policy.bucket, confirmation.path)

    const alreadyRegistered = await this.repository.findByStoragePath(storagePath)
    if (alreadyRegistered !== null) {
      return toMediaView(alreadyRegistered)
    }

    const object = await this.storage.findObject(policy.bucket, confirmation.path)
    if (object === null) {
      throw new FieldValidationError({ path: FILE_NOT_FOUND_MESSAGE })
    }
    ensureAcceptableSize(object.sizeBytes, policy)

    const registered = await this.repository.insert(
      {
        id: randomUUID(),
        kind: policy.kind,
        storagePath,
        publicUrl: this.storage.publicUrlFor(policy.bucket, confirmation.path),
        mimeType: ensureAcceptableType(object.mimeType, policy),
        sizeBytes: object.sizeBytes,
        originalFilename: confirmation.originalFilename,
        width: confirmation.width ?? null,
        height: confirmation.height ?? null,
        durationSeconds: confirmation.durationSeconds ?? null,
      },
      operatorId,
    )

    return toMediaView(registered)
  }
}
