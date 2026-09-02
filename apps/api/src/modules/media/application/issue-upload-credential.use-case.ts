import { randomUUID } from 'node:crypto'
import { Inject, Injectable } from '@nestjs/common'
import { MEDIA_STORAGE, type MediaStorage } from '../domain/media-storage.port'
import { planUpload, type UploadRequest } from '../domain/upload-plan'
import type { UploadCredentialView } from './media-view'

/**
 * Passo 1 de 3 do envio de mídia (SDD § D-05): a API recebe nome, tipo e
 * tamanho, recusa o que não pode ser guardado e emite uma credencial temporária
 * para um caminho de destino.
 *
 * **Nenhum byte passa por aqui** — nem por este caso de uso, nem por nenhum
 * outro ponto da API. Vídeos chegam a centenas de MB, e é o navegador quem os
 * transfere, direto ao armazenamento, com a credencial emitida aqui.
 *
 * Também não há registro em `media_assets` neste passo: enquanto o upload não
 * for confirmado, não existe mídia (risco R-04).
 */
@Injectable()
export class IssueUploadCredentialUseCase {
  constructor(@Inject(MEDIA_STORAGE) private readonly storage: MediaStorage) {}

  async execute(request: UploadRequest): Promise<UploadCredentialView> {
    const target = planUpload(request, randomUUID())
    const credential = await this.storage.createUploadCredential(target)

    return {
      kind: target.policy.kind,
      bucket: target.policy.bucket,
      path: target.path,
      signedUrl: credential.signedUrl,
      token: credential.token,
      resumableEndpoint: credential.resumableEndpoint,
      expiresInSeconds: credential.expiresInSeconds,
      maxBytes: target.policy.maxBytes,
    }
  }
}
