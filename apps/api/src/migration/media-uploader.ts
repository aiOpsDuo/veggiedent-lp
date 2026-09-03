import { readFile } from 'node:fs/promises'
import type { UploadCredentialView } from '../modules/media/application/media-view'

/**
 * Passo 2 de 3 do envio de mídia (SDD § D-05): os bytes vão do cliente direto
 * ao armazenamento, com a credencial que a API emitiu. **A API não os vê.**
 *
 * É uma porta, e não uma função concreta, porque quem faz esse papel muda:
 * no painel é o navegador, na migração é este processo, e no teste de ponta a
 * ponta é o dublê de armazenamento. Quem orquestra a migração não precisa saber
 * qual dos três está do outro lado (DIP).
 */
export interface MediaUploader {
  upload(credential: UploadCredentialView, file: LocalFile): Promise<void>
}

/** Um arquivo do repositório a caminho do armazenamento. */
export interface LocalFile {
  readonly path: string
  readonly contentType: string
  readonly sizeBytes: number
}

/** Cache do navegador para as mídias públicas: uma hora, como o padrão do Storage. */
const CACHE_SECONDS = 3600

export class SignedUrlUploadError extends Error {
  constructor(path: string, status: number, body: string) {
    super(`Envio de ${path} recusado pelo armazenamento (${status}): ${body}`)
    this.name = 'SignedUrlUploadError'
  }
}

/**
 * Envio direto ao Supabase Storage pela URL assinada, no protocolo que o
 * cliente oficial usa: `PUT` na URL da credencial, com o tipo do arquivo no
 * cabeçalho e os bytes no corpo.
 */
export class SignedUrlUploader implements MediaUploader {
  async upload(credential: UploadCredentialView, file: LocalFile): Promise<void> {
    const response = await fetch(credential.signedUrl, {
      method: 'PUT',
      headers: {
        'content-type': file.contentType,
        'cache-control': `max-age=${CACHE_SECONDS}`,
        'x-upsert': 'false',
      },
      body: await readFile(file.path),
    })

    if (!response.ok) {
      throw new SignedUrlUploadError(credential.path, response.status, await response.text())
    }
  }
}
