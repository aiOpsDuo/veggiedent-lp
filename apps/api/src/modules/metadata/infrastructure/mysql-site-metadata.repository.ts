import { Inject, Injectable } from '@nestjs/common'
import { Prisma, type PrismaClient } from '../../../generated/prisma/client'
import { PRISMA_CLIENT } from '../../../shared/infrastructure/prisma-client'
import type {
  SiteMetadataRepository,
  StoredSiteMetadata,
} from '../domain/site-metadata-repository.port'
import type { ValidatedSiteMetadata } from '../domain/validated-site-metadata'

/** `site_metadata` é um registro único de `id` fixo (SDD § "Modelo de dados"). */
const SINGLE_ROW_ID = 'default'

/**
 * A imagem de compartilhamento vem embutida na mesma consulta, pela chave
 * estrangeira `ogImageMediaId`. `GET /api/seo` precisa da URL pública, e
 * pedi-la em uma segunda consulta seria o mesmo N+1 do risco R-05 em escala
 * menor — mesmo motivo do `select` do adaptador Supabase que este repositório
 * substitui.
 */
const SELECT_WITH_OG_IMAGE = {
  title: true,
  description: true,
  ogImageMediaId: true,
  ogImageAlt: true,
  updatedAt: true,
  ogImage: { select: { publicUrl: true } },
} satisfies Prisma.SiteMetadataSelect

type SiteMetadataRow = Prisma.SiteMetadataGetPayload<{ select: typeof SELECT_WITH_OG_IMAGE }>

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
 *
 * `canonicalUrl` não está aqui desde a T25: o endereço oficial saiu do CMS e
 * voltou a ser o `<link rel="canonical">` estático de `apps/lp/index.html`. A
 * coluna foi removida pela migração
 * `20260905120000_remove_canonical_url_and_option_codes.sql`, e o
 * `schema.prisma` (model `SiteMetadata`) já nasceu sem ela.
 */
function toDocument(row: SiteMetadataRow): Record<string, unknown> {
  const document: Record<string, unknown> = {}
  const title = optional(row.title)
  const description = optional(row.description)
  const ogImage = optional(row.ogImageMediaId)
  const ogImageAlt = optional(row.ogImageAlt)

  if (title !== undefined) document.title = title
  if (description !== undefined) document.description = description
  if (ogImage !== undefined) document.ogImage = ogImage
  if (ogImageAlt !== undefined) document.ogImageAlt = ogImageAlt

  return document
}

function toStored(row: SiteMetadataRow): StoredSiteMetadata {
  return {
    document: toDocument(row),
    ogImageUrl: row.ogImage?.publicUrl ?? null,
    updatedAt: row.updatedAt.toISOString(),
  }
}

function textOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

/** Repositório dos metadados da página sobre o MySQL, via Prisma (SDD § D-10). */
@Injectable()
export class MySqlSiteMetadataRepository implements SiteMetadataRepository {
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  async find(): Promise<StoredSiteMetadata | null> {
    const row = await this.prisma.siteMetadata.findUnique({
      where: { id: SINGLE_ROW_ID },
      select: SELECT_WITH_OG_IMAGE,
    })
    return row === null ? null : toStored(row)
  }

  async save(
    document: ValidatedSiteMetadata,
    operatorId: string,
  ): Promise<StoredSiteMetadata> {
    const fields = {
      title: textOrNull(document.title),
      description: textOrNull(document.description),
      ogImageMediaId: textOrNull(document.ogImage),
      ogImageAlt: textOrNull(document.ogImageAlt),
      updatedAt: new Date(),
      updatedById: operatorId,
    }
    const row = await this.prisma.siteMetadata.upsert({
      where: { id: SINGLE_ROW_ID },
      create: { id: SINGLE_ROW_ID, ...fields },
      update: fields,
      select: SELECT_WITH_OG_IMAGE,
    })
    return toStored(row)
  }
}
