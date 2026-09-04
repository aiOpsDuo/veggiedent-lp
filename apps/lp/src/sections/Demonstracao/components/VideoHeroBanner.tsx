import { useEffect, useRef } from 'react'
import { Button } from '../../../components/ui/Button'
import { useTracking } from '../../../hooks/useTracking'
import { useReducedMotion } from '../../../hooks/useReducedMotion'
import { comPrimeiroQuadro } from '../first-frame'
import { videoTrackingId } from '../video-tracking-id'

interface VideoHeroBannerProps {
  overline: string
  headline: string
  body: string
  ctaLabel: string
  /** Vídeo de fundo, quando foi ele o enviado ao banner. */
  video: string | undefined
  /** Imagem de fundo, usada quando não há vídeo enviado. */
  image: string | undefined
}

const FUNDO_CLASS = 'absolute inset-0 -z-10 h-full w-full object-cover'

// Banner/VideoBackground — o fundo full-bleed do banner que antecede os videos,
// com overlay escuro para legibilidade e o conteudo textual sobreposto.
//
// O fundo e **video ou imagem**, a escolha de quem edita o conteudo: os dois
// campos existem no esquema, nenhum dos dois e obrigatorio, e o video tem
// precedencia quando os dois estao preenchidos. Nao ha campo de imagem de
// espera para o video — ela e o primeiro quadro do proprio arquivo (ver
// `first-frame.ts`).
//
// A cor de fundo do bloco nao e decoracao: enquanto o arquivo carrega, e sem
// nenhuma midia cadastrada, e ela que sustenta o contraste do texto branco.
export function VideoHeroBanner({ overline, headline, body, ctaLabel, video, image }: VideoHeroBannerProps) {
  const { track } = useTracking()

  return (
    <div className="relative isolate -mx-4 overflow-hidden rounded-lg bg-ink-900 sm:-mx-8 md:mx-0">
      <div className="relative flex min-h-[420px] items-end sm:min-h-[480px] md:min-h-[560px]">
        <BannerBackground video={video} image={image} />

        {/* Overlay em gradiente — garante contraste AA do texto sobre o fundo */}
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

/** O fundo do banner: o vídeo, se houver; a imagem, se não; nada, se nenhum. */
function BannerBackground({ video, image }: Pick<VideoHeroBannerProps, 'video' | 'image'>) {
  if (video !== undefined) {
    return <BannerVideo url={video} />
  }
  if (image !== undefined) {
    // Fundo decorativo: o que o banner comunica esta no titulo e no texto ao
    // lado, entao descreve-la injetaria ruido no leitor de tela.
    return <img src={image} alt="" aria-hidden="true" className={FUNDO_CLASS} />
  }
  return null
}

/**
 * O vídeo de fundo, que toca sozinho, sem som e em laço.
 *
 * Quem pede menos movimento recebe o mesmo elemento parado: o primeiro quadro
 * do arquivo, que é exatamente a imagem que o vídeo mostraria antes de tocar.
 */
function BannerVideo({ url }: { url: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const { track } = useTracking()
  const reducedMotion = useReducedMotion()

  // Quem toca e para o video e este efeito, nao o atributo `autoplay`: a
  // preferencia por menos movimento so e conhecida depois da primeira
  // renderizacao, e um atributo removido depois nao para um video que ja
  // comecou.
  useEffect(() => {
    const el = videoRef.current
    if (el === null) return

    if (reducedMotion) {
      el.pause()
      el.currentTime = 0
      return
    }

    el.play().catch(() => {
      // Autoplay bloqueado pelo navegador — o primeiro quadro fica na tela.
    })
  }, [reducedMotion])

  return (
    <video
      ref={videoRef}
      className={FUNDO_CLASS}
      src={comPrimeiroQuadro(url)}
      loop
      muted
      playsInline
      preload="metadata"
      aria-hidden="true"
      onPlay={() => track('video_start', { video_id: `${videoTrackingId(url)}-banner` })}
    />
  )
}
