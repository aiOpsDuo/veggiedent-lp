import { useRef } from 'react'
import { Card } from '../../../components/ui/Card'
import { claimsInfographicContent } from '../ProvaAutoridade.content'
import { Stethoscope, ShieldCheck } from 'lucide-react'
import { useReducedMotion } from '../../../hooks/useReducedMotion'
import { gsap, useGSAP } from '../../../lib/gsap'

// Claims/Infographic — exibe os números de autoridade em cards premium empilhados.
export function ClaimsInfographic() {
  const reducedMotion = useReducedMotion()
  const containerRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    if (reducedMotion) return

    gsap.from('.stat-card-el', {
      opacity: 0,
      y: 20,
      duration: 0.6,
      stagger: 0.12,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: containerRef.current,
        start: 'top 82%',
        once: true,
      },
    })
  }, { scope: containerRef })

  return (
    <div ref={containerRef} role="list" className="flex flex-col gap-4">
      {claimsInfographicContent.stats.map((item, index) => {
        const isFirst = index === 0
        const StatIcon = isFirst ? Stethoscope : ShieldCheck
        const statColorClass = isFirst ? 'text-brand-primary-hover' : 'text-claim-gold'
        const borderClass = isFirst 
          ? 'border-l-[6px] sm:border-l-8 border-brand-primary-hover border-y border-r border-black/5' 
          : 'border-l-[6px] sm:border-l-8 border-claim-gold border-y border-r border-black/5'
        const watermarkColorClass = isFirst ? 'text-brand-primary/5' : 'text-claim-gold/5'

        return (
          <div role="listitem" key={item.label} className="flex-1 stat-card-el">
          <Card className={`group relative overflow-hidden transition-all duration-300 ease-out ${borderClass} bg-surface-card !p-4 sm:!p-5 rounded-[12px] sm:rounded-[16px] shadow-sm ring-1 ring-black/5 flex flex-col justify-center min-h-[96px] sm:min-h-[110px] hover:-translate-y-1 hover:scale-[1.01] hover:shadow-lg hover:ring-brand-primary/20`}>
              {/* Background Watermark Icon */}
              <div className={`absolute right-3 bottom-2 ${watermarkColorClass} select-none pointer-events-none z-0 transition-all duration-300 ease-out group-hover:scale-110 group-hover:-rotate-3 group-hover:opacity-[1.5]`}>
                <StatIcon className="h-16 w-16 sm:h-20 sm:w-20" />
              </div>

              <div className="relative z-10">
                <p className={`text-4xl sm:text-5xl font-extrabold tracking-tight ${statColorClass}`}>
                  {item.stat}
                </p>
                <h3 className="mt-1 text-sm sm:text-base font-bold text-ink-900 leading-snug max-w-[20ch]">
                  {item.label}
                </h3>
              </div>
            </Card>
          </div>
        )
      })}
    </div>
  )
}
