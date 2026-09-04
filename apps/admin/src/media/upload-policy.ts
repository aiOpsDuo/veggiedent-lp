import type { MediaFieldType } from '@veggiedent/content-schema'

/**
 * O que o painel aceita enviar, por tipo de campo de mídia, e o que ele recusa
 * **antes de qualquer chamada** (SDD § C-06, C-07).
 *
 * A API já recusa tipo não suportado e arquivo grande demais, e o armazenamento
 * recusa depois dela. Esta cópia no navegador não substitui nenhuma das duas:
 * ela existe para que o operador leia uma frase em português no instante em que
 * escolhe o arquivo, em vez de esperar uma ida à rede para descobrir que o
 * arquivo nunca teve chance. `upload-policy.test.ts` lê as migrações de
 * `supabase/migrations/` e falha se esta tabela divergir dos buckets reais.
 */

const MEGABYTE = 1024 * 1024

/**
 * Teto global de upload do projeto Supabase, **acima** do limite declarado em
 * cada bucket: um arquivo maior é recusado pelo próprio armazenamento com
 * `413 Maximum size exceeded`, antes de aceitar byte nenhum. Medido em
 * 2026-09-02 (ver `agent_context/CHANGELOG.md` e o README).
 *
 * É por isso que o limite exibido ao operador não é o do bucket: o bucket de
 * vídeo declara 500 MB, mas nenhum vídeo acima deste teto entra. Elevá-lo é
 * mudança de plano do projeto, em *Project Settings → Storage*, não de código.
 */
export const PROJECT_UPLOAD_CEILING_BYTES = 50 * MEGABYTE

export interface UploadPolicy {
  /** Bucket que guarda esta natureza de mídia, como a migração o criou. */
  readonly bucket: string
  /** Como a natureza é dita ao operador, em português. */
  readonly label: string
  /** Limite declarado no bucket. O teto do projeto pode ser menor que ele. */
  readonly bucketMaxBytes: number
  readonly acceptedMimeTypes: readonly string[]
  /** Os mesmos tipos, como o operador os reconhece na tela. */
  readonly acceptedFormats: string
}

export const UPLOAD_POLICIES: Readonly<Record<MediaFieldType, UploadPolicy>> = {
  imagem: {
    bucket: 'veggiedent-images',
    label: 'imagem',
    bucketMaxBytes: 10 * MEGABYTE,
    acceptedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/avif',
      'image/gif',
      'image/svg+xml',
    ],
    acceptedFormats: 'JPG, PNG, WebP, AVIF, GIF ou SVG',
  },
  video: {
    bucket: 'veggiedent-videos',
    label: 'vídeo',
    bucketMaxBytes: 500 * MEGABYTE,
    acceptedMimeTypes: ['video/mp4', 'video/webm'],
    acceptedFormats: 'MP4 ou WebM',
  },
}

export function policyOf(fieldType: MediaFieldType): UploadPolicy {
  return UPLOAD_POLICIES[fieldType]
}

/** O menor entre o limite do bucket e o teto do projeto — quem manda é o menor. */
export function maxBytesOf(fieldType: MediaFieldType): number {
  return Math.min(policyOf(fieldType).bucketMaxBytes, PROJECT_UPLOAD_CEILING_BYTES)
}

/**
 * Tamanho em português, com uma casa decimal só quando ela muda a leitura.
 * "4,2 MB" e "50 MB" dizem o mesmo tanto; "4 MB" para 4,2 MB esconderia.
 */
export function formatMegabytes(bytes: number): string {
  const megabytes = bytes / MEGABYTE
  const rounded = Math.round(megabytes * 10) / 10
  return `${String(rounded).replace('.', ',')} MB`
}

/** A frase que o operador lê **antes** de escolher o arquivo. */
export function limitHint(fieldType: MediaFieldType): string {
  const policy = policyOf(fieldType)
  return `${policy.acceptedFormats}, até ${formatMegabytes(maxBytesOf(fieldType))}.`
}

/** O valor do atributo `accept` do seletor de arquivo, para o mesmo campo. */
export function acceptAttributeOf(fieldType: MediaFieldType): string {
  return policyOf(fieldType).acceptedMimeTypes.join(',')
}

export function unsupportedTypeMessage(fieldType: MediaFieldType): string {
  const policy = policyOf(fieldType)
  return `Tipo de arquivo não suportado para ${policy.label}. Envie ${policy.acceptedFormats}.`
}

export function fileTooLargeMessage(fieldType: MediaFieldType, sizeBytes: number): string {
  const limit = formatMegabytes(maxBytesOf(fieldType))
  const size = formatMegabytes(sizeBytes)
  return `O arquivo tem ${size} e o limite para ${policyOf(fieldType).label} é ${limit}.`
}

/** O que o navegador sabe do arquivo escolhido, antes de qualquer chamada. */
export interface ChosenFile {
  readonly type: string
  readonly size: number
}

/**
 * A recusa do painel, ou `null` quando o arquivo pode seguir. O tipo vem do
 * navegador e pode chegar vazio (arquivo sem extensão reconhecida); vazio não é
 * tipo aceito, então cai na mesma recusa de tipo, que é a leitura correta.
 */
export function refusalFor(
  fieldType: MediaFieldType,
  file: ChosenFile,
): string | null {
  const policy = policyOf(fieldType)
  if (!policy.acceptedMimeTypes.includes(file.type.trim().toLowerCase())) {
    return unsupportedTypeMessage(fieldType)
  }
  if (file.size > maxBytesOf(fieldType)) {
    return fileTooLargeMessage(fieldType, file.size)
  }
  return null
}
