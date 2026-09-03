import type { FieldErrors } from '../content/sections-gateway'

/**
 * A porta pela qual o painel alcança `GET`/`PUT /api/admin/metadata`
 * (SDD § "Endpoints administrativos"). Como nas seções, a tela depende desta
 * interface e nunca da classe que fala HTTP.
 */

/** Os metadados guardados, na forma que o esquema declara. */
export interface SiteMetadataDetail {
  readonly metadata: Readonly<Record<string, unknown>>
  readonly updatedAt: string | null
}

export type MetadataLoadResult =
  | { readonly status: 'ok'; readonly value: SiteMetadataDetail }
  | { readonly status: 'falha'; readonly message: string }

/**
 * `invalido` é separado de `falha` pelo mesmo motivo das seções: a recusa por
 * validação pertence aos campos que a causaram, e só uma falha sem campo vira
 * mensagem geral.
 */
export type MetadataSaveResult =
  | { readonly status: 'salvo'; readonly value: SiteMetadataDetail }
  | { readonly status: 'invalido'; readonly fields: FieldErrors }
  | { readonly status: 'falha'; readonly message: string }

export interface MetadataGateway {
  getMetadata(accessToken: string): Promise<MetadataLoadResult>
  saveMetadata(
    accessToken: string,
    document: Readonly<Record<string, unknown>>,
  ): Promise<MetadataSaveResult>
}
