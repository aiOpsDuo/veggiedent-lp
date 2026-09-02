// Hook global — consumido por qualquer componente que dispare evento de tracking.
import { useCallback } from 'react'
import { pushEvent } from '../lib/tracking/dataLayer'
import type { TrackingEventName, TrackingPayload } from '../types/tracking'

export function useTracking() {
  const track = useCallback((eventName: TrackingEventName, payload?: TrackingPayload) => {
    pushEvent(eventName, payload)
  }, [])

  return { track }
}
