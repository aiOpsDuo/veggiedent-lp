import type { UploadTarget } from './upload-plan'

/** Token de injeção da porta. O domínio declara; a infraestrutura implementa. */
export const MEDIA_STORAGE = Symbol('MediaStorage')

/**
 * A credencial temporária que o navegador recebe (SDD § D-05, reescrita em
 * 2026-09-21).
 *
 * É de escopo e validade limitados: vale para **um** caminho, em **um** bucket,
 * por um tempo curto. A chave de acesso do MinIO, que a emitiu, nunca sai do
 * servidor.
 *
 * **Antes (Supabase Storage/TUS)** este tipo carregava três formas de
 * autorização — `signedUrl` (envio de um arquivo só), `token` (o mesmo direito
 * de escrita, na forma que o protocolo retomável exige) e `resumableEndpoint`
 * (o endereço desse protocolo, para vídeo grande em blocos) — porque o
 * Supabase Storage oferecia os dois caminhos e o painel escolhia um deles em
 * tempo de execução.
 *
 * **Agora (MinIO)** só existe uma forma de autorização: uma URL `PUT`
 * pré-assinada, escopada a um bucket e caminho, por tempo limitado. O MinIO
 * também suporta multipart em blocos, mas D-05 descarta reproduzi-lo: o teto
 * de 50 MB do projeto não justifica a complexidade de orquestrar upload em
 * partes. Sem upload retomável, não há um "mesmo direito em outra forma" nem
 * um endereço de protocolo separado para descrever — por isso `token` e
 * `resumableEndpoint` saem do tipo, e não são substituídos por equivalentes.
 */
export interface UploadCredential {
  /** Endereço `PUT` de envio direto — a única forma de upload que existe. */
  readonly uploadUrl: string
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
