/**
 * Resposta de `GET /api/seo`, no formato que o injetor de borda consome
 * (SDD § "Contrato do injetor de SEO").
 *
 * Todo campo é anulável: com o banco recém-migrado ainda não há metadados, e o
 * injetor já tem reserva no HTML estático (SDD § D-06). Responder `null` deixa
 * a reserva agir; responder erro derrubaria a entrega do documento.
 *
 * `canonicalUrl` saiu do contrato na T25, junto com o campo no painel: o
 * endereço oficial é SEO técnico e voltou a ser o `<link rel="canonical">`
 * estático de `apps/lp/index.html`. O injetor não tem o que injetar ali.
 */
export interface SeoMetadata {
  readonly title: string | null
  readonly description: string | null
  readonly ogImageUrl: string | null
}

export interface SiteMetadataView {
  readonly metadata: Readonly<Record<string, unknown>>
  readonly updatedAt: string | null
}
