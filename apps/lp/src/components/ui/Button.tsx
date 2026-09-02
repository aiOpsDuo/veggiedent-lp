import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from 'react'

// Button/Primary, Button/Secondary — Design System v1.2, secao 9.3.
// Altura minima de toque 44px em qualquer variante (acessibilidade).
// Tipografia: Inter SemiBold (600) via font-ui — metricas mais estaveis
// que Manjari em tamanhos de CTA, garantindo centralizacao vertical precisa.

type Variant = 'primary' | 'secondary' | 'link'

interface CommonProps {
  variant?: Variant
  children: ReactNode
}

type ButtonAsButton = CommonProps &
  ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined }

type ButtonAsAnchor = CommonProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }

export type ButtonProps = ButtonAsButton | ButtonAsAnchor

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-brand-primary text-ink-900 hover:bg-brand-primary-hover active:scale-[0.98] disabled:opacity-40',
  secondary:
    'border border-brand-primary text-brand-primary bg-transparent hover:bg-brand-primary/5 active:scale-[0.98] disabled:opacity-40',
  link: 'text-brand-primary underline-offset-2 hover:underline focus-visible:underline bg-transparent p-0 h-auto min-h-0 leading-normal',
}

const baseClasses =
  'inline-flex h-11 items-center justify-center font-ui font-semibold leading-none rounded-md px-6 text-base transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-feedback-focus disabled:cursor-not-allowed'

export const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  function Button({ variant = 'primary', children, className = '', ...rest }, ref) {
    const classes = `${baseClasses} ${variantClasses[variant]} ${className}`.trim()

    if ('href' in rest && rest.href) {
      return (
        <a ref={ref as React.Ref<HTMLAnchorElement>} className={classes} {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}>
          {children}
        </a>
      )
    }

    return (
      <button ref={ref as React.Ref<HTMLButtonElement>} className={classes} {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}>
        {children}
      </button>
    )
  },
)
