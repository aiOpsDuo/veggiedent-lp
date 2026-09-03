import { useTracking } from '../../../hooks/useTracking'
import type { SectionContent } from '../../../content/published-content'

interface PartnerCardProps {
  partner: SectionContent<'onde_comprar'>['partners'][number]
}

// Partner logo — logo inteiramente clicavel, sem card/borda/sombra/botao separado.
// Design System v1.2, secao 9.11. Links abrem em nova aba com rel="noopener noreferrer"
// (Especificacao Funcional, secao 6.10).
export function PartnerCard({ partner }: PartnerCardProps) {
  const { track } = useTracking()

  return (
    <a
      href={partner.link}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => track('partner_click', { partner_name: partner.nome, destination_url: partner.link })}
      className="flex shrink-0 items-center justify-center px-6 opacity-90 transition-opacity hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-feedback-focus"
    >
      <img
        src={partner.logo}
        alt={partner.logoAlt}
        loading="lazy"
        className="h-auto max-h-16 w-auto max-w-[160px] object-contain"
      />
    </a>
  )
}
