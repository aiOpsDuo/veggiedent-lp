import { Card } from '../../../components/ui/Card'
import { useTracking } from '../../../hooks/useTracking'
import type { Partner } from '../OndeComprar.types'

interface PartnerCardProps {
  partner: Partner
}

// Card/Partner — Design System v1.2, secao 9.11. Todos os links abrem em
// nova aba com rel="noopener noreferrer" e UTM proprio por parceiro
// (Especificacao Funcional, secao 6.10).
export function PartnerCard({ partner }: PartnerCardProps) {
  const { track } = useTracking()

  return (
    <Card className="flex flex-col items-center gap-4 text-center">
      <img src={partner.logoUrl} alt={partner.nome} className="h-10 w-auto" />
      <a
        href={partner.link}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => track('partner_click', { partner_name: partner.nome, destination_url: partner.link })}
        className="inline-flex h-11 items-center justify-center rounded-md border border-brand-primary px-4 text-sm font-semibold text-brand-primary hover:bg-brand-primary/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-feedback-focus"
      >
        Comprar na {partner.nome}
      </a>
    </Card>
  )
}
