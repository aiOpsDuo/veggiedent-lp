import type { SectionSchema } from '../contract'
import { requiredImage } from '../fields'

export const headerSchema = {
  key: 'header',
  label: 'Cabeçalho',
  fields: [
    ...requiredImage({
      name: 'logo',
      label: 'Logo do cabeçalho',
      help: 'Aparece no canto esquerdo da barra fixa no topo da página.',
      altLabel: 'Texto alternativo do logo',
      altHelp: 'Lido por leitores de tela no lugar da imagem do logo do cabeçalho.',
    }),
    {
      name: 'ctaDesktopLabel',
      type: 'texto-curto',
      label: 'Texto do botão (computador)',
      help: 'Botão à direita da barra do topo, na versão para computador.',
      required: true,
    },
    {
      name: 'ctaMobileLabel',
      type: 'texto-curto',
      label: 'Texto do botão (celular)',
      help: 'Botão que aparece dentro do menu do topo, na versão para celular.',
      required: true,
    },
    {
      name: 'menuButtonAriaLabel',
      type: 'texto-curto',
      label: 'Descrição do botão de menu',
      help: 'Não aparece na tela. É o que o leitor de tela anuncia no botão que abre o menu no celular.',
      required: true,
    },
    {
      name: 'mainNavAriaLabel',
      type: 'texto-curto',
      label: 'Descrição do menu principal',
      help: 'Não aparece na tela. É como o leitor de tela identifica a área de navegação do topo.',
      required: true,
    },
  ],
  lists: [
    {
      name: 'navLinks',
      label: 'Links de navegação',
      reorderable: true,
      minItems: 1,
      itemFields: [
        {
          name: 'label',
          type: 'texto-curto',
          label: 'Texto do link',
          help: 'Texto visível do item no menu do topo.',
          required: true,
        },
        {
          name: 'href',
          type: 'link',
          label: 'Destino do link',
          help: 'Trecho da página para onde o item leva (ex.: #educacao).',
          required: true,
        },
      ],
    },
  ],
} as const satisfies SectionSchema
