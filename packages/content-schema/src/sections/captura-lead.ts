import type { SectionSchema } from '../contract'
import { decorativeImage } from '../fields'

/**
 * Cada campo do formulário do guia tem dois textos editáveis: o rótulo acima do
 * campo e o texto de exemplo exibido dentro dele. O par é declarado por este
 * construtor para que os dois nunca saiam de sincronia — e para que o rótulo em
 * português seja escrito uma vez só, a partir do nome do campo no formulário.
 */
function formFieldTexts<const N extends string>(input: {
  readonly name: N
  readonly fieldLabel: string
}): readonly [
  {
    readonly name: `${N}Label`
    readonly type: 'texto-curto'
    readonly label: string
    readonly help: string
    readonly required: true
  },
  {
    readonly name: `${N}Placeholder`
    readonly type: 'texto-curto'
    readonly label: string
    readonly help: string
    readonly required: true
  },
] {
  return [
    {
      name: `${input.name}Label`,
      type: 'texto-curto',
      label: `Rótulo do campo "${input.fieldLabel}"`,
      help: `Texto exibido acima do campo ${input.fieldLabel} no formulário do guia.`,
      required: true,
    },
    {
      name: `${input.name}Placeholder`,
      type: 'texto-curto',
      label: `Exemplo do campo "${input.fieldLabel}"`,
      help: `Texto cinza exibido dentro do campo ${input.fieldLabel} enquanto ele está vazio.`,
      required: true,
    },
  ] as const
}

const optionItemFields = [
  {
    name: 'value',
    type: 'texto-curto',
    label: 'Código da opção',
    help: 'Valor gravado no lead. Não aparece para o visitante e não deve ser alterado sem aviso à equipe técnica.',
    required: true,
  },
  {
    name: 'label',
    type: 'texto-curto',
    label: 'Texto da opção',
    help: 'Texto que o visitante lê na lista de opções.',
    required: true,
  },
] as const

/**
 * O mosaico ao lado do formulário foi desenhado para **seis** fotos: é essa
 * quantidade que preenche a grade em todos os tamanhos de tela. A lista não trava
 * o número — travá-la tornaria este campo mais rígido que qualquer outra lista do
 * CMS, sem ganho real —, então a quantidade é orientação ao operador, escrita no
 * próprio campo para chegar a ele no painel.
 *
 * As fotos são **decorativas**: elas preenchem o espaço ao lado do formulário e
 * não acrescentam nada ao que o texto já diz. É o que a página faz hoje, e
 * continua sendo o tratamento correto — o bloco inteiro é escondido do leitor
 * de tela, que anuncia o formulário sem seis descrições de fotos no meio.
 */
const MOSAIC_PHOTO_HELP =
  'Uma das fotos do mosaico exibido ao lado do formulário. O layout foi desenhado para 6 fotos: com mais ou menos que isso, a grade fica desequilibrada.'

export const capturaLeadSchema = {
  key: 'captura_lead',
  label: 'Captura de lead',
  fields: [
    {
      name: 'heading',
      type: 'texto-curto',
      label: 'Título da seção',
      help: 'Título ao lado do formulário do guia.',
      required: true,
    },
    {
      name: 'body',
      type: 'texto-longo',
      label: 'Texto da seção',
      help: 'Parágrafo abaixo do título, ao lado do formulário.',
      required: true,
    },
    {
      name: 'ebookTitle',
      type: 'texto-curto',
      label: 'Título do guia',
      help: 'Nome do material oferecido. Deixe vazio enquanto o título oficial não for aprovado.',
      required: false,
    },
    ...formFieldTexts({ name: 'formNome', fieldLabel: 'Nome' }),
    ...formFieldTexts({ name: 'formEmail', fieldLabel: 'E-mail' }),
    ...formFieldTexts({ name: 'formTelefone', fieldLabel: 'WhatsApp' }),
    ...formFieldTexts({ name: 'formNomeCachorro', fieldLabel: 'Nome do cão' }),
    ...formFieldTexts({ name: 'formPorteCachorro', fieldLabel: 'Porte do cão' }),
    ...formFieldTexts({ name: 'formCidadeEstado', fieldLabel: 'Cidade e estado' }),
    ...formFieldTexts({ name: 'formConheceVirbac', fieldLabel: 'Conhece a Virbac' }),
    ...formFieldTexts({ name: 'formUsaProdutoVirbac', fieldLabel: 'Usa produto Virbac' }),
    ...formFieldTexts({ name: 'formQualProdutoVirbac', fieldLabel: 'Qual produto Virbac' }),
    {
      name: 'lgpdLabel',
      type: 'texto-longo',
      label: 'Texto do aceite da Política de Privacidade',
      help: 'Frase ao lado da caixa de seleção obrigatória, antes do botão de envio.',
      required: true,
    },
    {
      name: 'optInLabel',
      type: 'texto-longo',
      label: 'Texto do aceite de comunicações',
      help: 'Frase ao lado da caixa de seleção opcional de novidades da Virbac.',
      required: true,
    },
    {
      name: 'submitLabel',
      type: 'texto-curto',
      label: 'Texto do botão de envio',
      help: 'Botão que envia o formulário do guia.',
      required: true,
    },
    {
      name: 'submitLoadingLabel',
      type: 'texto-curto',
      label: 'Texto do botão durante o envio',
      help: 'Substitui o texto do botão enquanto o envio está em andamento.',
      required: true,
    },
    {
      name: 'errorNome',
      type: 'texto-curto',
      label: 'Erro do campo Nome',
      help: 'Mensagem exibida abaixo do campo Nome quando ele fica vazio.',
      required: true,
    },
    {
      name: 'errorEmail',
      type: 'texto-curto',
      label: 'Erro do campo E-mail',
      help: 'Mensagem exibida abaixo do campo E-mail quando o endereço é inválido.',
      required: true,
    },
    {
      name: 'errorAceiteLgpd',
      type: 'texto-curto',
      label: 'Erro do aceite da Política de Privacidade',
      help: 'Mensagem exibida quando o visitante tenta enviar sem aceitar a política.',
      required: true,
    },
    {
      name: 'successModalTitle',
      type: 'texto-curto',
      label: 'Título da janela de sucesso',
      help: 'Título da janela que abre depois do envio bem-sucedido.',
      required: true,
    },
    {
      name: 'successModalBody',
      type: 'texto-longo',
      label: 'Texto da janela de sucesso',
      help: 'Parágrafo dentro da janela de confirmação do envio.',
      required: true,
    },
    {
      name: 'successModalDownloadCtaLabel',
      type: 'texto-curto',
      label: 'Texto do botão de download',
      help: 'Botão da janela de sucesso que abre o guia.',
      required: true,
    },
    {
      name: 'successModalEmailModeMessage',
      type: 'texto-longo',
      label: 'Aviso de envio por e-mail',
      help: 'Mensagem da janela de sucesso quando o guia é entregue por e-mail em vez de download.',
      required: true,
    },
    {
      name: 'successModalCloseAriaLabel',
      type: 'texto-curto',
      label: 'Descrição do botão de fechar',
      help: 'Não aparece na tela. É o que o leitor de tela anuncia no botão que fecha a janela de sucesso.',
      required: true,
    },
    {
      name: 'errorToastMessage',
      type: 'texto-longo',
      label: 'Mensagem de falha no envio',
      help: 'Aviso exibido quando o envio do formulário não é concluído.',
      required: true,
    },
  ],
  lists: [
    {
      name: 'porteOptions',
      label: 'Opções de porte do cão',
      reorderable: true,
      minItems: 1,
      itemFields: optionItemFields,
    },
    {
      name: 'simNaoOptions',
      label: 'Opções de sim ou não',
      reorderable: true,
      minItems: 1,
      itemFields: optionItemFields,
    },
    {
      name: 'mosaico',
      label: 'Fotos do mosaico',
      reorderable: true,
      minItems: 1,
      itemFields: [
        ...decorativeImage({
          name: 'image',
          label: 'Foto do mosaico',
          help: MOSAIC_PHOTO_HELP,
        }),
      ],
    },
  ],
} as const satisfies SectionSchema
