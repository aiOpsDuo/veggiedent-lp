import { useRef } from 'react'
import { rotinaCuidadoContent } from './RotinaCuidado.content'
import { RoutineStep } from './components/RoutineStep'
import { SectionShell } from '../../components/ui/SectionShell'
import { SectionHeading } from '../../components/ui/SectionHeading'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { gsap, useGSAP } from '../../lib/gsap'

export function RotinaCuidado() {
  const containerRef = useRef<HTMLDivElement>(null)
  const reducedMotion = useReducedMotion()

  useGSAP(() => {
    if (reducedMotion) return

    gsap.from('.rotina-header-el', {
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

    gsap.from('.rotina-step-el', {
      opacity: 0,
      y: 20,
      duration: 0.5,
      stagger: 0.1,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: containerRef.current,
        start: 'top 78%',
        once: true,
      }
    })
  }, { scope: containerRef })

  return (
    <div ref={containerRef} style={{ background: 'linear-gradient(to bottom, #e8f7f6 0%, #27B6AD 28%, #27B6AD 100%)' }}>
      <SectionShell id="rotina" aria-labelledby="rotina-heading">
        <div className="rotina-header-el">
          <SectionHeading id="rotina-heading">{rotinaCuidadoContent.heading}</SectionHeading>
        </div>
        <p className="rotina-header-el mt-4 max-w-[70ch] text-lg text-ink-900/90">{rotinaCuidadoContent.intro}</p>

        <ol className="mt-8 grid grid-cols-1 auto-rows-fr items-stretch gap-4 lg:grid-cols-4">
          {rotinaCuidadoContent.steps.map((step, index) => (
            <div key={step.title} className="rotina-step-el">
              <RoutineStep data={step} index={index} />
            </div>
          ))}
        </ol>
      </SectionShell>
    </div>
  )
}
