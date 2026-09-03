import type { SectionDocuments, SectionKey, SiteMetadata } from '@veggiedent/content-schema'

/**
 * O conteúdo publicado, exatamente como `GET /api/content` o entrega
 * (SDD § "Endpoints públicos").
 *
 * As seções vêm em `Partial` porque a resposta **omite** o que não está
 * publicado: uma seção despublicada não chega vazia, ela simplesmente não
 * chega (SDD § C-08). Quem lê uma seção precisa, portanto, tratar a ausência —
 * é o que `connectSection` faz por todas elas.
 */
export type PublishedSections = Partial<SectionDocuments>

export interface PublishedContent {
  readonly sections: PublishedSections
  /** `null` enquanto os metadados nunca foram salvos no painel. */
  readonly metadata: SiteMetadata | null
}

/** O documento de uma seção, do jeito que a seção correspondente o consome. */
export type SectionContent<K extends SectionKey> = NonNullable<PublishedSections[K]>
