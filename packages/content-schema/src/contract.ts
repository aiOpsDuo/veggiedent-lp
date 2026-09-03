/**
 * Contrato declarativo de esquema de secao (SDD, "Contrato do esquema de secao").
 *
 * Um esquema de secao e a fonte unica de tres coisas: a validacao aplicada pela
 * API, o formulario gerado pelo painel e os tipos consumidos pela LP. Por isso
 * cada campo carrega, alem do tipo, os metadados de apresentacao: rotulo em
 * portugues na linguagem de quem escreve conteudo e ajuda dizendo onde o campo
 * aparece na pagina.
 */

export const FIELD_TYPES = [
  'texto-curto',
  'texto-longo',
  'lista-de-textos',
  'imagem',
  'video',
  'legenda',
  'link',
  'booleano',
] as const

export type FieldType = (typeof FIELD_TYPES)[number]

/** Tipos cujo valor e o identificador de uma midia, nunca uma URL digitada a mao. */
export const MEDIA_FIELD_TYPES = ['imagem', 'video', 'legenda'] as const

export type MediaFieldType = (typeof MEDIA_FIELD_TYPES)[number]

/**
 * Papel de acessibilidade de um campo de imagem (SDD, "Contrato do esquema de
 * secao"). Toda imagem escolhe um dos dois, conscientemente:
 *
 * - `informativa` — carrega informacao, entao tem texto alternativo adjacente e
 *   obrigatorio, que o leitor de tela anuncia no lugar da imagem;
 * - `decorativa` — nao carrega informacao, entao entra com texto alternativo
 *   vazio e escondida de leitores de tela. Nao ha campo de descricao a
 *   preencher: descrever uma imagem decorativa injeta ruido sem significado.
 */
export const IMAGE_ROLES = ['informativa', 'decorativa'] as const

export type ImageRole = (typeof IMAGE_ROLES)[number]

export interface FieldSpec {
  readonly name: string
  /** Tipo do campo; define a validacao e o controle exibido no painel. */
  readonly type: FieldType
  /** Rotulo em portugues, na linguagem de quem escreve conteudo. */
  readonly label: string
  /** Onde este campo aparece na pagina. */
  readonly help?: string
  readonly required: boolean
  /**
   * Obrigatorio em campo `imagem`, sem sentido nos demais. A ausencia dele numa
   * imagem e violacao de invariante, nunca um valor padrao silencioso.
   */
  readonly imageRole?: ImageRole
}

export interface ListSpec {
  readonly name: string
  readonly label: string
  readonly itemFields: readonly FieldSpec[]
  readonly reorderable: true
  readonly minItems?: number
}

export interface SectionSchema {
  readonly key: SectionKey
  readonly label: string
  readonly fields: readonly FieldSpec[]
  readonly lists: readonly ListSpec[]
}

/**
 * As 12 secoes, na ordem em que aparecem na pagina (apps/lp/src/App.tsx).
 * O conjunto e fechado: o CMS edita secoes existentes, nunca cria tipos novos.
 */
export const SECTION_KEYS = [
  'header',
  'hero',
  'educacao',
  'rotina',
  'produto',
  'demonstracao',
  'ingredientes',
  'prova_autoridade',
  'captura_lead',
  'onde_comprar',
  'faq',
  'footer',
] as const

export type SectionKey = (typeof SECTION_KEYS)[number]

export function isSectionKey(candidate: unknown): candidate is SectionKey {
  return typeof candidate === 'string' && (SECTION_KEYS as readonly string[]).includes(candidate)
}

/** Sufixo do campo de texto alternativo que acompanha toda imagem informativa. */
export const ALT_TEXT_SUFFIX = 'Alt'

export function altTextFieldName(imageFieldName: string): string {
  return `${imageFieldName}${ALT_TEXT_SUFFIX}`
}

export function isMediaField(spec: FieldSpec): boolean {
  return (MEDIA_FIELD_TYPES as readonly string[]).includes(spec.type)
}

/** Imagem que o leitor de tela ignora: sem descricao a preencher, por decisao. */
export function isDecorativeImage(spec: FieldSpec): boolean {
  return spec.type === 'imagem' && spec.imageRole === 'decorativa'
}

/**
 * Campos que todo item de lista carrega, alem dos declarados no `itemFields`:
 * visibilidade (retira o item da LP sem apagar) e posicao de ordenacao.
 */
export interface ListItemBase {
  visivel: boolean
  ordem: number
}

export const LIST_ITEM_BASE_FIELDS = ['visivel', 'ordem'] as const satisfies readonly (keyof ListItemBase)[]
