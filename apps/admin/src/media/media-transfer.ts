import { Upload } from 'tus-js-client'
import type { MediaKind, UploadCredential } from './media-gateway'

/**
 * Passo 2 de 3 do envio de mídia (SDD § D-05): os bytes vão do navegador
 * **direto ao armazenamento**, com a credencial temporária que a API emitiu.
 * Nada aqui fala com a API — nem para começar, nem para terminar.
 *
 * Dois caminhos, escolhidos pela natureza da mídia e não por um `if` espalhado:
 * arquivo pequeno vai em uma requisição só; vídeo vai em blocos, pelo protocolo
 * retomável, que é o que permite continuar de onde parou quando a conexão cai.
 */

/** Fração já enviada, entre 0 e 1. Quem mostra decide como exibi-la. */
export type ProgressListener = (fraction: number) => void

export type MediaTransfer = (
  credential: UploadCredential,
  file: File,
  onProgress: ProgressListener,
) => Promise<void>

/** Cache do navegador para as mídias públicas: uma hora, o padrão do Storage. */
const CACHE_SECONDS = 3600

/**
 * Tamanho de bloco exigido pelo Supabase Storage no protocolo retomável. A
 * documentação é explícita em não mudar este valor.
 */
const RESUMABLE_CHUNK_BYTES = 6 * 1024 * 1024

/** Espera entre tentativas depois de uma falha de rede, em milissegundos. */
const RETRY_DELAYS = [0, 3000, 5000, 10000, 20000]

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
 * Envio direto pela URL assinada, no mesmo protocolo que o
 * `uploadToSignedUrl(path, token, file)` do `@supabase/supabase-js` usa.
 *
 * É `XMLHttpRequest` e não `fetch` por um motivo só: só ele informa quanto do
 * corpo já subiu, e progresso visível é requisito (SDD § C-07).
 */
const directTransfer: MediaTransfer = (credential, file, onProgress) =>
  new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('PUT', credential.signedUrl, true)
    request.setRequestHeader('content-type', file.type)
    request.setRequestHeader('cache-control', `max-age=${CACHE_SECONDS}`)
    request.setRequestHeader('x-upsert', 'false')

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
 * Envio retomável (TUS) para vídeo, apontado ao endereço assinado que a API
 * devolve, com o token no cabeçalho `x-signature` e blocos de 6 MB — o contrato
 * que a T7 implementou e verificou contra o projeto hospedado.
 *
 * Retomável aqui significa o que o protocolo entrega de fato: cada bloco já
 * aceito fica aceito, e uma queda de conexão faz o cliente recomeçar do último
 * deslocamento confirmado, não do início do arquivo. **Não** é retomada entre
 * recarregamentos da página: a credencial e o caminho de destino são emitidos a
 * cada tentativa, então uma página recarregada começa um envio novo, para um
 * caminho novo. Prometer o contrário seria prometer o que este fluxo não faz.
 */
const resumableTransfer: MediaTransfer = (credential, file, onProgress) =>
  new Promise((resolve, reject) => {
    const upload = new Upload(file, {
      endpoint: credential.resumableEndpoint,
      headers: { 'x-signature': credential.token },
      chunkSize: RESUMABLE_CHUNK_BYTES,
      retryDelays: RETRY_DELAYS,
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: credential.bucket,
        objectName: credential.path,
        contentType: file.type,
        cacheControl: String(CACHE_SECONDS),
      },
      onProgress: (sent, total) => {
        if (total > 0) {
          onProgress(sent / total)
        }
      },
      onError: (error) => reject(new MediaTransferError(transferMessageOf(error))),
      onSuccess: () => {
        onProgress(1)
        resolve()
      },
    })

    upload.start()
  })

/**
 * O erro do cliente TUS embrulha a resposta do armazenamento. Quando ela existe,
 * o status dela diz mais ao operador do que a mensagem técnica de dentro.
 */
function transferMessageOf(error: unknown): string {
  const status = (error as { originalResponse?: { getStatus?: () => number } })
    .originalResponse?.getStatus?.()
  return typeof status === 'number' && status > 0
    ? refusedByStorage(status).message
    : CONNECTION_LOST_MESSAGE
}

/**
 * Quem transfere cada natureza de mídia. Uma natureza nova é uma entrada a mais
 * aqui, sem tocar em nenhum dos dois caminhos que já existem.
 */
export const TRANSFERS_BY_KIND: Readonly<Record<MediaKind, MediaTransfer>> = {
  image: directTransfer,
  video: resumableTransfer,
}

export function transferFor(kind: MediaKind): MediaTransfer {
  return TRANSFERS_BY_KIND[kind]
}
