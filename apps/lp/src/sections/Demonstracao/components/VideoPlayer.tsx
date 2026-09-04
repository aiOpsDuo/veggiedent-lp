import { useRef, useState } from 'react'
import { Pause, Play, Volume2, VolumeX } from 'lucide-react'
import { useVideoTracking } from '../hooks/useVideoTracking'
import { comPrimeiroQuadro } from '../first-frame'
import { videoTrackingId } from '../video-tracking-id'
import type { SectionContent } from '../../../content/published-content'

interface VideoPlayerProps {
  video: SectionContent<'demonstracao'>['videos'][number]
}

// Video/Player — Design System v1.2, secao 9.8. Estados: idle/loading/playing/ended.
// Autoplay desabilitado. O arquivo e as legendas vem do CMS; as legendas sao
// opcionais no esquema, entao a faixa de legenda so e declarada quando existe
// arquivo cadastrado (Especificacao Funcional, 6.6).
//
// Nao existe miniatura cadastrada, e por isso nao ha atributo `poster`: a
// imagem exibida antes do play e o primeiro quadro do proprio arquivo (ver
// `first-frame.ts`). O fundo escuro do bloco cobre o instante entre a montagem
// e a decodificacao desse quadro.
export function VideoPlayer({ video }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'playing' | 'ended'>('idle')
  const [isMuted, setIsMuted] = useState(true)
  const { handlePlay, handleTimeUpdate, reset } = useVideoTracking(videoTrackingId(video.video))

  function togglePlay() {
    const el = videoRef.current
    if (!el) return

    if (el.paused) {
      setStatus('loading')
      el.play()
    } else {
      el.pause()
    }
  }

  function toggleMute() {
    const el = videoRef.current
    if (!el) return
    el.muted = !el.muted
    setIsMuted(el.muted)
  }

  return (
    <div className="relative w-full max-w-[800px] overflow-hidden rounded-lg bg-ink-900">
      <video
        ref={videoRef}
        className="aspect-video w-full"
        src={comPrimeiroQuadro(video.video)}
        preload="metadata"
        playsInline
        muted={isMuted}
        onPlay={() => {
          setStatus('playing')
          handlePlay()
        }}
        onPause={() => setStatus('idle')}
        onEnded={() => {
          setStatus('ended')
          reset()
        }}
        onTimeUpdate={handleTimeUpdate}
        onCanPlay={() => setStatus((current) => (current === 'loading' ? 'playing' : current))}
      >
        {video.captions !== undefined && (
          <track kind="captions" srcLang="pt-BR" label="Português" src={video.captions} />
        )}
      </video>

      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-gradient-to-t from-black/70 to-transparent p-4">
        <button
          type="button"
          onClick={togglePlay}
          aria-label={status === 'playing' ? 'Pausar' : 'Reproduzir'}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-ink-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-feedback-focus"
        >
          {status === 'playing' ? <Pause size={20} /> : <Play size={20} />}
        </button>

        <p className="flex-1 truncate text-sm font-medium text-white">{video.label}</p>

        <button
          type="button"
          onClick={toggleMute}
          aria-label={isMuted ? 'Ativar som' : 'Desativar som'}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-ink-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-feedback-focus"
        >
          {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>
      </div>
    </div>
  )
}
