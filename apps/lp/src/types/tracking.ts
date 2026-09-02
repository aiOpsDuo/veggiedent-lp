// Tipos cross-secao de tracking (Especificacao Funcional, secao 10).

export type TrackingEventName =
  | 'page_view'
  | 'cta_click'
  | 'section_view'
  | 'video_start'
  | 'video_progress'
  | 'form_start'
  | 'form_submit_success'
  | 'form_submit_error'
  | 'ebook_download'
  | 'partner_click'

export type TrackingPayload = Record<string, string | number | boolean | undefined>
