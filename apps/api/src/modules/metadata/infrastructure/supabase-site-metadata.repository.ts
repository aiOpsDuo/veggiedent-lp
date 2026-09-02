import { Inject, Injectable } from '@nestjs/common'
import type { SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_CLIENT } from '../../../shared/infrastructure/supabase-client'
import {
  unwrap,
  unwrapRequired,
} from '../../../shared/infrastructure/supabase-operation.error'
import type {
  SiteMetadataRepository,
  StoredSiteMetadata,
} from '../domain/site-metadata-repository.port'
import type { ValidatedSiteMetadata } from '../domain/validated-site-metadata'

const TABLE = 'site_metadata'

/** `site_metadata` é um registro único de `id` fixo (SDD § "Modelo de dados"). */
const SINGLE_ROW_ID = 'default'

/**
 * A imagem de compartilhamento vem embutida na mesma consulta, pela chave
 * estrangeira `og_image_media_id`. `GET /api/seo` precisa da URL pública, e
 * pedi-la em uma segunda consulta seria o mesmo N+1 do risco R-05 em escala
 * menor.
 */
const COLUMNS =
  'title,description,canonical_url,og_image_media_id,og_image_alt,updated_at,og_image:media_assets(public_url)'

interface MetadataRow {
  title: string | null
  description: string | null
  canonical_url: string | null
  og_image_media_id: string | null
  og_image_alt: string | null
  updated_at: string
  og_image: { public_url: string | null } | null
}

function optional(value: string | null): string | undefined {
  return value === null ? undefined : value
}

/**
 * Documento do esquema ⇄ colunas da tabela.
 *
 * `ogImageAlt` tem coluna própria desde a migração
 * `20260902130000_add_og_image_alt_to_site_metadata.sql`: o esquema exige o
 * texto alternativo sempre que há imagem (SDD § "Contrato do esquema de seção"),
 * e um campo validado que não volta ao operador é pior do que campo nenhum.
 */
function toDocument(row: MetadataRow): Record<string, unknown> {
  const document: Record<string, unknown> = {}
  const title = optional(row.title)
  const description = optional(row.description)
  const canonicalUrl = optional(row.canonical_url)
  const ogImage = optional(row.og_image_media_id)
  const ogImageAlt = optional(row.og_image_alt)

  if (title !== undefined) document.title = title
  if (description !== undefined) document.description = description
  if (canonicalUrl !== undefined) document.canonicalUrl = canonicalUrl
  if (ogImage !== undefined) document.ogImage = ogImage
  if (ogImageAlt !== undefined) document.ogImageAlt = ogImageAlt

  return document
}

function toStored(row: MetadataRow): StoredSiteMetadata {
  return {
    document: toDocument(row),
    ogImageUrl: row.og_image?.public_url ?? null,
    updatedAt: row.updated_at,
  }
}

function textOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

/** Repositório dos metadados da página sobre o Supabase. */
@Injectable()
export class SupabaseSiteMetadataRepository implements SiteMetadataRepository {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  async find(): Promise<StoredSiteMetadata | null> {
    const row = unwrap<MetadataRow>(
      'ler metadados',
      await this.supabase
        .from(TABLE)
        .select(COLUMNS)
        .eq('id', SINGLE_ROW_ID)
        .maybeSingle<MetadataRow>(),
    )
    return row === null ? null : toStored(row)
  }

  async save(
    document: ValidatedSiteMetadata,
    operatorId: string,
  ): Promise<StoredSiteMetadata> {
    const row = unwrapRequired<MetadataRow>(
      'gravar metadados',
      await this.supabase
        .from(TABLE)
        .upsert(
          {
            id: SINGLE_ROW_ID,
            title: textOrNull(document.title),
            description: textOrNull(document.description),
            canonical_url: textOrNull(document.canonicalUrl),
            og_image_media_id: textOrNull(document.ogImage),
            og_image_alt: textOrNull(document.ogImageAlt),
            updated_at: new Date().toISOString(),
            updated_by: operatorId,
          },
          { onConflict: 'id' },
        )
        .select(COLUMNS)
        .single<MetadataRow>(),
    )
    return toStored(row)
  }
}
