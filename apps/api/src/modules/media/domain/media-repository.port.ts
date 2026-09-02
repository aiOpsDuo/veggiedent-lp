import type { MediaAsset } from './media-asset'
import type { MediaKind } from './media-kind'

/** Token de injeção da porta. O domínio declara; a infraestrutura implementa. */
export const MEDIA_REPOSITORY = Symbol('MediaRepository')

/** Uma mídia a registrar, já com o arquivo confirmado no armazenamento. */
export interface NewMediaAsset {
  readonly id: string
  readonly kind: MediaKind
  readonly storagePath: string
  readonly publicUrl: string
  readonly mimeType: string
  readonly sizeBytes: number
  readonly originalFilename: string
  readonly width: number | null
  readonly height: number | null
  readonly durationSeconds: number | null
}

/**
 * Persistência do registro de mídia (SDD § "Modelo de dados").
 *
 * Separada de `MediaUrlRepository`, que resolve identificador em URL para o
 * conteúdo publicado: são dois consumidores com necessidades diferentes, e uma
 * porta só obrigaria quem serve a LP a conhecer registro e remoção que ele
 * nunca usa (ISP).
 */
export interface MediaRepository {
  insert(asset: NewMediaAsset, operatorId: string): Promise<MediaAsset>
  findById(id: string): Promise<MediaAsset | null>
  /** Sustenta a confirmação idempotente: um caminho, no máximo um registro. */
  findByStoragePath(storagePath: string): Promise<MediaAsset | null>
  delete(id: string): Promise<void>
}
