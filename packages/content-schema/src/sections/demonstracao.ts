import type { SectionSchema } from '../contract'
import { requiredImage } from '../fields'

export const demonstracaoSchema = {
  key: 'demonstracao',
  label: 'Demonstração em vídeo',
  fields: [
    {
      name: 'heading',
      type: 'texto-curto',
      label: 'Título da seção',
      help: 'Título no topo da seção de vídeos.',
      required: true,
    },
    {
      name: 'intro',
      type: 'texto-longo',
      label: 'Texto de introdução',
      help: 'Parágrafo abaixo do título, antes dos vídeos.',
      required: true,
    },
    {
      name: 'bannerOverline',
      type: 'texto-curto',
      label: 'Chapéu do banner',
      help: 'Linha curta em destaque no banner que antecede os vídeos.',
      required: true,
    },
    {
      name: 'bannerHeadline',
      type: 'texto-curto',
      label: 'Título do banner',
      help: 'Título do banner que antecede os vídeos.',
      required: true,
    },
    {
      name: 'bannerBody',
      type: 'texto-longo',
      label: 'Texto do banner',
      help: 'Parágrafo do banner que antecede os vídeos.',
      required: true,
    },
    {
      name: 'bannerCtaLabel',
      type: 'texto-curto',
      label: 'Texto do botão do banner',
      help: 'Botão do banner, que leva ao formulário do guia.',
      required: true,
    },
  ],
  lists: [
    {
      name: 'videos',
      label: 'Vídeos',
      reorderable: true,
      minItems: 1,
      itemFields: [
        {
          name: 'label',
          type: 'texto-curto',
          label: 'Título do vídeo',
          help: 'Texto exibido abaixo do vídeo, identificando a cena.',
          required: true,
        },
        {
          name: 'video',
          type: 'video',
          label: 'Arquivo de vídeo',
          help: 'Vídeo reproduzido nesta posição da seção.',
          required: true,
        },
        ...requiredImage({
          name: 'poster',
          label: 'Miniatura do vídeo',
          help: 'Imagem exibida antes de o vídeo começar a tocar.',
          altLabel: 'Texto alternativo da miniatura',
          altHelp: 'Descrição lida por leitores de tela no lugar da miniatura do vídeo.',
        }),
        {
          name: 'captions',
          type: 'legenda',
          label: 'Arquivo de legendas',
          help: 'Legendas em português exibidas durante a reprodução do vídeo.',
          required: false,
        },
      ],
    },
  ],
} as const satisfies SectionSchema
