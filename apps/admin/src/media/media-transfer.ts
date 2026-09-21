import type { MediaKind, UploadCredential } from './media-gateway'

/**
 * Passo 2 de 3 do envio de mídia (SDD § D-05): os bytes vão do navegador
 * **direto ao armazenamento**, com a credencial temporária que a API emitiu.
 * Nada aqui fala com a API — nem para começar, nem para terminar.
 *
 * **Revisto em 2026-09-21 (D-05, troca do Supabase Storage pelo MinIO):**
 * antes havia dois caminhos, escolhidos pela natureza da mídia — arquivo
 * pequeno em uma requisição só, vídeo em blocos pelo protocolo retomável
 * (TUS). A API agora emite uma única `uploadUrl` (URL `PUT` pré-assinada do
 * MinIO, protocolo S3) para as duas naturezas — não há mais endereço de
 * protocolo retomável a apontar. Um único caminho, `PUT` direto, serve
 * imagem e vídeo. `TRANSFERS_BY_KIND`/`transferFor` continuam existindo para
 * não mudar o ponto de injeção que `media-service.ts` já usa, mas as duas
 * entradas do mapa agora apontam para a mesma função.
 */

/** Fração já enviada, entre 0 e 1. Quem mostra decide como exibi-la. */
export type ProgressListener = (fraction: number) => void

export type MediaTransfer = (
  credential: UploadCredential,
  file: File,
  onProgress: ProgressListener,
) => Promise<void>

const HTTP_OK = 200
const HTTP_MULTIPLE_CHOICES = 300

export class MediaTransferError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MediaTransferError'
  }
}

function refusedByStorage(status: number): MediaTransferError {
  return new MediaTransferError(
    `O armazenamento recusou o arquivo (erro ${status}). Tente de novo; se persistir, verifique o tamanho e o tipo do arquivo.`,
  )
}

const CONNECTION_LOST_MESSAGE =
  'A conexão caiu durante o envio do arquivo. Verifique a rede e tente de novo.'

/**
 * Envio direto pela URL pré-assinada, único caminho agora para as duas
 * naturezas de mídia (SDD § D-05, reescrita em 2026-09-21). Um vídeo
 * interrompido a 90% precisa ser reenviado inteiro — não há retomada por
 * bloco —, mas o teto de 50 MB do projeto torna isso tolerável (trade-off
 * aceito no SDD).
 *
 * É `XMLHttpRequest` e não `fetch` por um motivo só: só ele informa quanto do
 * corpo já subiu, e progresso visível é requisito (SDD § C-07).
 */
const directTransfer: MediaTransfer = (credential, file, onProgress) =>
  new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('PUT', credential.uploadUrl, true)
    request.setRequestHeader('content-type', file.type)

    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(event.loaded / event.total)
      }
    })
    request.addEventListener('load', () => {
      if (request.status >= HTTP_OK && request.status < HTTP_MULTIPLE_CHOICES) {
        onProgress(1)
        resolve()
        return
      }
      reject(refusedByStorage(request.status))
    })
    request.addEventListener('error', () => reject(new MediaTransferError(CONNECTION_LOST_MESSAGE)))
    request.addEventListener('abort', () => reject(new MediaTransferError(CONNECTION_LOST_MESSAGE)))

    request.send(file)
  })

/**
 * Quem transfere cada natureza de mídia. Uma natureza nova é uma entrada a
 * mais aqui. As duas naturezas hoje compartilham o mesmo único caminho de
 * transferência — o mapa continua existindo para preservar o ponto de
 * injeção que `ApiMediaService` já usa (`transferOf(kind)`), não porque haja
 * escolha real a fazer entre elas.
 */
export const TRANSFERS_BY_KIND: Readonly<Record<MediaKind, MediaTransfer>> = {
  image: directTransfer,
  video: directTransfer,
}

export function transferFor(kind: MediaKind): MediaTransfer {
  return TRANSFERS_BY_KIND[kind]
}
