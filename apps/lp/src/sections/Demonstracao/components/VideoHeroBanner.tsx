import { useEffect, useRef } from 'react'
import { Button } from '../../../components/ui/Button'
import { useTracking } from '../../../hooks/useTracking'
import { useReducedMotion } from '../../../hooks/useReducedMotion'
import { videoTrackingId } from '../video-tracking-id'
import type { SectionContent } from '../../../content/published-content'

type VideoItem = SectionContent<'demonstracao'>['videos'][number]

interface VideoHeroBannerProps {
  overline: string
  headline: string
  body: string
  ctaLabel: string
  /** O primeiro vídeo da seção. Ausente quando nenhum vídeo está publicado. */
  video: VideoItem | undefined
}

// Banner/VideoBackground — o primeiro video da secao usado como plano de fundo
// full-bleed (autoplay, muted, loop, playsInline, object-cover), com overlay
// escuro para legibilidade e conteudo textual sobreposto.
//
// O poster deixou de ser uma arte propria e passou a ser a **miniatura desse
// mesmo video**, ja cadastrada no CMS (decisao do usuario de 2026-09-03, ver
// CHANGELOG): o banner mostra o video, entao a imagem de espera dele e a
// miniatura dele. Um ativo a menos no repositorio, nenhum campo novo.
//
// Respeita prefers-reduced-motion: quem pede menos movimento ve a miniatura
// como imagem estatica, sem autoplay.
export function VideoHeroBanner({ overline, headline, body, ctaLabel, video }: VideoHeroBannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const { track } = useTracking()
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    const el = videoRef.current
    if (!el || reducedMotion) return

    el.play().catch(() => {
      // Autoplay bloqueado pelo navegador — a miniatura permanece visivel.
    })
  }, [reducedMotion])

  return (
    <div className="relative isolate -mx-4 overflow-hidden rounded-lg sm:-mx-8 md:mx-0">
      <div className="relative flex min-h-[420px] items-end sm:min-h-[480px] md:min-h-[560px]">
        {video !== undefined &&
          (reducedMotion ? (
            <img
              src={video.poster}
              alt={video.posterAlt}
              className="absolute inset-0 -z-10 h-full w-full object-cover"
            />
          ) : (
            <video
              ref={videoRef}
              className="absolute inset-0 -z-10 h-full w-full object-cover"
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              poster={video.poster}
              aria-hidden="true"
              onPlay={() => track('video_start', { video_id: `${videoTrackingId(video)}-banner` })}
            >
              <source src={video.video} type="video/mp4" />
            </video>
          ))}

        {/* Overlay em gradiente — garante contraste AA do texto sobre o video oficial */}
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-gradient-to-t from-black/85 via-black/40 to-black/10"
        />

        <div className="max-w-[60ch] p-6 sm:p-10 md:p-12">
          <p className="text-sm font-semibold uppercase tracking-wide text-white/90">{overline}</p>
          <h3 className="mt-2 text-2xl font-bold leading-tight text-white sm:text-3xl md:text-4xl">
            {headline}
          </h3>
          <p className="mt-3 text-base text-white/90 sm:text-lg">{body}</p>

          <div className="mt-6">
            <Button
              href="#formulario"
              variant="primary"
              onClick={() => track('cta_click', { cta_label: ctaLabel, cta_location: 'demonstracao_video_banner' })}
            >
              {ctaLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
