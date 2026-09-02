import type { SectionSchema } from '../contract'
import { requiredImage } from '../fields'

export const heroSchema = {
  key: 'hero',
  label: 'Abertura',
  fields: [
    {
      name: 'overline',
      type: 'texto-curto',
      label: 'Chapéu',
      help: 'Linha curta em destaque, acima do título principal da abertura.',
      required: true,
    },
    {
      name: 'headline',
      type: 'texto-curto',
      label: 'Título principal',
      help: 'Maior texto da página, na primeira tela que o visitante vê.',
      required: true,
    },
    {
      name: 'subheadline',
      type: 'texto-longo',
      label: 'Texto de apoio',
      help: 'Parágrafo logo abaixo do título principal da abertura.',
      required: true,
    },
    {
      name: 'ctaPrimaryLabel',
      type: 'texto-curto',
      label: 'Texto do botão principal',
      help: 'Botão em destaque da abertura, que leva ao formulário do guia.',
      required: true,
    },
    {
      name: 'ctaSecondaryLabel',
      type: 'texto-curto',
      label: 'Texto do botão secundário',
      help: 'Botão discreto ao lado do principal, que leva à seção de rotina.',
      required: true,
    },
    ...requiredImage({
      name: 'image',
      label: 'Imagem da abertura',
      help: 'Imagem de fundo da primeira tela da página.',
      altLabel: 'Texto alternativo da imagem da abertura',
      altHelp: 'Descrição lida por leitores de tela no lugar da imagem da abertura.',
    }),
  ],
  lists: [],
} as const satisfies SectionSchema
