import type { MediaAsset } from '../domain/media-asset'
import type { MediaKind } from '../domain/media-kind'

/**
 * O que as rotas de mídia devolvem ao painel (SDD § "Endpoints
 * administrativos"). Formas de saída, sem regra de negócio: a camada de
 * apresentação não monta resposta e o domínio não conhece a forma do JSON.
 */

/**
 * Resposta de `POST /api/admin/media/upload-url` — o passo 1 de D-05.
 *
 * `uploadUrl`/`expiresInSeconds` são a credencial em si (SDD § D-05, reescrita
 * em 2026-09-21 — antes `signedUrl`/`token`/`resumableEndpoint`). `kind`,
 * `bucket`, `path` e `maxBytes` não são parte da credencial: são o destino que
 * a API decidiu, que o passo 3 (`POST /api/admin/media`) repete para
 * confirmar o upload.
 */
export interface UploadCredentialView {
  readonly kind: MediaKind
  readonly bucket: string
  readonly path: string
  readonly uploadUrl: string
  readonly expiresInSeconds: number
  readonly maxBytes: number
}

/** O registro da mídia, como o painel o exibe e o referencia. */
export interface MediaView {
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
  readonly createdAt: string
}

export function toMediaView(asset: MediaAsset): MediaView {
  return { ...asset }
}
