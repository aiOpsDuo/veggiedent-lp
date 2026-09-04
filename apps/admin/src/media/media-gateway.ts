/**
 * A porta pela qual o painel alcança as rotas de mídia da API
 * (SDD § "Endpoints administrativos"). Como em `sections-gateway.ts`, as telas
 * dependem desta interface e nunca da classe que fala HTTP.
 *
 * **Nenhum método daqui carrega bytes.** A API emite a credencial e registra o
 * que chegou; quem transfere o arquivo é o navegador, direto ao armazenamento
 * (SDD § D-05).
 */

/** As duas naturezas de mídia, como a API as nomeia. */
export type MediaKind = 'image' | 'video'

/** O que o painel declara à API antes de enviar: nome, tipo e tamanho. */
export interface UploadRequest {
  readonly originalFilename: string
  readonly contentType: string
  readonly sizeBytes: number
}

/** Passo 1 de 3: o direito temporário de escrever em um caminho, e o caminho. */
export interface UploadCredential {
  readonly kind: MediaKind
  readonly bucket: string
  readonly path: string
  /** Endereço de envio direto, para arquivo que cabe em uma requisição. */
  readonly signedUrl: string
  /** O mesmo direito de escrita, na forma que o upload retomável usa. */
  readonly token: string
  /** Endereço do protocolo retomável, para vídeo enviado em blocos. */
  readonly resumableEndpoint: string
  readonly expiresInSeconds: number
  readonly maxBytes: number
}

/** Passo 3 de 3: a confirmação de que o arquivo terminou de subir. */
export interface RegisterRequest {
  readonly kind: MediaKind
  readonly path: string
  readonly originalFilename: string
}

/** O registro da mídia, como o painel o exibe e o referencia. */
export interface RegisteredMedia {
  readonly id: string
  readonly kind: MediaKind
  readonly publicUrl: string
  readonly mimeType: string
  readonly sizeBytes: number
  readonly originalFilename: string
}

/**
 * O resultado de uma chamada de mídia. `recusado` traz a mensagem que a API
 * escreveu, em português, e é ela que chega ao operador — o painel não a
 * traduz nem a substitui por texto genérico.
 */
export type MediaResult<T> =
  | { readonly status: 'ok'; readonly value: T }
  | { readonly status: 'recusado'; readonly message: string }

export interface MediaGateway {
  requestUploadCredential(
    accessToken: string,
    request: UploadRequest,
  ): Promise<MediaResult<UploadCredential>>
  registerMedia(
    accessToken: string,
    request: RegisterRequest,
  ): Promise<MediaResult<RegisteredMedia>>
  getMedia(accessToken: string, id: string): Promise<MediaResult<RegisteredMedia>>
}
