import type { SectionSchema } from '../contract'
import { requiredImage } from '../fields'

export const educacaoSchema = {
  key: 'educacao',
  label: 'Saúde oral',
  fields: [
    {
      name: 'heading',
      type: 'texto-curto',
      label: 'Título da seção',
      help: 'Título no topo da seção sobre saúde oral.',
      required: true,
    },
    {
      name: 'intro',
      type: 'texto-longo',
      label: 'Texto de introdução',
      help: 'Parágrafo abaixo do título, antes dos cards.',
      required: true,
    },
    {
      name: 'researchHighlight',
      type: 'texto-longo',
      label: 'Destaque da pesquisa',
      help: 'Frase em destaque sobre a Pesquisa Ipsos, ao final da introdução.',
      required: true,
    },
  ],
  lists: [
    {
      name: 'cards',
      label: 'Cards de educação',
      reorderable: true,
      minItems: 1,
      itemFields: [
        {
          name: 'title',
          type: 'texto-curto',
          label: 'Título do card',
          help: 'Título exibido no topo do card.',
          required: true,
        },
        {
          name: 'body',
          type: 'texto-longo',
          label: 'Texto do card',
          help: 'Parágrafo exibido abaixo do título do card.',
          required: true,
        },
        ...requiredImage({
          name: 'image',
          label: 'Imagem do card',
          help: 'Imagem exibida no topo do card.',
          altLabel: 'Texto alternativo da imagem do card',
          altHelp: 'Descrição lida por leitores de tela no lugar da imagem do card.',
        }),
      ],
    },
  ],
} as const satisfies SectionSchema
