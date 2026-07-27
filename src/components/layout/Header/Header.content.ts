// Fonte: Copy Deck v2.0, secao 1. Nenhum texto de navegacao/CTA vive no JSX.
import type { HeaderContent } from './Header.types'

export const headerContent: HeaderContent = {
  logoAlt: 'Veggiedent, por Virbac',
  navLinks: [
    { label: 'Saúde oral', href: '#educacao' },
    { label: 'Rotina de cuidado', href: '#rotina' },
    { label: 'Produto', href: '#produto' },
    { label: 'Onde comprar', href: '#onde-comprar' },
    { label: 'Perguntas frequentes', href: '#faq' },
  ],
  ctaDesktopLabel: 'Baixar o guia gratuito',
  ctaMobileLabel: 'Guia grátis',
  menuButtonAriaLabel: 'Abrir menu',
  mainNavAriaLabel: 'Menu principal',
}
