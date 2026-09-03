import type { SectionKey } from '@veggiedent/content-schema'

/**
 * A porta pela qual o painel alcança as seções (SDD § "Endpoints
 * administrativos"). As telas dependem desta interface, nunca da classe que
 * fala HTTP — é o que permite exercitar o formulário inteiro sem rede.
 */

/** Uma seção na listagem: estado de publicação e data da última edição. */
export interface SectionSummary {
  readonly key: SectionKey
  readonly label: string
  readonly isPublished: boolean
  /** `null` enquanto a seção nunca foi salva. */
  readonly updatedAt: string | null
}

/** O documento completo de uma seção, publicado ou não. */
export interface SectionDetail extends SectionSummary {
  readonly data: Readonly<Record<string, unknown>>
}

/** Erros por campo devolvidos pela API, no formato `{ "hero.headline": "…" }`. */
export type FieldErrors = Readonly<Record<string, string>>

export type LoadResult<T> =
  | { readonly status: 'ok'; readonly value: T }
  | { readonly status: 'falha'; readonly message: string }

/**
 * O resultado de gravar. `invalido` é separado de `falha` porque as duas coisas
 * têm destinos diferentes na tela: a recusa por validação pertence aos campos
 * que a causaram, e só uma falha sem campo vira mensagem geral.
 */
export type SaveResult =
  | { readonly status: 'salvo'; readonly section: SectionDetail }
  | { readonly status: 'invalido'; readonly fields: FieldErrors }
  | { readonly status: 'falha'; readonly message: string }

export type VisibilityResult =
  | { readonly status: 'alterada'; readonly section: SectionSummary }
  | { readonly status: 'falha'; readonly message: string }

export interface SectionsGateway {
  listSections(accessToken: string): Promise<LoadResult<readonly SectionSummary[]>>
  getSection(accessToken: string, key: SectionKey): Promise<LoadResult<SectionDetail>>
  saveSection(
    accessToken: string,
    key: SectionKey,
    document: Readonly<Record<string, unknown>>,
  ): Promise<SaveResult>
  setSectionVisibility(
    accessToken: string,
    key: SectionKey,
    isPublished: boolean,
  ): Promise<VisibilityResult>
}
