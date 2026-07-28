import { useRef } from 'react'
import { heroContent } from './Hero.content'
import { Button } from '../../components/ui/Button'
import { useTracking } from '../../hooks/useTracking'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { gsap, useGSAP } from '../../lib/gsap'
import heroBg from '../../assets/images/hero/virbac-kv-hero.jpg'

// Hero/Primary — Design System v1.2, secao 9.2.
// Imagem de fundo e o maior contribuinte de LCP: sem lazy loading, fetchpriority alto
// (Especificacao Funcional, secao 12.2).
// Asset oficial: 0705_Virbac_KV 01.png (KV veterinaria + cachorro, selo N.1 e logo
// Virbac ja embutidos na peca) — usado como background full-bleed da secao,
// conforme diretriz de marca: nao usar bloco de cor solido.
export function Hero() {
  const { track } = useTracking()
  const reducedMotion = useReducedMotion()
  const sectionRef = useRef<HTMLElement>(null)

  useGSAP(() => {
    if (reducedMotion) return

    const tl = gsap.timeline()
    
    // Background image fade and scale
    tl.from('.bg-image-el', {
      opacity: 0.6,
      scale: 0.96,
      x: 12,
      duration: 0.8,
      ease: 'power2.out'
    })

    // Content stagger animation
    tl.from(
      ['.overline-el', '.title-el', '.subtitle-el', '.cta-el'],
      {
        opacity: 0,
        y: 24,
        duration: 0.6,
        stagger: 0.08,
        ease: 'power3.out'
      },
      '-=0.6'
    )
  }, { scope: sectionRef })

  return (
    <section
      ref={sectionRef}
      id="hero"
      aria-labelledby="hero-heading"
      className="relative isolate flex min-h-[560px] items-end overflow-hidden sm:min-h-[640px] md:min-h-[720px]"
    >
      <img
        src={heroBg}
        alt={heroContent.imageAlt}
        fetchPriority="high"
        className="bg-image-el absolute inset-0 -z-10 h-full w-full object-cover object-[65%_center] 3xl:object-[65%_15%]"
      />
      {/* Overlay em gradiente — garante contraste AA do texto sobre a foto oficial */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-t from-black/65 via-black/20 to-transparent"
      />

      <div className="mx-auto w-full max-w-content px-4 pb-10 pt-24 sm:px-8 sm:pb-14 md:pb-20">
        <p className="overline-el text-sm font-semibold uppercase tracking-wide text-white/90">
          {heroContent.overline}
        </p>
        <h1
          id="hero-heading"
          className="title-el mt-3 max-w-[20ch] text-[32px] font-bold leading-[1.15] text-white sm:text-[48px] md:text-[56px]"
        >
          {heroContent.headline}
        </h1>
        <p className="subtitle-el mt-4 max-w-[60ch] text-lg text-white/90">{heroContent.subheadline}</p>

        <div className="cta-el mt-6 flex flex-wrap items-center gap-4">
          <Button
            href="#formulario"
            variant="primary"
            onClick={() => track('cta_click', { cta_label: heroContent.ctaPrimaryLabel, cta_location: 'hero_primary' })}
          >
            {heroContent.ctaPrimaryLabel}
          </Button>
          <Button
            href="#rotina"
            variant="link"
            onClick={() => track('cta_click', { cta_label: heroContent.ctaSecondaryLabel, cta_location: 'hero_secondary' })}
          >
            {heroContent.ctaSecondaryLabel}
          </Button>
        </div>
      </div>
    </section>
  )
}
