// Fonte: Copy Deck v2.0, secao 6. Ordem confirmada: PRD v1.2, secao 9.4.
//
// Os videos sao servidos como assets publicos estaticos (public/videos/),
// nao importados como modulo ES — arquivos de ~130MB nao devem passar pelo
// pipeline de bundling do Vite. Ver public/videos/README.md.
import type { DemonstracaoContent } from './Demonstracao.types'

export const demonstracaoContent: DemonstracaoContent = {
  heading: 'Como oferecer Veggiedent ao seu cachorro',
  banner: {
    overline: 'NA PRÁTICA',
    headline: 'Do pacote à primeira mordida',
    body: 'Veja como é simples incluir o Veggiedent no momento do petisco — o mesmo vídeo oficial usado pela Virbac para mostrar a rotina de oferecer.',
    ctaLabel: 'Quero receber o guia gratuito',
  },
  intro:
    'Os vídeos abaixo mostram o momento de oferecer o petisco, do desembalar à primeira mordida. Vale assistir antes da estreia do seu cachorro com o Veggiedent.',
  videos: [
    {
      id: 'tutor-abrindo-petisco',
      src: '/videos/TutorabrindoPetiscoEcachorroComendo.mp4',
      captionsSrc: '/videos/captions/tutor-abrindo-petisco.pt-BR.vtt',
      posterSrc: '/videos/thumbnails/tutor-abrindo-petisco.jpg',
      label: 'Do pacote ao petisco',
    },
    {
      id: 'cachorro-ganhando-petisco',
      src: '/videos/cachorroGanhadoPetisco.mp4',
      captionsSrc: '/videos/captions/cachorro-ganhando-petisco.pt-BR.vtt',
      posterSrc: '/videos/thumbnails/cachorro-ganhando-petisco.jpg',
      label: 'O momento de oferecer',
    },
  ],
}
