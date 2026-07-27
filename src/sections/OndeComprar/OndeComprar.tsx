import { useRef } from 'react'
import { ondeComprarContent } from './OndeComprar.content'
import { PartnerCard } from './components/PartnerCard'
import { PartnerPlaceholderMarquee } from './components/PartnerPlaceholderMarquee'
import { SectionShell } from '../../components/ui/SectionShell'
import { SectionHeading } from '../../components/ui/SectionHeading'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { gsap, useGSAP } from '../../lib/gsap'

export function OndeComprar() {
  const containerRef = useRef<HTMLDivElement>(null)
  const reducedMotion = useReducedMotion()

  useGSAP(() => {
    if (reducedMotion) return

    gsap.from('.comprar-header-el', {
      opacity: 0,
      y: 20,
      duration: 0.6,
      stagger: 0.1,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: containerRef.current,
        start: 'top 85%',
        once: true,
      }
    })

    gsap.from('.partner-card-el', {
      opacity: 0,
      y: 20,
      duration: 0.5,
      stagger: 0.08,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: containerRef.current,
        start: 'top 78%',
        once: true,
      }
    })
  }, { scope: containerRef })

  return (
    <div ref={containerRef} className="bg-brand-primary">
      <SectionShell id="onde-comprar" aria-labelledby="onde-comprar-heading">
        <div className="comprar-header-el">
          <SectionHeading id="onde-comprar-heading" className="text-ink-900">
            {ondeComprarContent.heading}
          </SectionHeading>
        </div>
        <p className="comprar-header-el mt-4 max-w-[60ch] text-lg text-ink-900/90">
          {ondeComprarContent.intro}
        </p>

        {ondeComprarContent.partners.length > 0 ? (
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ondeComprarContent.partners.map((partner) => (
              <div key={partner.nome} className="partner-card-el">
                <PartnerCard partner={partner} />
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* [BLOQUEADO] lista de parceiros pendente — nenhum card fictício de marca
                é renderizado. A faixa abaixo é so um preenchimento visual generico
                (categorias, sem logo/nome de parceiro) ate a lista real chegar. */}
            <p className="mt-8 text-sm text-ink-900/75">Lista de parceiros em breve.</p>
            <PartnerPlaceholderMarquee />
          </>
        )}
      </SectionShell>
    </div>
  )
}
