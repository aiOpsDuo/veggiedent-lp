import type {
  SiteMetadataRepository,
  StoredSiteMetadata,
} from '../src/modules/metadata/domain/site-metadata-repository.port'
import type { ValidatedSiteMetadata } from '../src/modules/metadata/domain/validated-site-metadata'
import type { FakeSupabaseDatabase, Row } from './fake-supabase'

/**
 * `SiteMetadataRepository` de teste — substitui `SupabaseSiteMetadataRepository`
 * nos testes, mesmo padrão de `FakeMediaRepository`/`FakeSectionRepository`:
 * fala com a tabela genérica `site_metadata` de `FakeSupabaseDatabase`, sem
 * fingir ser o `PrismaClient` inteiro.
 *
 * A URL pública da imagem de compartilhamento é resolvida **sem** uma segunda
 * chamada registrada em `database.calls` — lendo `media_assets` direto pelo
 * id, como `FakeSupabaseDatabase.project()` já faz para a relação embutida
 * `RELATIONS['site_metadata.og_image']`. É o que mantém `GET /api/seo` em uma
 * única consulta (`conteudo-publico.e2e-spec.ts`) e `GET /api/content` em três
 * no total, uma por tabela (`midia-no-conteudo.e2e-spec.ts`).
 */

const TABLE = 'site_metadata'
const MEDIA_TABLE = 'media_assets'
const SINGLE_ROW_ID = 'default'

function textOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function textOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

/**
 * `ogImageAlt` tem coluna própria (`og_image_alt`), assim como no adaptador
 * MySQL — o esquema exige o texto alternativo sempre que há imagem.
 */
function toDocument(row: Row): Record<string, unknown> {
  const document: Record<string, unknown> = {}
  const title = textOrUndefined(row.title)
  const description = textOrUndefined(row.description)
  const ogImage = textOrUndefined(row.og_image_media_id)
  const ogImageAlt = textOrUndefined(row.og_image_alt)

  if (title !== undefined) document.title = title
  if (description !== undefined) document.description = description
  if (ogImage !== undefined) document.ogImage = ogImage
  if (ogImageAlt !== undefined) document.ogImageAlt = ogImageAlt

  return document
}

export class FakeSiteMetadataRepository implements SiteMetadataRepository {
  constructor(private readonly database: FakeSupabaseDatabase) {}

  async find(): Promise<StoredSiteMetadata | null> {
    this.database.record({ table: TABLE, operation: 'select' })
    this.failIfConfigured()
    const row = this.database.rows(TABLE).find((candidate) => candidate.id === SINGLE_ROW_ID)
    return row === undefined ? null : this.toStored(row)
  }

  async save(document: ValidatedSiteMetadata, operatorId: string): Promise<StoredSiteMetadata> {
    this.database.record({ table: TABLE, operation: 'upsert' })
    this.failIfConfigured()
    const row = this.database.upsert(TABLE, {
      id: SINGLE_ROW_ID,
      title: textOrNull(document.title),
      description: textOrNull(document.description),
      og_image_media_id: textOrNull(document.ogImage),
      og_image_alt: textOrNull(document.ogImageAlt),
      updated_at: new Date().toISOString(),
      updated_by: operatorId,
    })
    return this.toStored(row)
  }

  private toStored(row: Row): StoredSiteMetadata {
    return {
      document: toDocument(row),
      ogImageUrl: this.resolveOgImageUrl(row),
      updatedAt: (row.updated_at as string | null | undefined) ?? null,
    }
  }

  /** Lê `media_assets` pelo id sem passar por `database.record` — nenhuma consulta extra. */
  private resolveOgImageUrl(row: Row): string | null {
    const mediaId = row.og_image_media_id
    if (typeof mediaId !== 'string' || mediaId.length === 0) {
      return null
    }
    const media = this.database.rows(MEDIA_TABLE).find((candidate) => candidate.id === mediaId)
    return (media?.public_url as string | undefined) ?? null
  }

  private failIfConfigured(): void {
    const failure = this.database.failureFor(TABLE)
    if (failure) {
      throw new Error(`Falha simulada em "${TABLE}": ${failure.message}`)
    }
  }
}
