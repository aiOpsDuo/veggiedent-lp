import type { MediaKind } from './media-kind'

/**
 * Uma mídia registrada (SDD § "Modelo de dados" — `media_assets`).
 *
 * O registro só existe **depois** que o upload foi confirmado (§ D-05 e risco
 * R-04): enquanto o arquivo está subindo, não há nada aqui, e um upload
 * interrompido deixa no armazenamento um arquivo órfão inerte, que nenhum
 * documento de seção alcança.
 */
export interface MediaAsset {
  readonly id: string
  readonly kind: MediaKind
  readonly storagePath: string
  readonly publicUrl: string
  readonly mimeType: string
  readonly sizeBytes: number
  readonly originalFilename: string
  /** Nulos conforme a natureza: legenda não tem dimensão, imagem não tem duração. */
  readonly width: number | null
  readonly height: number | null
  readonly durationSeconds: number | null
  readonly createdAt: string
}
