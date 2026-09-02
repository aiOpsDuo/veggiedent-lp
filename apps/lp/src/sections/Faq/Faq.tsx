import { useRef } from 'react'
import { faqContent } from './Faq.content'
import { Accordion } from './components/Accordion'
import { SectionShell } from '../../components/ui/SectionShell'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { gsap, useGSAP } from '../../lib/gsap'

export function Faq() {
  const productionReadyItems = faqContent.items.filter((item) => item.isReadyForProduction)
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
          {faqContent.heading}
        </h2>

        <div className="mx-auto mt-8 max-w-[700px]">
          <Accordion items={productionReadyItems} />
        </div>
      </SectionShell>
    </div>
  )
}
