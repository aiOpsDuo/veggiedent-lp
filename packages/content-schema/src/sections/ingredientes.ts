import type { SectionSchema } from '../contract'

/**
 * Seção sem conteúdo aprovado: o material técnico da Virbac ainda não chegou.
 * Ela nasce despublicada (o que hoje o código chama de `isContentReady: false`)
 * e ganha campos novos quando o conteúdo real for definido — pelo procedimento
 * descrito no README, seção "Manutenção".
 */
export const ingredientesSchema = {
  key: 'ingredientes',
  label: 'Ingredientes',
  fields: [
    {
      name: 'heading',
      type: 'texto-curto',
      label: 'Título da seção',
      help: 'Título no topo da seção de ingredientes.',
      required: true,
    },
  ],
  lists: [],
} as const satisfies SectionSchema
