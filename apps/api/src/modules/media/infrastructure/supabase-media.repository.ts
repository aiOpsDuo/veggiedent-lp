import { Inject, Injectable } from '@nestjs/common'
import type { SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_CLIENT } from '../../../shared/infrastructure/supabase-client'
import {
  unwrap,
  unwrapRequired,
} from '../../../shared/infrastructure/supabase-operation.error'
import type { MediaAsset } from '../domain/media-asset'
import { MEDIA_KINDS, type MediaKind } from '../domain/media-kind'
import type {
  MediaRepository,
  NewMediaAsset,
} from '../domain/media-repository.port'

const TABLE = 'media_assets'
const COLUMNS =
  'id,kind,storage_path,public_url,mime_type,size_bytes,original_filename,width,height,duration_seconds,created_at'

interface MediaRow {
  id: string
  kind: string
  storage_path: string
  public_url: string
  mime_type: string
  size_bytes: number
  original_filename: string
  width: number | null
  height: number | null
  duration_seconds: number | null
  created_at: string
}

function isMediaKind(candidate: string): candidate is MediaKind {
  return (MEDIA_KINDS as readonly string[]).includes(candidate)
}

/**
 * A linha vira registro de domínio, ou é descartada.
 *
 * `kind` fora das três naturezas não pode existir — o `check` da migração o
 * barra —, mas se existisse seria uma linha que o resto do sistema não sabe
 * interpretar: bucket desconhecido, remoção impossível. Some, em vez de
 * atravessar o sistema como um valor sem significado.
 */
function toMediaAsset(row: MediaRow): MediaAsset | null {
  if (!isMediaKind(row.kind)) {
    return null
  }
  return {
    id: row.id,
    kind: row.kind,
    storagePath: row.storage_path,
    publicUrl: row.public_url,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes),
    originalFilename: row.original_filename,
    width: row.width,
    height: row.height,
    durationSeconds: row.duration_seconds,
    createdAt: row.created_at,
  }
}

/** Registro das mídias sobre o Supabase. */
@Injectable()
export class SupabaseMediaRepository implements MediaRepository {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  /**
   * `insert`, nunca `upsert`: a mídia é sempre um registro novo, e o
   * identificador é gerado pela aplicação. Um caminho já registrado esbarra na
   * unicidade de `storage_path` — o caso de confirmação repetida é resolvido
   * antes, por `findByStoragePath`.
   */
  async insert(asset: NewMediaAsset, operatorId: string): Promise<MediaAsset> {
    const row = unwrapRequired<MediaRow>(
      'registrar mídia',
      await this.supabase
        .from(TABLE)
        .insert({
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
          created_by: operatorId,
        })
        .select(COLUMNS)
        .single<MediaRow>(),
    )
    return toMediaAsset(row) as MediaAsset
  }

  async findById(id: string): Promise<MediaAsset | null> {
    return this.findOneBy('id', id, 'ler mídia')
  }

  async findByStoragePath(storagePath: string): Promise<MediaAsset | null> {
    return this.findOneBy('storage_path', storagePath, 'ler mídia por caminho')
  }

  async delete(id: string): Promise<void> {
    unwrap(
      'remover mídia',
      await this.supabase.from(TABLE).delete().eq('id', id),
    )
  }

  private async findOneBy(
    column: string,
    value: string,
    operation: string,
  ): Promise<MediaAsset | null> {
    const row = unwrap<MediaRow>(
      operation,
      await this.supabase
        .from(TABLE)
        .select(COLUMNS)
        .eq(column, value)
        .maybeSingle<MediaRow>(),
    )
    return row === null ? null : toMediaAsset(row)
  }
}
