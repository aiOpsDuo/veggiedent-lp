import type { ValidatedSiteMetadata } from './validated-site-metadata'

/** Token de injeção da porta. O domínio declara; a infraestrutura implementa. */
export const SITE_METADATA_REPOSITORY = Symbol('SiteMetadataRepository')

export interface StoredSiteMetadata {
  /** Os metadados na forma do esquema, como o painel os edita. */
  readonly document: Readonly<Record<string, unknown>>
  /**
   * Endereço público da imagem de compartilhamento, já resolvido a partir do
   * identificador de mídia. O injetor de SEO precisa da URL, não do id, e
   * resolver aqui é o que mantém `GET /api/seo` em uma consulta só.
   */
  readonly ogImageUrl: string | null
  readonly updatedAt: string | null
}

/**
 * Porta de persistência dos metadados da página (SDD § "Modelo de dados").
 * Registro único: não há `findAll` nem identificador a escolher.
 */
export interface SiteMetadataRepository {
  find(): Promise<StoredSiteMetadata | null>
  save(
    document: ValidatedSiteMetadata,
    operatorId: string,
  ): Promise<StoredSiteMetadata>
}
