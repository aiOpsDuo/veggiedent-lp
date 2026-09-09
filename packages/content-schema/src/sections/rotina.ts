import type { SectionSchema } from '../contract'
import { requiredImage } from '../fields'

export const rotinaSchema = {
  key: 'rotina',
  label: 'Rotina de cuidado',
  fields: [
    {
      name: 'heading',
      type: 'texto-curto',
      label: 'Título da seção',
      help: 'Título no topo da seção de rotina de cuidado.',
      required: true,
    },
    {
      name: 'intro',
      type: 'texto-longo',
      label: 'Texto de introdução',
      help: 'Parágrafo abaixo do título, antes da lista de passos.',
      required: true,
    },
  ],
  lists: [
    {
      name: 'steps',
      label: 'Passos da rotina',
      reorderable: true,
      minItems: 1,
      itemFields: [
        {
          name: 'title',
          type: 'texto-curto',
          label: 'Título do passo',
          help: 'Título do passo na lista da rotina.',
          required: true,
        },
        {
          name: 'body',
          type: 'texto-longo',
          label: 'Texto do passo',
          help: 'Explicação do passo, abaixo do título.',
          required: true,
        },
        ...requiredImage({
          name: 'image',
          label: 'Imagem do passo',
          help: 'Imagem que ilustra o passo da rotina.',
          altLabel: 'Texto alternativo da imagem do passo',
          altHelp: 'Descrição lida por leitores de tela no lugar da imagem do passo.',
        }),
        {
          name: 'ctaLabel',
          type: 'texto-curto',
          label: 'Texto do CTA (opcional)',
          help: 'Texto do botão exibido abaixo do passo. Deixe em branco para não exibir nenhum botão.',
          required: false,
        },
        {
          name: 'ctaHref',
          type: 'link',
          label: 'Link do CTA (opcional)',
          help: 'Endereço para onde o botão leva. Só aparece na página quando o texto do CTA também estiver preenchido.',
          required: false,
        },
      ],
    },
  ],
} as const satisfies SectionSchema
