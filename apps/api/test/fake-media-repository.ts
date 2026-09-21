import type { MediaAsset } from '../src/modules/media/domain/media-asset'
import { MEDIA_KINDS, type MediaKind } from '../src/modules/media/domain/media-kind'
import type {
  MediaRepository,
  NewMediaAsset,
} from '../src/modules/media/domain/media-repository.port'
import type { MediaUrlRepository } from '../src/modules/media/domain/media-url-repository.port'
import type { MediaUrlMap } from '../src/shared/domain/media-references'
import type { FakeSupabaseDatabase, Row } from './fake-supabase'

/**
 * `MediaRepository`/`MediaUrlRepository` de teste — a dupla que substitui
 * `supabase-media.repository.ts`/`supabase-media-url.repository.ts` nos
 * testes, do mesmo jeito que `MinioMediaStorage` substitui
 * `supabase-media-storage.ts` em produção (SDD § D-10).
 *
 * Em vez de fingir ser o `PrismaClient` (uma superfície grande, gerada, que um
 * dublê teria que replicar por inteiro só para o `media_assets` funcionar),
 * este par fala diretamente com a tabela genérica `media_assets` de
 * `FakeSupabaseDatabase` — a mesma usada pelo dublê Supabase original. É por
 * isso que `admin-midia.e2e-spec.ts`, `midia-no-conteudo.e2e-spec.ts`,
 * `conteudo-publico.e2e-spec.ts` e `carga-do-instantaneo.e2e-spec.ts` não
 * precisam mudar nenhum `harness.database.seed('media_assets', ...)` nem
 * `harness.database.rows('media_assets')`: só a infraestrutura por trás da
 * porta trocou, exatamente como a documentação de `MediaModule` promete.
 *
 * **Limite conhecido, registrado para quem reconciliar as tarefas paralelas.**
 * `MySqlMediaRepository`/`MySqlMediaUrlRepository` (produção) têm sua própria
 * cobertura unitária contra um `PrismaClient` de mentira
 * (`mysql-media.repository.spec.ts`/`mysql-media-url.repository.spec.ts`) —
 * são os arquivos que provam a tradução `bigint`/`Decimal` e a consulta única
 * do Prisma. Este par aqui prova o **caso de uso e o controller** de ponta a
 * ponta; não prova o adaptador Prisma real. Quando `modulo-conteudo`,
 * `modulo-metadados` e `modulo-leads` também migrarem para Prisma, listar essa
 * mesma limitação vai se repetir — a reconciliação natural, nessa hora, é
 * unificar tudo num único `PrismaClient` de teste (real ou dublê) que sirva a
 * todos os módulos, substituindo os pares "Fake<Modulo>Repository" que cada
 * tarefa paralela escreveu contra `FakeSupabaseDatabase` por conta própria.
 */

const TABLE = 'media_assets'

function isMediaKind(candidate: string): candidate is MediaKind {
  return (MEDIA_KINDS as readonly string[]).includes(candidate)
}

function toMediaAsset(row: Row): MediaAsset | null {
  const kind = row.kind as string
  if (!isMediaKind(kind)) {
    return null
  }
  return {
    id: row.id as string,
    kind,
    storagePath: row.storage_path as string,
    publicUrl: row.public_url as string,
    mimeType: row.mime_type as string,
    sizeBytes: Number(row.size_bytes),
    originalFilename: row.original_filename as string,
    width: (row.width as number | null | undefined) ?? null,
    height: (row.height as number | null | undefined) ?? null,
    durationSeconds: (row.duration_seconds as number | null | undefined) ?? null,
    createdAt: row.created_at as string,
  }
}

export class FakeMediaRepository implements MediaRepository {
  constructor(private readonly database: FakeSupabaseDatabase) {}

  /**
   * Sempre um registro novo — `database.insert` já recusa chave duplicada,
   * mesma semântica de `insert` (nunca `upsert`) do adaptador real.
   */
  async insert(asset: NewMediaAsset, operatorId: string): Promise<MediaAsset> {
    this.database.record({ table: TABLE, operation: 'insert' })
    const row = this.database.insert(TABLE, {
      id: asset.id,
      kind: asset.kind,
      storage_path: asset.storagePath,
      public_url: asset.publicUrl,
      mime_type: asset.mimeType,
      size_bytes: asset.sizeBytes,
      original_filename: asset.originalFilename,
      width: asset.width,
      height: asset.height,
      duration_seconds: asset.durationSeconds,
      created_at: new Date().toISOString(),
      created_by: operatorId,
    })
    return toMediaAsset(row) as MediaAsset
  }

  async findById(id: string): Promise<MediaAsset | null> {
    return this.findOneBy('id', id)
  }

  async findByStoragePath(storagePath: string): Promise<MediaAsset | null> {
    return this.findOneBy('storage_path', storagePath)
  }

  async delete(id: string): Promise<void> {
    this.database.record({ table: TABLE, operation: 'delete' })
    const matching = this.database.rows(TABLE).filter((row) => row.id === id)
    this.database.delete(TABLE, matching)
  }

  private async findOneBy(column: string, value: string): Promise<MediaAsset | null> {
    this.database.record({ table: TABLE, operation: 'select' })
    const row = this.database.rows(TABLE).find((candidate) => candidate[column] === value)
    return row === undefined ? null : toMediaAsset(row)
  }
}

/** Risco R-05: uma única "consulta" (um único `record`), qualquer que seja a quantidade de ids. */
export class FakeMediaUrlRepository implements MediaUrlRepository {
  constructor(private readonly database: FakeSupabaseDatabase) {}

  async findPublicUrls(mediaIds: readonly string[]): Promise<MediaUrlMap> {
    if (mediaIds.length === 0) {
      return new Map()
    }

    this.database.record({ table: TABLE, operation: 'select' })
    const wanted = new Set(mediaIds)
    return new Map(
      this.database
        .rows(TABLE)
        .filter(
          (row): row is Row & { id: string; public_url: string } =>
            wanted.has(row.id as string) && row.public_url !== null && row.public_url !== undefined,
        )
        .map((row) => [row.id, row.public_url]),
    )
  }
}
