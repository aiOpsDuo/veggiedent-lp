import type { HTMLAttributes, ReactNode } from 'react'

// H2 padrao repetido identicamente em 9 secoes (auditoria v1.0, item 5/6).
interface SectionHeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  children: ReactNode
}

export function SectionHeading({ children, className = '', ...rest }: SectionHeadingProps) {
  return (
    <h2
      className={`max-w-[60ch] text-2xl font-semibold text-ink-900 sm:text-[28px] ${className}`.trim()}
      {...rest}
    >
      {children}
    </h2>
  )
}
