import type { HTMLAttributes, ReactNode } from 'react'

// Wrapper repetido identicamente em 9 secoes de conteudo (auditoria v1.0,
// item 5/6): container centralizado, max-width, espacamento lateral e
// vertical padrao. Nao cobre Hero (layout proprio, 2 colunas) nem Header/
// Footer (chrome de pagina, fora do escopo de "secao de conteudo").
interface SectionShellProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode
}

export function SectionShell({ children, className = '', ...rest }: SectionShellProps) {
  return (
    <section
      className={`mx-auto max-w-content px-4 py-12 sm:px-8 lg:py-24 ${className}`.trim()}
      {...rest}
    >
      {children}
    </section>
  )
}
