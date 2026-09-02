import type { SectionKey } from '@veggiedent/content-schema'

/** Uma seção na listagem do painel: estado de publicação e última edição. */
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

/** Resposta de `GET /api/content`: tudo o que a LP precisa, de uma vez. */
export interface PublishedContent {
  readonly sections: Partial<Record<SectionKey, Record<string, unknown>>>
  readonly metadata: Readonly<Record<string, unknown>> | null
}
