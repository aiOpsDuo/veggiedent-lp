import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from 'react'

// Button/Primary, Button/Secondary — Design System v1.2, secao 9.3.
// Altura minima de toque 44px em qualquer variante (acessibilidade).

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
  link: 'text-brand-primary underline-offset-2 hover:underline focus-visible:underline bg-transparent p-0 min-h-0',
}

const baseClasses =
  'inline-flex min-h-[44px] items-center justify-center leading-none rounded-md px-6 py-3 text-base font-semibold transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-feedback-focus disabled:cursor-not-allowed'

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
