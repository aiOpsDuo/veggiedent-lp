import type { ReactNode } from 'react'

/**
 * O cartão que agrupa visualmente um bloco de conteúdo — campos de um
 * formulário, uma lista, um filtro (T35, item 7). Existia como a mesma classe
 * repetida em seis telas (`rounded border border-slate-200 bg-white p-4`,
 * regra G5); vira um componente só para que espaçamento, tema escuro e a
 * entrada suave (item 6) fiquem consistentes em todo lugar que o usa, e para
 * que uma mudança de estilo não exija editar seis arquivos.
 */
interface CardProps {
  readonly children: ReactNode
  readonly className?: string
}

export function Card({ children, className = '' }: CardProps): JSX.Element {
  return (
    <div
      className={`animate-fade-in-up rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 ${className}`}
    >
      {children}
    </div>
  )
}
