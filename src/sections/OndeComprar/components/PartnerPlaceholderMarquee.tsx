import { Building2, Globe, ShoppingBag, ShoppingCart, Store, Truck } from 'lucide-react'
import { useReducedMotion } from '../../../hooks/useReducedMotion'

// Marquee/Placeholder — OndeComprar.content.ts mantem `partners: []` de
// proposito (lista oficial de parceiros/marketplaces ainda [BLOQUEADO]).
// Enquanto essa lista nao chega, a secao nao pode ficar com uma unica linha
// de texto "em breve": este componente simula a presenca de parceiros com
// categorias genericas (nenhum logo ou nome de marca inventado) em uma
// faixa continua, so para preencher o espaco com movimento discreto.
//
// Import-e-troque: quando os parceiros reais forem confirmados, o card de
// categoria abaixo e trocado 1:1 pelo <PartnerCard partner={...} /> real
// dentro do map do OndeComprar.tsx (ver comentario la) -- nenhuma mudanca de
// estrutura, apenas a fonte de dados.
const placeholderCategories = [
  { label: 'Pet shops parceiros', Icon: Store },
  { label: 'Marketplaces', Icon: ShoppingCart },
  { label: 'Lojas online', Icon: Globe },
  { label: 'Farmácias veterinárias', Icon: Building2 },
  { label: 'Redes de pet shop', Icon: ShoppingBag },
  { label: 'Entrega rápida', Icon: Truck },
] as const

function MarqueeTrack() {
  return (
    <>
      {placeholderCategories.map(({ label, Icon }) => (
        <div
          key={label}
          className="flex min-w-[200px] shrink-0 items-center gap-3 rounded-xl bg-surface-card px-5 py-4 shadow-sm ring-1 ring-black/5"
        >
          <Icon className="h-5 w-5 shrink-0 text-ink-400" strokeWidth={1.75} />
          <span className="text-sm font-medium text-ink-400">{label}</span>
        </div>
      ))}
    </>
  )
}

export function PartnerPlaceholderMarquee() {
  const reducedMotion = useReducedMotion()

  return (
    <div
      role="presentation"
      aria-hidden="true"
      className="group relative mt-8 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_48px,black_calc(100%-48px),transparent)]"
    >
      {reducedMotion ? (
        <div className="flex flex-wrap gap-4">
          <MarqueeTrack />
        </div>
      ) : (
        <div className="flex w-max gap-4 animate-[partner-marquee_26s_linear_infinite] group-hover:[animation-play-state:paused]">
          <div className="flex shrink-0 gap-4">
            <MarqueeTrack />
          </div>
          <div className="flex shrink-0 gap-4">
            <MarqueeTrack />
          </div>
        </div>
      )}
    </div>
  )
}
