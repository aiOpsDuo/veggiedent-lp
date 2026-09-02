import type { UploadTarget } from './upload-plan'

/** Token de injeção da porta. O domínio declara; a infraestrutura implementa. */
export const MEDIA_STORAGE = Symbol('MediaStorage')

/**
 * A credencial temporária que o navegador recebe (SDD § D-05).
 *
 * É de escopo e validade limitados: vale para **um** caminho, em **um** bucket,
 * por um tempo curto. A chave secreta do Supabase, que a emitiu, nunca sai do
 * servidor.
 */
export interface UploadCredential {
  /** Endereço de envio direto, para arquivo que cabe em uma requisição. */
  readonly signedUrl: string
  /** O mesmo direito de escrita, na forma que o upload retomável usa. */
  readonly token: string
  /** Endereço do protocolo retomável, para vídeo grande enviado em blocos. */
  readonly resumableEndpoint: string
  readonly expiresInSeconds: number
}

/** O que o armazenamento sabe sobre um arquivo já enviado. */
export interface StoredObject {
  readonly sizeBytes: number
  readonly mimeType: string | null
}

/**
 * Fronteira com o armazenamento de arquivos (SDD § "Camadas e padrão
 * arquitetural" — Hexagonal na fronteira com serviços externos).
 *
 * Nenhum método recebe ou devolve bytes, e isso é a regra de D-05 escrita no
 * tipo: a API emite credencial, confere que o arquivo chegou e apaga; quem
 * transfere o conteúdo é o navegador, direto com o armazenamento.
 */
export interface MediaStorage {
  createUploadCredential(target: UploadTarget): Promise<UploadCredential>
  /** `null` quando não há arquivo no caminho — upload não concluído. */
  findObject(bucket: string, path: string): Promise<StoredObject | null>
  publicUrlFor(bucket: string, path: string): string
  remove(bucket: string, path: string): Promise<void>
}
