// Texto fora do JSX, como constante nomeada (secao unica, sem .content.ts —
// ver Especificacao Funcional, secao 6.12).
const SKIP_LINK_TEXT = 'Pular para o conteúdo principal'

export function SkipToContentLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-brand-primary focus:px-4 focus:py-2 focus:text-ink-900 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-feedback-focus"
    >
      {SKIP_LINK_TEXT}
    </a>
  )
}
