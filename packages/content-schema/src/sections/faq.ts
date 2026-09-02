import type { SectionSchema } from '../contract'

export const faqSchema = {
  key: 'faq',
  label: 'Perguntas frequentes',
  fields: [
    {
      name: 'heading',
      type: 'texto-curto',
      label: 'Título da seção',
      help: 'Título no topo da seção de perguntas frequentes.',
      required: true,
    },
  ],
  lists: [
    {
      name: 'items',
      label: 'Perguntas',
      reorderable: true,
      minItems: 1,
      itemFields: [
        {
          name: 'question',
          type: 'texto-curto',
          label: 'Pergunta',
          help: 'Texto da pergunta, sempre visível na lista.',
          required: true,
        },
        {
          name: 'answer',
          type: 'texto-longo',
          label: 'Resposta',
          help: 'Texto exibido quando a pergunta é aberta.',
          required: true,
        },
      ],
    },
  ],
} as const satisfies SectionSchema
