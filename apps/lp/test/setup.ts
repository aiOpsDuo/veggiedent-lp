import '@testing-library/jest-dom/vitest'

/**
 * O jsdom não implementa `matchMedia`, que `useReducedMotion` consulta em toda
 * seção animada. Sem ele, montar qualquer seção quebra antes de renderizar.
 * A resposta é "não peço menos movimento", que é o caminho padrão da página.
 */
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList
}

/**
 * O jsdom declara `play()` mas a implementação lança "Not implemented" e devolve
 * `undefined` em vez de uma Promise. O autoplay do banner de vídeo encadeia um
 * `.catch` nessa devolução, então sem esta substituição o teste quebra por conta
 * do ambiente, não do código.
 */
window.HTMLMediaElement.prototype.play = () => Promise.resolve()
