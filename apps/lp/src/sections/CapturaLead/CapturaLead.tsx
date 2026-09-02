import { useRef } from 'react'
import { capturaLeadContent } from './CapturaLead.content'
import { LeadCaptureForm } from './components/LeadCaptureForm'
import { LeadFormMosaic } from './components/LeadFormMosaic'
import { Card } from '../../components/ui/Card'
import { SectionShell } from '../../components/ui/SectionShell'
import { SectionHeading } from '../../components/ui/SectionHeading'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { gsap, useGSAP } from '../../lib/gsap'

export function CapturaLead() {
  const containerRef = useRef<HTMLDivElement>(null)
  const reducedMotion = useReducedMotion()

  useGSAP(() => {
    if (reducedMotion) return

    gsap.from('.lead-header-el', {
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

    gsap.from('.mosaic-tile-el', {
      opacity: 0,
      scale: 0.98,
      y: 15,
      duration: 0.5,
      stagger: 0.05,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: containerRef.current,
        start: 'top 75%',
        once: true,
      }
    })

    gsap.from('.floating-badge-el', {
      opacity: 0,
      scale: 0,
      duration: 0.4,
      ease: 'back.out(1.7)',
      scrollTrigger: {
        trigger: containerRef.current,
        start: 'top 70%',
        once: true,
      }
    })

    gsap.from('.form-card-el', {
      opacity: 0,
      x: 20,
      duration: 0.6,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: containerRef.current,
        start: 'top 75%',
        once: true,
      }
    })
  }, { scope: containerRef })

  return (
    <div ref={containerRef}>
      <SectionShell id="formulario" aria-labelledby="captura-lead-heading">
        <div className="grid gap-8 md:grid-cols-2 md:items-center">
          <div>
            <div className="lead-header-el">
              <SectionHeading id="captura-lead-heading">{capturaLeadContent.heading}</SectionHeading>
            </div>
            <p className="lead-header-el mt-4 max-w-[60ch] text-lg text-ink-700">{capturaLeadContent.body}</p>
            <LeadFormMosaic />
          </div>

          <div className="form-card-el">
            <Card className="shadow-lg ring-1 ring-black/5 md:shadow-xl">
              <LeadCaptureForm />
            </Card>
          </div>
        </div>
      </SectionShell>
    </div>
  )
}
