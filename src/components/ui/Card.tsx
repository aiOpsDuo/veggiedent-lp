import type { HTMLAttributes, ReactNode } from 'react'

// Casco visual reutilizado por EducationalCard, PartnerCard, RoutineStep,
// o formulario de captura de lead e os cards do infografico de claims —
// fundo, raio e sombra padrao (Design System v1.2, secoes 9.4/9.5/9.6/9.11).
// `as` permite renderizar como <li> quando o item precisa ser parte de uma
// lista semantica (ex.: RotinaCuidado usa <ol>/<li>) sem duplicar as classes.
interface CardProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode
  variant?: 'card' | 'section-alt'
  as?: 'div' | 'li'
}

export function Card({ children, variant = 'card', as = 'div', className = '', ...rest }: CardProps) {
  const bg = variant === 'card' ? 'bg-surface-card' : 'bg-surface-section-alt'
  const classes = `rounded-lg ${bg} p-6 shadow-sm ring-1 ring-black/5 ${className}`.trim()
  const Tag = as

  return (
    <Tag className={classes} {...rest}>
      {children}
    </Tag>
  )
}
