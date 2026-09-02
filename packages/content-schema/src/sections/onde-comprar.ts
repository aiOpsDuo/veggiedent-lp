import type { SectionSchema } from '../contract'
import { requiredImage } from '../fields'

export const ondeComprarSchema = {
  key: 'onde_comprar',
  label: 'Onde comprar',
  fields: [
    {
      name: 'heading',
      type: 'texto-curto',
      label: 'Título da seção',
      help: 'Título no topo da seção de parceiros.',
      required: true,
    },
    {
      name: 'intro',
      type: 'texto-longo',
      label: 'Texto de introdução',
      help: 'Parágrafo abaixo do título, antes da lista de parceiros.',
      required: true,
    },
  ],
  lists: [
    {
      name: 'partners',
      label: 'Parceiros',
      reorderable: true,
      minItems: 1,
      itemFields: [
        {
          name: 'nome',
          type: 'texto-curto',
          label: 'Nome do parceiro',
          help: 'Nome da loja parceira, exibido junto ao logo.',
          required: true,
        },
        ...requiredImage({
          name: 'logo',
          label: 'Logo do parceiro',
          help: 'Logo exibido no card do parceiro.',
          altLabel: 'Texto alternativo do logo do parceiro',
          altHelp: 'Descrição lida por leitores de tela no lugar do logo do parceiro.',
        }),
        {
          name: 'link',
          type: 'link',
          label: 'Link da loja',
          help: 'Endereço da página do produto na loja do parceiro.',
          required: true,
        },
      ],
    },
  ],
} as const satisfies SectionSchema
