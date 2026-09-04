import type { MediaFieldType } from '@veggiedent/content-schema'
import type { RegisteredMedia } from '../src/media/media-gateway'
import type { MediaService, SendOutcome } from '../src/media/media-service'
import type { ProgressListener } from '../src/media/media-transfer'
import { refusalFor } from '../src/media/upload-policy'

/**
 * Dublê do envio de mídia: aplica a mesma recusa que o serviço de verdade
 * aplica antes de qualquer chamada e, quando o arquivo passa, registra a mídia
 * em memória e devolve o progresso que a tela mostra.
 *
 * Ele **conta as transferências**, e é essa contagem que prova o que interessa
 * nos testes de recusa: um arquivo recusado não chega a virar transferência
 * nenhuma.
 */

const PUBLIC_URL_PREFIX = 'https://armazenamento.test/veggiedent/'

export class FakeMediaService implements MediaService {
  readonly transferidos: string[] = []
  private readonly registradas = new Map<string, RegisteredMedia>()
  private nextNumber = 0

  /** Registra uma mídia como se ela já estivesse guardada de antes. */
  guardar(media: RegisteredMedia): RegisteredMedia {
    this.registradas.set(media.id, media)
    return media
  }

  async send(
    fieldType: MediaFieldType,
    file: File,
    onProgress: ProgressListener,
  ): Promise<SendOutcome> {
    const refusal = refusalFor(fieldType, file)
    if (refusal !== null) {
      return { status: 'recusada', message: refusal }
    }

    this.transferidos.push(file.name)
    onProgress(0.5)
    onProgress(1)

    this.nextNumber += 1
    const id = `00000000-0000-4000-8000-00000000000${this.nextNumber}`
    const media: RegisteredMedia = {
      id,
      kind: fieldType === 'imagem' ? 'image' : 'video',
      publicUrl: `${PUBLIC_URL_PREFIX}${file.name}`,
      mimeType: file.type,
      sizeBytes: file.size,
      originalFilename: file.name,
    }
    return { status: 'enviada', media: this.guardar(media) }
  }

  async describe(mediaId: string): Promise<RegisteredMedia | null> {
    return this.registradas.get(mediaId) ?? null
  }
}
