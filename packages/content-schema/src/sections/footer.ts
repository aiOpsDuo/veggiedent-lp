import type { SectionSchema } from '../contract'
import { requiredImage } from '../fields'

export const footerSchema = {
  key: 'footer',
  label: 'Rodapé',
  fields: [
    ...requiredImage({
      name: 'logo',
      label: 'Logo do rodapé',
      help: 'Logo exibido no início do rodapé da página.',
      altLabel: 'Texto alternativo do logo do rodapé',
      altHelp: 'Lido por leitores de tela no lugar da imagem do logo do rodapé.',
    }),
    {
      name: 'claimSource',
      type: 'texto-longo',
      label: 'Fonte da pesquisa',
      help: 'Texto da fonte do dado da pesquisa, em letra menor no rodapé.',
      required: true,
    },
    {
      name: 'speciesDisclaimer',
      type: 'texto-curto',
      label: 'Aviso de espécie',
      help: 'Aviso de que o produto é indicado apenas para cães.',
      required: true,
    },
    {
      name: 'legalData',
      type: 'texto-longo',
      label: 'Dados legais',
      help: 'CNPJ e demais dados legais da Virbac Brasil. Deixe vazio enquanto o dado oficial não chegar.',
      required: false,
    },
    {
      name: 'copyright',
      type: 'texto-curto',
      label: 'Direitos autorais',
      help: 'Última linha do rodapé.',
      required: true,
    },
  ],
  lists: [
    {
      name: 'links',
      label: 'Links do rodapé',
      reorderable: true,
      minItems: 1,
      itemFields: [
        {
          name: 'label',
          type: 'texto-curto',
          label: 'Texto do link',
          help: 'Texto visível do link no rodapé.',
          required: true,
        },
        {
          name: 'href',
          type: 'link',
          label: 'Destino do link',
          help: 'Endereço para onde o link do rodapé leva.',
          required: true,
        },
      ],
    },
  ],
} as const satisfies SectionSchema
