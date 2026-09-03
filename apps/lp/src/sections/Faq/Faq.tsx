import { useRef } from 'react'
import { Accordion } from './components/Accordion'
import { SectionShell } from '../../components/ui/SectionShell'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { gsap, useGSAP } from '../../lib/gsap'
import { connectSection } from '../../content/connect-section'
import type { SectionContent } from '../../content/published-content'

// A pergunta sem resposta aprovada nao e mais filtrada aqui: ela vive
// despublicada no CMS, e a API ja omite item despublicado (SDD, C-08).
export const Faq = connectSection('faq', FaqAccordion)

function FaqAccordion({ content }: { content: SectionContent<'faq'> }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const reducedMotion = useReducedMotion()

  useGSAP(() => {
    if (reducedMotion) return

    gsap.from('.faq-title-el', {
      opacity: 0,
      y: 20,
      duration: 0.6,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: containerRef.current,
        start: 'top 85%',
        once: true,
      }
    })
  }, { scope: containerRef })

  return (
    <div ref={containerRef}>
      <SectionShell id="faq" aria-labelledby="faq-heading">
        <h2 id="faq-heading" className="faq-title-el mx-auto max-w-[700px] text-center text-2xl font-semibold text-ink-900 sm:text-[28px]">
          {content.heading}
        </h2>

        <div className="mx-auto mt-8 max-w-[700px]">
          <Accordion items={content.items} />
        </div>
      </SectionShell>
    </div>
  )
}
