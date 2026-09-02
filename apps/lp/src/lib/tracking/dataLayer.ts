// Ponto unico de saida de eventos para o dataLayer (compativel com Google Tag Manager).
// Ver Especificacao Funcional, secao 10.
import type { TrackingEventName, TrackingPayload } from '../../types/tracking'

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[]
  }
}

export function pushEvent(eventName: TrackingEventName, payload: TrackingPayload = {}): void {
  if (typeof window === 'undefined') return

  window.dataLayer = window.dataLayer ?? []
  window.dataLayer.push({ event: eventName, ...payload })

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug('[tracking]', eventName, payload)
  }
}
