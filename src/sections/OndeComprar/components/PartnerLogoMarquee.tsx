import { useTracking } from '../../../hooks/useTracking'
import { useReducedMotion } from '../../../hooks/useReducedMotion'
import type { Partner } from '../OndeComprar.types'

interface PartnerLogoMarqueeProps {
  partners: Partner[]
}

// Marquee de logos reais — esteira continua sem salto perceptivel.
//
// Tecnica: container unico w-max com COPIES copias identicas da lista,
// animado por translateX(calc(-100% / COPIES)) = exatamente uma largura
// de copia por ciclo. Ao reiniciar (reset para 0), as copias seguintes
// estao alinhadas identicamente, tornando o reset imperceptivel.
//
// Por que COPIES = 6:
//   min-w-[220px] por item, 4 parceiros = min 880px por copia.
//   Para cobrir 4K (3840px): (N - 1) * 880 >= 3840 -> N >= 5.36 -> N = 6.
//   (6 - 1) * 880 = 4400px > 3840px. Seguro em qualquer monitor.
//
// Acessibilidade: apenas a primeira copia e lida por leitores de tela.
// Reduced-motion: lista estatica em flex-wrap centralizada.
// (Design System v1.2, secao 9.11; Especificacao Funcional, secao 6.10)

const COPIES = 6

export function PartnerLogoMarquee({ partners }: PartnerLogoMarqueeProps) {
  const reducedMotion = useReducedMotion()
  const { track } = useTracking()

  const logoSet = (copyIndex: number) =>
    partners.map((partner, i) => (
      <a
        // eslint-disable-next-line react/no-array-index-key
        key={`${copyIndex}-${i}`}
        href={partner.link}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={copyIndex === 0 ? `Acessar ${partner.nome}` : undefined}
        tabIndex={copyIndex === 0 ? undefined : -1}
        onClick={() =>
          track('partner_click', {
            partner_name: partner.nome,
            destination_url: partner.link,
          })
        }
        className="flex min-w-[220px] shrink-0 items-center justify-center px-8 opacity-80 transition-opacity hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-feedback-focus"
      >
        <img
          src={partner.logoUrl}
          alt={copyIndex === 0 ? partner.nome : ''}
          loading="lazy"
          className="h-auto max-h-14 w-auto max-w-[160px] object-contain"
        />
      </a>
    ))

  if (reducedMotion) {
    // Sem animacao: exibe somente uma copia estatica centralizada
    return (
      <div className="mt-10 flex flex-wrap items-center justify-center gap-8">
        {logoSet(0)}
      </div>
    )
  }

  return (
    // overflow-hidden recorta o conteudo fora da area visivel.
    // mask-image cria fade suave nas bordas laterais.
    // group permite pausar animacao no hover via group-hover.
    <div className="group relative mt-10 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_48px,black_calc(100%-48px),transparent)]">
      <div className="flex w-max animate-[marquee-loop_24s_linear_infinite] items-center group-hover:[animation-play-state:paused]">
        {/* Copia 0 — semanticamente acessivel (leitores de tela, teclado) */}
        <div className="flex shrink-0 items-center">
          {logoSet(0)}
        </div>
        {/* Copias 1-5 — puramente visuais, ocultas de leitores de tela */}
        {Array.from({ length: COPIES - 1 }, (_, ci) => (
          <div key={ci + 1} aria-hidden className="flex shrink-0 items-center">
            {logoSet(ci + 1)}
          </div>
        ))}
      </div>
    </div>
  )
}
