import { Inject, Injectable } from '@nestjs/common'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { MediaUrlMap } from '../../../shared/domain/media-references'
import { SUPABASE_CLIENT } from '../../../shared/infrastructure/supabase-client'
import { unwrap } from '../../../shared/infrastructure/supabase-operation.error'
import type { MediaUrlRepository } from '../domain/media-url-repository.port'

const TABLE = 'media_assets'
const COLUMNS = 'id,public_url'

interface MediaUrlRow {
  id: string
  public_url: string | null
}

/**
 * Resolve identificadores de mídia em URLs públicas sobre o Supabase.
 *
 * **Risco R-05.** Uma consulta para todas as mídias referenciadas, com `in`, e
 * nenhuma quando não há referência nenhuma. O custo é o mesmo com uma imagem ou
 * com trinta, e é isso que os testes de contagem prendem.
 */
@Injectable()
export class SupabaseMediaUrlRepository implements MediaUrlRepository {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  async findPublicUrls(mediaIds: readonly string[]): Promise<MediaUrlMap> {
    if (mediaIds.length === 0) {
      return new Map()
    }

    const rows = unwrap<MediaUrlRow[]>(
      'resolver URLs de mídia',
      await this.supabase
        .from(TABLE)
        .select(COLUMNS)
        .in('id', [...mediaIds])
        .returns<MediaUrlRow[]>(),
    )

    // `public_url` é `not null` na migração; a checagem existe para que uma
    // eventual linha sem endereço saia do mapa em vez de virar um `src` vazio
    // na LP — a mesma regra de "ou é URL pública, ou o campo não existe".
    return new Map(
      (rows ?? [])
        .filter((row): row is MediaUrlRow & { public_url: string } => row.public_url !== null)
        .map((row) => [row.id, row.public_url]),
    )
  }
}
