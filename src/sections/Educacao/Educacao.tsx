import { useState, useRef } from 'react'
import { educacaoContent } from './Educacao.content'
import { SectionShell } from '../../components/ui/SectionShell'
import { SectionHeading } from '../../components/ui/SectionHeading'
import { Card } from '../../components/ui/Card'
import { ChevronDown } from 'lucide-react'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { gsap, useGSAP } from '../../lib/gsap'

export function Educacao() {
  const [activeIndex, setActiveIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const reducedMotion = useReducedMotion()

  useGSAP(() => {
    if (reducedMotion) return

    gsap.from('.edu-header-el', {
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

    gsap.from('.edu-content-el', {
      opacity: 0,
      y: 25,
      duration: 0.7,
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
      <SectionShell id="educacao" aria-labelledby="educacao-heading">
        <div className="edu-header-el">
          <SectionHeading id="educacao-heading">{educacaoContent.heading}</SectionHeading>
        </div>
        <p className="edu-header-el mt-4 max-w-[70ch] text-lg text-ink-700">{educacaoContent.intro}</p>

        {/* Desktop & Notebook Interactive Showcase (visible on lg screens, >= 1024px) */}
        <div className="edu-content-el hidden lg:grid grid-cols-12 gap-8 items-center mt-10">
        {/* Left column: Visual Showcase (spans 7 columns) */}
        <div className="col-span-7 relative aspect-[4/3] w-full overflow-hidden rounded-2xl shadow-md ring-1 ring-black/5 bg-surface-section-alt">
          {educacaoContent.cards.map((card, index) => (
            <img
              key={card.title}
              src={card.image.src}
              alt={card.image.alt}
              loading="lazy"
              className={`absolute inset-0 h-full w-full object-cover object-[center_22%] transition-opacity duration-500 ease-in-out ${
                activeIndex === index ? 'opacity-100 z-10' : 'opacity-0 z-0'
              }`}
            />
          ))}
        </div>

        {/* Right column: Interactive Tabs (spans 5 columns) */}
        <nav className="col-span-5 flex flex-col gap-3" aria-label="Abas de conteúdo educativo">
          {educacaoContent.cards.map((card, index) => (
            <button
              key={card.title}
              onClick={() => setActiveIndex(index)}
              className={`p-4 rounded-xl text-left border transition-all duration-300 ${
                activeIndex === index
                  ? 'bg-surface-card border-brand-primary/20 shadow-md ring-1 ring-black/5 scale-[1.01]'
                  : 'bg-transparent border-transparent hover:bg-black/5'
              }`}
              aria-expanded={activeIndex === index}
            >
              <h3 className="text-base font-semibold text-ink-900 leading-tight">{card.title}</h3>
              <p className="mt-1.5 text-sm text-ink-700 leading-relaxed">{card.body}</p>
            </button>
          ))}
        </nav>
      </div>

      {/* Mobile & Tablet Interactive Accordion (visible on screens < 1024px) */}
      <div className="edu-content-el lg:hidden mt-8 flex flex-col gap-3">
        {educacaoContent.cards.map((card, index) => {
          const isOpen = activeIndex === index
          return (
            <Card key={card.title} className="overflow-hidden !p-0 border border-black/5">
              <button
                onClick={() => setActiveIndex(isOpen ? -1 : index)}
                className="flex w-full items-center justify-between p-4 text-left transition-colors duration-300 hover:bg-black/[0.02]"
                aria-expanded={isOpen}
              >
                <span className="text-base font-semibold text-ink-900">{card.title}</span>
                <ChevronDown
                  className={`h-5 w-5 text-ink-700 transition-transform duration-300 ${
                    isOpen ? 'rotate-180 text-brand-primary' : ''
                  }`}
                />
              </button>
              <div
                className={`transition-all duration-300 ease-in-out overflow-hidden ${
                  isOpen ? 'max-h-[500px] opacity-100 border-t border-black/5' : 'max-h-0 opacity-0 pointer-events-none'
                }`}
              >
                <div className="p-4 flex flex-col gap-4">
                  <p className="text-sm text-ink-700 leading-relaxed">{card.body}</p>
                  <img
                    src={card.image.src}
                    alt={card.image.alt}
                    loading="lazy"
                    className="aspect-[4/3] w-full rounded-xl object-cover object-[center_22%] shadow-sm ring-1 ring-black/5"
                  />
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </SectionShell>
    </div>
  )
}
