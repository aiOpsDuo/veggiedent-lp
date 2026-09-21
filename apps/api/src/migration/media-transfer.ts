import type { UploadCredentialView } from '../modules/media/application/media-view'

/**
 * As três conversas com arquivos que a carga precisa, cada uma como uma porta
 * (SDD § D-05): de onde os bytes vêm, para onde vão, e o que o ambiente de
 * destino já tem.
 *
 * São portas, e não funções concretas, porque quem faz cada papel muda entre a
 * execução real e o teste de ponta a ponta — que exercita a aplicação inteira
 * com o armazenamento em memória. Nenhum byte passa pela API em qualquer dos
 * dois casos: ela vê nome, tipo, tamanho e caminho.
 */

/** De onde os bytes vêm: a URL pública que o instantâneo guardou. */
export interface SnapshotMediaSource {
  download(publicUrl: string): Promise<ArrayBuffer>
}

/** Para onde os bytes vão: o passo 2 de 3 do envio de mídia. */
export interface MediaUploader {
  upload(credential: UploadCredentialView, file: MediaBytes): Promise<void>
}

export interface MediaBytes {
  readonly bytes: ArrayBuffer
  readonly contentType: string
}

/**
 * O que o ambiente de destino já guarda. Responder "sim" evita reenviar bytes
 * que já estão lá — e, com isso, evita criar um segundo objeto e um segundo
 * registro para o mesmo arquivo.
 */
export interface TargetStorage {
  hasObject(bucket: string, objectPath: string): Promise<boolean>
}

export class MediaDownloadError extends Error {
  constructor(publicUrl: string, status: number) {
    super(`Não consegui baixar ${publicUrl}: o servidor respondeu ${status}.`)
    this.name = 'MediaDownloadError'
  }
}

export class SignedUrlUploadError extends Error {
  constructor(path: string, status: number, body: string) {
    super(`Envio de ${path} recusado pelo armazenamento (${status}): ${body}`)
    this.name = 'SignedUrlUploadError'
  }
}

/** Leitura anônima da URL pública, o mesmo caminho que o navegador percorre. */
export class HttpMediaSource implements SnapshotMediaSource {
  async download(publicUrl: string): Promise<ArrayBuffer> {
    const response = await fetch(publicUrl)
    if (!response.ok) {
      throw new MediaDownloadError(publicUrl, response.status)
    }
    return response.arrayBuffer()
  }
}

/** Cache do navegador para as mídias públicas: uma hora, como o padrão do Storage. */
const CACHE_SECONDS = 3600

/**
 * Envio direto ao armazenamento pela URL pré-assinada: um `PUT` só, com o
 * tipo do arquivo no cabeçalho e os bytes no corpo (SDD § D-05, reescrita em
 * 2026-09-21 — `credential.uploadUrl`, não mais `credential.signedUrl`).
 *
 * `x-upsert` saiu: era um cabeçalho do Supabase Storage, sem equivalente no
 * MinIO — a URL `PUT` pré-assinada do MinIO não distingue criar de
 * sobrescrever, e a idempotência do envio já é garantida por outro lugar
 * (`RegisterMediaUseCase.execute`, via `findByStoragePath`).
 */
export class SignedUrlUploader implements MediaUploader {
  async upload(credential: UploadCredentialView, file: MediaBytes): Promise<void> {
    const response = await fetch(credential.uploadUrl, {
      method: 'PUT',
      headers: {
        'content-type': file.contentType,
        'cache-control': `max-age=${CACHE_SECONDS}`,
      },
      body: file.bytes,
    })

    if (!response.ok) {
      throw new SignedUrlUploadError(credential.path, response.status, await response.text())
    }
  }
}

const OK_STATUS = 200

/**
 * Pergunta ao próprio armazenamento de destino, pela URL pública, se o objeto
 * está lá. `HEAD` porque a resposta que interessa é o código, não os bytes —
 * são até dezenas de MB por vídeo.
 *
 * O destino é o MinIO (SDD § D-05, reescrita em 2026-09-21): a URL segue o
 * mesmo formato que `MinioMediaStorage.publicUrlFor` usa para servir o
 * conteúdo (`${MINIO_ENDPOINT}/${bucket}/${path}`), não mais o formato do
 * Supabase Storage de `publicObjectUrl` — esse continua correto como está,
 * mas interpreta URLs **do instantâneo** (histórico, nunca muda), não as do
 * destino. `bucket` aqui já chega como o nome físico do bucket
 * (`veggiedent-images`/`veggiedent-videos`, SDD § "Modelo de dados"): é o
 * mesmo nome que o domínio declara e que a configuração padrão do MinIO usa
 * para os dois buckets, então nenhuma tradução adicional é necessária.
 */
export class PublicStorageProbe implements TargetStorage {
  constructor(private readonly minioEndpoint: string) {}

  async hasObject(bucket: string, objectPath: string): Promise<boolean> {
    const endpoint = this.minioEndpoint.replace(/\/+$/, '')
    const response = await fetch(`${endpoint}/${bucket}/${objectPath}`, {
      method: 'HEAD',
    })
    return response.status === OK_STATUS
  }
}
