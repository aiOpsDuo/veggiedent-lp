import { useRef } from 'react'
import { demonstracaoContent } from './Demonstracao.content'
import { VideoPlayer } from './components/VideoPlayer'
import { VideoHeroBanner } from './components/VideoHeroBanner'
import { SectionShell } from '../../components/ui/SectionShell'
import { SectionHeading } from '../../components/ui/SectionHeading'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { gsap, useGSAP } from '../../lib/gsap'

export function Demonstracao() {
  const containerRef = useRef<HTMLDivElement>(null)
  const reducedMotion = useReducedMotion()

  useGSAP(() => {
    if (reducedMotion) return

    gsap.from('.demo-header-el', {
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

    gsap.from('.demo-content-el', {
      opacity: 0,
      y: 25,
      duration: 0.6,
      stagger: 0.15,
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
      <SectionShell id="demonstracao" aria-labelledby="demonstracao-heading">
        <div className="demo-header-el">
          <SectionHeading id="demonstracao-heading" className="text-center mx-auto">{demonstracaoContent.heading}</SectionHeading>
        </div>
        <p className="demo-header-el mt-4 mx-auto max-w-[70ch] text-center text-lg text-ink-700">{demonstracaoContent.intro}</p>

        <div className="demo-content-el mt-8">
          <VideoHeroBanner
            overline={demonstracaoContent.banner.overline}
            headline={demonstracaoContent.banner.headline}
            body={demonstracaoContent.banner.body}
            ctaLabel={demonstracaoContent.banner.ctaLabel}
          />
        </div>

        <div className="demo-content-el mt-8 flex flex-col items-center gap-6 lg:flex-row lg:items-start lg:justify-center">
          {demonstracaoContent.videos.map((video) => (
            <VideoPlayer key={video.id} video={video} />
          ))}
        </div>
      </SectionShell>
    </div>
  )
}
