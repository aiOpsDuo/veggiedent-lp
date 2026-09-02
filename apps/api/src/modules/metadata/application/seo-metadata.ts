/**
 * Resposta de `GET /api/seo`, no formato que o injetor de borda consome
 * (SDD § "Contrato do injetor de SEO").
 *
 * Todo campo é anulável: com o banco recém-migrado ainda não há metadados, e o
 * injetor já tem reserva no HTML estático (SDD § D-06). Responder `null` deixa
 * a reserva agir; responder erro derrubaria a entrega do documento.
 */
export interface SeoMetadata {
  readonly title: string | null
  readonly description: string | null
  readonly ogImageUrl: string | null
  readonly canonicalUrl: string | null
}

export interface SiteMetadataView {
  readonly metadata: Readonly<Record<string, unknown>>
  readonly updatedAt: string | null
}
