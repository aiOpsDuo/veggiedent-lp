// Leitura tipada das variaveis de ambiente (Especificacao Funcional, secao 8.6).
// Nunca ler import.meta.env diretamente em componentes — sempre atraves deste modulo.

export type EbookDeliveryMode = 'download' | 'email'

export const env = {
  ebookUrl: (import.meta.env.VITE_EBOOK_URL as string | undefined) ?? '',
  ebookDeliveryMode: ((import.meta.env.VITE_EBOOK_DELIVERY_MODE as string | undefined) ??
    'email') as EbookDeliveryMode,
  leadSubmitEndpoint:
    (import.meta.env.VITE_LEAD_SUBMIT_ENDPOINT as string | undefined) ?? '/api/rdstation-lead',
}

/** true somente quando ha uma URL real configurada para download direto do e-book. */
export const hasEbookDownloadUrl = (): boolean =>
  env.ebookDeliveryMode === 'download' && env.ebookUrl.trim().length > 0
