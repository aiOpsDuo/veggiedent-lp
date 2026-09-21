import { Inject, Injectable } from '@nestjs/common'
import type { PrismaClient } from '../../../generated/prisma/client'
import { PRISMA_CLIENT } from '../../../shared/infrastructure/prisma-client'
import type { MediaUrlMap } from '../../../shared/domain/media-references'
import type { MediaUrlRepository } from '../domain/media-url-repository.port'

/**
 * Resolve identificadores de mídia em URLs públicas sobre o MySQL, via Prisma
 * (SDD § D-10). Substitui `supabase-media-url.repository.ts`.
 *
 * **Risco R-05.** `findMany` com `id: { in: [...] }` é uma única consulta SQL
 * (`SELECT ... WHERE id IN (...)`), com todas as mídias referenciadas de uma
 * vez — o custo é o mesmo com uma imagem ou com trinta. Sem identificador
 * nenhum, `findMany` nem chega a ser chamado.
 */
@Injectable()
export class MySqlMediaUrlRepository implements MediaUrlRepository {
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  async findPublicUrls(mediaIds: readonly string[]): Promise<MediaUrlMap> {
    if (mediaIds.length === 0) {
      return new Map()
    }

    const rows = await this.prisma.mediaAsset.findMany({
      where: { id: { in: [...mediaIds] } },
      select: { id: true, publicUrl: true },
    })

    return new Map(rows.map((row) => [row.id, row.publicUrl]))
  }
}
