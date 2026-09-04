/**
 * Construtores de campo usados na declaracao dos esquemas de secao.
 *
 * Existem para uma unica invariante do SDD: todo campo de imagem declara,
 * conscientemente, se e **informativa** — e entao tem um campo de texto
 * alternativo adjacente e obrigatorio — ou **decorativa** — e entao nao tem
 * campo de descricao nenhum, porque entra com texto alternativo vazio e
 * escondida de leitores de tela. Declarar a imagem por meio destes construtores
 * torna impossivel esquecer a escolha: a invariante deixa de depender de
 * disciplina de quem edita o esquema.
 */
import type { FieldSpec } from './contract'

interface ImageFieldInput<N extends string> {
  readonly name: N
  readonly label: string
  readonly help: string
}

interface InformativeImageInput<N extends string> extends ImageFieldInput<N> {
  readonly altLabel: string
  readonly altHelp: string
}

type ImageFieldPair<N extends string, R extends boolean> = readonly [
  {
    readonly name: N
    readonly type: 'imagem'
    readonly label: string
    readonly help: string
    readonly required: R
    readonly imageRole: 'informativa'
  },
  {
    readonly name: `${N}${'Alt'}`
    readonly type: 'texto-curto'
    readonly label: string
    readonly help: string
    readonly required: R
  },
]

type DecorativeImageField<N extends string, R extends boolean> = readonly [
  {
    readonly name: N
    readonly type: 'imagem'
    readonly label: string
    readonly help: string
    readonly required: R
    readonly imageRole: 'decorativa'
  },
]

function imagePair<const N extends string, const R extends boolean>(
  input: InformativeImageInput<N>,
  required: R,
): ImageFieldPair<N, R> {
  return [
    {
      name: input.name,
      type: 'imagem',
      label: input.label,
      help: input.help,
      required,
      imageRole: 'informativa',
    },
    {
      name: `${input.name}Alt`,
      type: 'texto-curto',
      label: input.altLabel,
      help: input.altHelp,
      required,
    },
  ] as const
}

/** Imagem obrigatoria e o texto alternativo obrigatorio que a acompanha. */
export function requiredImage<const N extends string>(
  input: InformativeImageInput<N>,
): ImageFieldPair<N, true> {
  return imagePair(input, true)
}

/**
 * Imagem opcional e seu texto alternativo. O texto alternativo so e exigido
 * quando a imagem esta preenchida — regra aplicada na validacao do documento.
 */
export function optionalImage<const N extends string>(
  input: InformativeImageInput<N>,
): ImageFieldPair<N, false> {
  return imagePair(input, false)
}

/**
 * Imagem que nao carrega informacao: o leitor de tela a ignora, e por isso ela
 * nasce **sem** campo de texto alternativo — nao ha o que o operador descrever.
 * Esconde-la do leitor de tela e responsabilidade de quem a renderiza, e e o
 * tratamento correto de acessibilidade, nao uma excecao a ela.
 *
 * E obrigatoria por padrao: uma imagem decorativa ausente deixa um buraco no
 * layout, que e a unica razao de ela existir. A excecao e quando outro campo do
 * mesmo esquema preenche esse mesmo lugar — e o caso do fundo do banner, que e
 * um video ou uma imagem, a escolha do operador; ai a imagem e opcional, e quem
 * cuida do buraco e a alternativa, nao a obrigatoriedade.
 */
function decorativeImageField<const N extends string, const R extends boolean>(
  input: ImageFieldInput<N>,
  required: R,
): DecorativeImageField<N, R> {
  return [
    {
      name: input.name,
      type: 'imagem',
      label: input.label,
      help: input.help,
      required,
      imageRole: 'decorativa',
    },
  ] as const
}

export function decorativeImage<const N extends string>(
  input: ImageFieldInput<N>,
): DecorativeImageField<N, true> {
  return decorativeImageField(input, true)
}

/** Imagem decorativa que o operador pode nao enviar, por haver alternativa. */
export function optionalDecorativeImage<const N extends string>(
  input: ImageFieldInput<N>,
): DecorativeImageField<N, false> {
  return decorativeImageField(input, false)
}

/** Ajuda a manter a declaracao dos esquemas legivel sem perder os tipos literais. */
export type DeclaredFields = readonly FieldSpec[]
