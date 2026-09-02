/**
 * Construtores de campo usados na declaracao dos esquemas de secao.
 *
 * Existem para uma unica invariante do SDD: todo campo de imagem tem um campo
 * de texto alternativo adjacente e obrigatorio. Declarar o par por meio destes
 * construtores torna o esquerdo impossivel de existir sem o direito — a
 * invariante deixa de depender de disciplina de quem edita o esquema.
 */
import type { FieldSpec } from './contract'

interface ImageFieldInput<N extends string> {
  readonly name: N
  readonly label: string
  readonly help: string
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
  },
  {
    readonly name: `${N}${'Alt'}`
    readonly type: 'texto-curto'
    readonly label: string
    readonly help: string
    readonly required: R
  },
]

function imagePair<const N extends string, const R extends boolean>(
  input: ImageFieldInput<N>,
  required: R,
): ImageFieldPair<N, R> {
  return [
    { name: input.name, type: 'imagem', label: input.label, help: input.help, required },
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
export function requiredImage<const N extends string>(input: ImageFieldInput<N>): ImageFieldPair<N, true> {
  return imagePair(input, true)
}

/**
 * Imagem opcional e seu texto alternativo. O texto alternativo so e exigido
 * quando a imagem esta preenchida — regra aplicada na validacao do documento.
 */
export function optionalImage<const N extends string>(input: ImageFieldInput<N>): ImageFieldPair<N, false> {
  return imagePair(input, false)
}

/** Ajuda a manter a declaracao dos esquemas legivel sem perder os tipos literais. */
export type DeclaredFields = readonly FieldSpec[]
