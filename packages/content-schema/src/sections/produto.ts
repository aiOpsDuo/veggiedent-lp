import type { SectionSchema } from '../contract'
import { requiredImage } from '../fields'

export const produtoSchema = {
  key: 'produto',
  label: 'Produto',
  fields: [
    {
      name: 'heading',
      type: 'texto-curto',
      label: 'Título da seção',
      help: 'Título no topo da seção do produto.',
      required: true,
    },
    {
      name: 'ctaLabel',
      type: 'texto-curto',
      label: 'Texto do botão',
      help: 'Botão ao final da seção, que leva a onde comprar.',
      required: true,
    },
    ...requiredImage({
      name: 'packshot',
      label: 'Foto do produto',
      help: 'Imagem do produto exibida ao lado do texto da seção.',
      altLabel: 'Texto alternativo da foto do produto',
      altHelp: 'Descrição lida por leitores de tela no lugar da foto do produto.',
    }),
  ],
  lists: [
    {
      name: 'body',
      label: 'Parágrafos do produto',
      reorderable: true,
      minItems: 1,
      itemFields: [
        {
          name: 'texto',
          type: 'texto-longo',
          label: 'Parágrafo',
          help: 'Um parágrafo do texto descritivo do produto.',
          required: true,
        },
      ],
    },
    {
      name: 'benefits',
      label: 'Benefícios do produto',
      reorderable: true,
      minItems: 1,
      itemFields: [
        {
          name: 'texto',
          type: 'texto-curto',
          label: 'Benefício',
          help: 'Item da lista de benefícios exibida ao lado da foto do produto.',
          required: true,
        },
      ],
    },
  ],
} as const satisfies SectionSchema
