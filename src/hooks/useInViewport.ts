// Hook global — IntersectionObserver reutilizado para animacao de entrada
// e para o evento de tracking section_view. Ver Especificacao Funcional, secao 10.
import { useEffect, useRef, useState } from 'react'

interface UseInViewportOptions {
  threshold?: number
  triggerOnce?: boolean
}

export function useInViewport<T extends HTMLElement>({
  threshold = 0.2,
  triggerOnce = true,
}: UseInViewportOptions = {}) {
  const ref = useRef<T | null>(null)
  const [isInViewport, setIsInViewport] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInViewport(true)
          if (triggerOnce) observer.disconnect()
        } else if (!triggerOnce) {
          setIsInViewport(false)
        }
      },
      { threshold },
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [threshold, triggerOnce])

  return { ref, isInViewport }
}
