import { Inject, Injectable } from '@nestjs/common'
import type { PrismaClient } from '../../../generated/prisma/client'
import { PRISMA_CLIENT } from '../../../shared/infrastructure/prisma-client'
import type { MediaAsset } from '../domain/media-asset'
import { MEDIA_KINDS, type MediaKind } from '../domain/media-kind'
import type { MediaRepository, NewMediaAsset } from '../domain/media-repository.port'

function isMediaKind(candidate: string): candidate is MediaKind {
  return (MEDIA_KINDS as readonly string[]).includes(candidate)
}

/**
 * Forma da linha como o Prisma Client a devolve — já em `camelCase`, a
 * tradução de/para `snake_case` do banco é inteiramente resolvida pelo `@map`
 * de `schema.prisma`. `sizeBytes` chega como `bigint` (coluna `BigInt`) e
 * `durationSeconds` como `Prisma.Decimal` (coluna `Decimal(10,3)`) — nenhum
 * dos dois é o tipo `number` do domínio, e a conversão abaixo é só isso: uma
 * tradução de tipo, sem regra de negócio.
 */
interface MediaAssetRow {
  id: string
  kind: string
  storagePath: string
  publicUrl: string
  mimeType: string
  sizeBytes: bigint
  originalFilename: string
  width: number | null
  height: number | null
  durationSeconds: unknown
  createdAt: Date
}

/**
 * A linha vira registro de domínio, ou é descartada.
 *
 * `kind` fora das duas naturezas não pode existir — nenhum caminho de escrita
 * grava outro valor —, mas se existisse seria uma linha que o resto do sistema
 * não sabe interpretar: bucket desconhecido, remoção impossível. Some, em vez
 * de atravessar o sistema como um valor sem significado (mesma regra que
 * `supabase-media.repository.ts` seguia).
 */
function toMediaAsset(row: MediaAssetRow): MediaAsset | null {
  if (!isMediaKind(row.kind)) {
    return null
  }
  return {
    id: row.id,
    kind: row.kind,
    storagePath: row.storagePath,
    publicUrl: row.publicUrl,
    mimeType: row.mimeType,
    sizeBytes: Number(row.sizeBytes),
    originalFilename: row.originalFilename,
    width: row.width,
    height: row.height,
    durationSeconds: row.durationSeconds === null ? null : Number(row.durationSeconds),
    createdAt: row.createdAt.toISOString(),
  }
}

/** Registro das mídias sobre o MySQL, via Prisma (SDD § D-10). */
@Injectable()
export class MySqlMediaRepository implements MediaRepository {
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  /**
   * Sempre um registro novo, com identificador gerado pela aplicação. Um
   * caminho já registrado esbarra na unicidade de `storage_path`
   * (`@unique` em `schema.prisma`) — o caso de confirmação repetida é
   * resolvido antes, por `findByStoragePath`.
   */
  async insert(asset: NewMediaAsset, operatorId: string): Promise<MediaAsset> {
    const row = await this.prisma.mediaAsset.create({
      data: {
        id: asset.id,
        kind: asset.kind,
        storagePath: asset.storagePath,
        publicUrl: asset.publicUrl,
        mimeType: asset.mimeType,
        sizeBytes: BigInt(asset.sizeBytes),
        originalFilename: asset.originalFilename,
        width: asset.width,
        height: asset.height,
        durationSeconds: asset.durationSeconds,
        createdById: operatorId,
      },
    })
    return toMediaAsset(row) as MediaAsset
  }

  async findById(id: string): Promise<MediaAsset | null> {
    const row = await this.prisma.mediaAsset.findUnique({ where: { id } })
    return row === null ? null : toMediaAsset(row)
  }

  async findByStoragePath(storagePath: string): Promise<MediaAsset | null> {
    const row = await this.prisma.mediaAsset.findUnique({ where: { storagePath } })
    return row === null ? null : toMediaAsset(row)
  }

  async delete(id: string): Promise<void> {
    await this.prisma.mediaAsset.delete({ where: { id } })
  }
}
