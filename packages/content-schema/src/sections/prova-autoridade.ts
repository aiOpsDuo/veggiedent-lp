import type { SectionSchema } from '../contract'
import { requiredImage } from '../fields'

export const provaAutoridadeSchema = {
  key: 'prova_autoridade',
  label: 'Prova de autoridade',
  fields: [
    {
      name: 'heading',
      type: 'texto-curto',
      label: 'Título da seção',
      help: 'Título no topo da seção com os números da pesquisa.',
      required: true,
    },
    {
      name: 'source',
      type: 'texto-longo',
      label: 'Fonte da pesquisa',
      help: 'Texto da fonte, em letra menor, abaixo dos números.',
      required: true,
    },
    ...requiredImage({
      name: 'kit',
      label: 'Kit de imagens',
      help: 'Arte com a embalagem, o selo N.º 1 e a recomendação veterinária, abaixo dos números.',
      altLabel: 'Texto alternativo do kit de imagens',
      altHelp: 'Descrição lida por leitores de tela no lugar da arte com a embalagem e o selo.',
    }),
  ],
  lists: [
    {
      name: 'stats',
      label: 'Números da pesquisa',
      reorderable: true,
      minItems: 1,
      itemFields: [
        {
          name: 'stat',
          type: 'texto-curto',
          label: 'Número',
          help: 'O número em destaque (ex.: 1.116).',
          required: true,
        },
        {
          name: 'label',
          type: 'texto-curto',
          label: 'Descrição do número',
          help: 'Texto explicativo exibido abaixo do número.',
          required: true,
        },
      ],
    },
  ],
} as const satisfies SectionSchema
