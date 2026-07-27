// Nomes de evento como constantes — nunca strings soltas nos componentes.
import type { TrackingEventName } from '../../types/tracking'

export const TRACKING_EVENTS: Record<string, TrackingEventName> = {
  PAGE_VIEW: 'page_view',
  CTA_CLICK: 'cta_click',
  SECTION_VIEW: 'section_view',
  VIDEO_START: 'video_start',
  VIDEO_PROGRESS: 'video_progress',
  FORM_START: 'form_start',
  FORM_SUBMIT_SUCCESS: 'form_submit_success',
  FORM_SUBMIT_ERROR: 'form_submit_error',
  EBOOK_DOWNLOAD: 'ebook_download',
  PARTNER_CLICK: 'partner_click',
}
