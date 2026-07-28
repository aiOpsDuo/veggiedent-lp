import { useEffect, useRef } from 'react'
import type { NavLink } from '../Header.types'

interface MobileMenuProps {
  isOpen: boolean
  onClose: () => void
  navLinks: NavLink[]
  ctaLabel: string
  triggerRef: React.RefObject<HTMLButtonElement>
}

// Focus trap simples + Esc fecha e devolve o foco ao botao que abriu
// (Especificacao Funcional, secao 6.1 e 13).
export function MobileMenu({ isOpen, onClose, navLinks, ctaLabel, triggerRef }: MobileMenuProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return

    const panel = panelRef.current
    const focusable = panel?.querySelectorAll<HTMLElement>('a, button')
    focusable?.[0]?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
        triggerRef.current?.focus()
        return
      }

      if (event.key === 'Tab' && focusable && focusable.length > 0) {
        const first = focusable[0]
        const last = focusable[focusable.length - 1]

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose, triggerRef])

  if (!isOpen) return null

  return (
    <div
      ref={panelRef}
      id="mobile-menu"
      className="absolute left-0 right-0 top-full flex flex-col gap-1 border-t border-black/5 bg-surface-canvas px-4 py-4 shadow-sm md:hidden"
    >
      {navLinks.map((link) => (
        <a
          key={link.href}
          href={link.href}
          onClick={onClose}
          className="rounded-md px-3 py-3 text-base text-ink-900 hover:bg-surface-section-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-feedback-focus"
        >
          {link.label}
        </a>
      ))}
      <a
        href="#formulario"
        onClick={onClose}
        className="mt-2 inline-flex h-11 items-center justify-center rounded-md bg-brand-primary px-4 font-semibold text-ink-900 hover:bg-brand-primary-hover"
      >
        {ctaLabel}
      </a>
    </div>
  )
}
