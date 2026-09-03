import type { MediaFieldType } from '@veggiedent/content-schema'
import type {
  MediaGateway,
  MediaKind,
  RegisteredMedia,
} from './media-gateway'
import { MediaTransferError, transferFor, type MediaTransfer, type ProgressListener } from './media-transfer'
import { refusalFor } from './upload-policy'

/**
 * O envio de um arquivo pelo painel, do começo ao fim (SDD § D-05).
 *
 * Os três passos moram aqui e em nenhum componente: pedir a credencial,
 * transferir os bytes direto ao armazenamento e confirmar à API. Um campo de
 * mídia na tela só precisa saber que entregou um arquivo e recebeu uma mídia
 * registrada — ou uma recusa com o motivo escrito em português.
 */

export type SendOutcome =
  | { readonly status: 'enviada'; readonly media: RegisteredMedia }
  | { readonly status: 'recusada'; readonly message: string }

export interface MediaService {
  /** Envia o arquivo e devolve a mídia registrada, ou a recusa e seu motivo. */
  send(
    fieldType: MediaFieldType,
    file: File,
    onProgress: ProgressListener,
  ): Promise<SendOutcome>
  /** O registro de uma mídia já guardada, para a prévia. `null` se sumiu. */
  describe(mediaId: string): Promise<RegisteredMedia | null>
}

const UNEXPECTED_FAILURE_MESSAGE =
  'Não foi possível enviar o arquivo. Tente de novo.'

function messageOf(failure: unknown): string {
  return failure instanceof MediaTransferError ? failure.message : UNEXPECTED_FAILURE_MESSAGE
}

/**
 * O envio contra a API do CMS.
 *
 * A recusa de tipo e de tamanho acontece **antes** de a credencial ser pedida:
 * um arquivo que o armazenamento nunca aceitaria não gasta ida à rede nem deixa
 * o operador esperando para ler um erro que já era conhecido.
 */
export class ApiMediaService implements MediaService {
  constructor(
    private readonly gateway: MediaGateway,
    private readonly accessToken: string,
    private readonly transferOf: (kind: MediaKind) => MediaTransfer = transferFor,
  ) {}

  async send(
    fieldType: MediaFieldType,
    file: File,
    onProgress: ProgressListener,
  ): Promise<SendOutcome> {
    const refusal = refusalFor(fieldType, file)
    if (refusal !== null) {
      return { status: 'recusada', message: refusal }
    }

    const credential = await this.gateway.requestUploadCredential(this.accessToken, {
      originalFilename: file.name,
      contentType: file.type,
      sizeBytes: file.size,
    })
    if (credential.status !== 'ok') {
      return { status: 'recusada', message: credential.message }
    }

    try {
      await this.transferOf(credential.value.kind)(credential.value, file, onProgress)
    } catch (failure) {
      return { status: 'recusada', message: messageOf(failure) }
    }

    const registered = await this.gateway.registerMedia(this.accessToken, {
      kind: credential.value.kind,
      path: credential.value.path,
      originalFilename: file.name,
    })
    return registered.status === 'ok'
      ? { status: 'enviada', media: registered.value }
      : { status: 'recusada', message: registered.message }
  }

  async describe(mediaId: string): Promise<RegisteredMedia | null> {
    const found = await this.gateway.getMedia(this.accessToken, mediaId)
    return found.status === 'ok' ? found.value : null
  }
}
