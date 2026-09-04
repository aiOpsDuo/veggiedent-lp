// Leitura tipada das variaveis de ambiente (Especificacao Funcional, secao 8.6).
// Nunca ler import.meta.env diretamente em componentes — sempre atraves deste modulo.

export type EbookDeliveryMode = 'download' | 'email'

export const env = {
  ebookUrl: (import.meta.env.VITE_EBOOK_URL as string | undefined) ?? '',
  ebookDeliveryMode: ((import.meta.env.VITE_EBOOK_DELIVERY_MODE as string | undefined) ??
    'email') as EbookDeliveryMode,
  /**
   * Para onde o formulario de captura envia o lead. Relativo pela mesma razao
   * que `contentEndpoint`: LP e API compartilham dominio.
   */
  leadSubmitEndpoint:
    (import.meta.env.VITE_LEAD_SUBMIT_ENDPOINT as string | undefined) ?? '/api/leads',
  /**
   * De onde a LP le o conteudo publicado (SDD, D-08). O padrao e relativo
   * porque LP e API compartilham dominio: `/` serve a pagina e `/api/*` alcanca
   * a API, tanto na entrada unica de desenvolvimento quanto em producao.
   */
  contentEndpoint: (import.meta.env.VITE_CONTENT_ENDPOINT as string | undefined) ?? '/api/content',
}

/** true somente quando ha uma URL real configurada para download direto do e-book. */
export const hasEbookDownloadUrl = (): boolean =>
  env.ebookDeliveryMode === 'download' && env.ebookUrl.trim().length > 0
