import { useRef } from 'react'
import { produtoContent } from './Produto.content'
import { Button } from '../../components/ui/Button'
import { useTracking } from '../../hooks/useTracking'
import { SectionShell } from '../../components/ui/SectionShell'
import { SectionHeading } from '../../components/ui/SectionHeading'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { gsap, useGSAP } from '../../lib/gsap'
import produtoPackshot from '../../assets/images/produto/veggiedent-packshot.jpg'

export function Produto() {
  const { track } = useTracking()
  const containerRef = useRef<HTMLDivElement>(null)
  const reducedMotion = useReducedMotion()

  useGSAP(() => {
    if (reducedMotion) return

    gsap.from('.prod-img-el', {
      opacity: 0,
      x: -24,
      duration: 0.6,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: containerRef.current,
        start: 'top 82%',
        once: true,
      }
    })

    gsap.from('.prod-content-el', {
      opacity: 0,
      y: 20,
      duration: 0.6,
      stagger: 0.08,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: containerRef.current,
        start: 'top 82%',
        once: true,
      }
    })
  }, { scope: containerRef })

  return (
    <div ref={containerRef} style={{ background: 'linear-gradient(to bottom, #27B6AD 0%, #27B6AD 70%, #239e96 100%)' }}>
      <SectionShell id="produto" aria-labelledby="produto-heading">
        <div className="grid gap-8 md:grid-cols-2 md:items-center">
          <img
            src={produtoPackshot}
            alt={produtoContent.packshotAlt}
            loading="lazy"
            className="prod-img-el aspect-square w-full max-w-sm rounded-lg object-cover md:mx-auto"
          />

          <div>
            <div className="prod-content-el">
              <SectionHeading id="produto-heading">{produtoContent.heading}</SectionHeading>
            </div>

            {produtoContent.body.map((paragraph) => (
              <p key={paragraph} className="prod-content-el mt-4 max-w-[60ch] text-base text-ink-900/90">
                {paragraph}
              </p>
            ))}

            <ul className="prod-content-el mt-4 flex flex-col gap-2">
              {produtoContent.benefits.map((benefit) => (
                <li key={benefit} className="flex items-start gap-2 text-base text-ink-900/90">
                  <span aria-hidden="true" className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-ink-900/60" />
                  {benefit}
                </li>
              ))}
            </ul>

            <div className="prod-content-el mt-6">
              <Button
                href="#onde-comprar"
                variant="primary"
                className="bg-ink-900 text-surface-canvas hover:bg-ink-700 border-0"
                onClick={() => track('cta_click', { cta_label: produtoContent.ctaLabel, cta_location: 'produto' })}
              >
                {produtoContent.ctaLabel}
              </Button>
            </div>
          </div>
        </div>
      </SectionShell>
    </div>
  )
}
