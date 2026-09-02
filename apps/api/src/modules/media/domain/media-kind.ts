/**
 * As três naturezas de mídia e a política de armazenamento de cada uma
 * (SDD § "Modelo de dados" — `media_assets.kind` — e § D-05).
 *
 * Um bucket por natureza, com limite de tamanho e lista de tipos próprios. A
 * fonte da verdade é a migração `20260902120500_create_storage_buckets.sql`: o
 * próprio armazenamento recusa o que estiver fora dessas faixas, e este
 * catálogo existe para recusar **antes** de emitir a credencial, com mensagem
 * em português, em vez de deixar o navegador descobrir a recusa no meio do
 * upload. `media-kind.spec.ts` compara os dois lado a lado e falha se
 * divergirem.
 */

export const MEDIA_KINDS = ['image', 'video', 'caption'] as const

export type MediaKind = (typeof MEDIA_KINDS)[number]

export interface MediaKindPolicy {
  readonly kind: MediaKind
  /** Nome do bucket, como a migração o criou. */
  readonly bucket: string
  /** Como a natureza é dita ao operador, em português. */
  readonly label: string
  readonly maxBytes: number
  readonly acceptedMimeTypes: readonly string[]
}

const MEGABYTE = 1024 * 1024

export const MEDIA_KIND_POLICIES: Readonly<Record<MediaKind, MediaKindPolicy>> = {
  image: {
    kind: 'image',
    bucket: 'veggiedent-images',
    label: 'imagem',
    maxBytes: 10 * MEGABYTE,
    acceptedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'],
  },
  video: {
    kind: 'video',
    bucket: 'veggiedent-videos',
    label: 'vídeo',
    maxBytes: 500 * MEGABYTE,
    acceptedMimeTypes: ['video/mp4', 'video/webm'],
  },
  caption: {
    kind: 'caption',
    bucket: 'veggiedent-captions',
    label: 'legenda',
    maxBytes: 1 * MEGABYTE,
    acceptedMimeTypes: ['text/vtt'],
  },
}

export function policyFor(kind: MediaKind): MediaKindPolicy {
  return MEDIA_KIND_POLICIES[kind]
}

/**
 * A natureza da mídia é **deduzida** do tipo do arquivo, não escolhida por quem
 * envia: cada tipo aceito pertence a um único bucket. Tipo desconhecido devolve
 * `undefined`, e quem chama transforma isso na recusa com mensagem clara.
 */
export function policyForMimeType(mimeType: string): MediaKindPolicy | undefined {
  const normalized = mimeType.trim().toLowerCase()
  return Object.values(MEDIA_KIND_POLICIES).find((policy) =>
    policy.acceptedMimeTypes.includes(normalized),
  )
}

/** Todos os tipos aceitos, em uma lista só, para a mensagem de recusa. */
export const ACCEPTED_MIME_TYPES: readonly string[] = Object.values(
  MEDIA_KIND_POLICIES,
).flatMap((policy) => policy.acceptedMimeTypes)
