import type { UploadCredentialView } from '../modules/media/application/media-view'
import { publicObjectUrl } from './public-object-url'

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
 * Envio direto ao Supabase Storage pela URL assinada, no protocolo que o
 * cliente oficial usa: `PUT` na URL da credencial, com o tipo do arquivo no
 * cabeçalho e os bytes no corpo.
 */
export class SignedUrlUploader implements MediaUploader {
  async upload(credential: UploadCredentialView, file: MediaBytes): Promise<void> {
    const response = await fetch(credential.signedUrl, {
      method: 'PUT',
      headers: {
        'content-type': file.contentType,
        'cache-control': `max-age=${CACHE_SECONDS}`,
        'x-upsert': 'false',
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
 */
export class PublicStorageProbe implements TargetStorage {
  constructor(private readonly supabaseUrl: string) {}

  async hasObject(bucket: string, objectPath: string): Promise<boolean> {
    const response = await fetch(publicObjectUrl(this.supabaseUrl, bucket, objectPath), {
      method: 'HEAD',
    })
    return response.status === OK_STATUS
  }
}
