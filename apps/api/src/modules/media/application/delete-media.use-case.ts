import { Inject, Injectable } from '@nestjs/common'
import { ResourceInUseError } from '../../../shared/domain/resource-in-use.error'
import { ResourceNotFoundError } from '../../../shared/domain/resource-not-found.error'
import { ensureMediaId } from '../domain/media-id'
import {
  MEDIA_REFERENCE_FINDER,
  type MediaReferenceFinder,
} from '../domain/media-reference-finder.port'
import { MEDIA_REPOSITORY, type MediaRepository } from '../domain/media-repository.port'
import { MEDIA_STORAGE, type MediaStorage } from '../domain/media-storage.port'
import { splitStoragePath } from '../domain/storage-path'

/**
 * Remove uma mídia, se ninguém a estiver usando (SDD § "Endpoints
 * administrativos" — a remoção é recusada com `409` quando referenciada).
 *
 * A pergunta é feita sobre o conteúdo **inteiro**, publicado ou não: uma seção
 * despublicada guarda o conteúdo para voltar depois (SDD § "Linguagem ubíqua" —
 * Visibilidade), e apagar a mídia dela quebraria essa volta.
 *
 * A ordem entre banco e armazenamento é deliberada: o registro sai primeiro, o
 * arquivo depois. Ao contrário, uma falha no meio deixaria um registro
 * apontando para um arquivo que não existe mais — a LP com imagem quebrada. Na
 * ordem escolhida, a falha no meio deixa no máximo um arquivo órfão, que é
 * inerte porque nada mais o referencia (risco R-04) e que a limpeza periódica
 * documentada no README recolhe.
 */
@Injectable()
export class DeleteMediaUseCase {
  constructor(
    @Inject(MEDIA_REPOSITORY) private readonly repository: MediaRepository,
    @Inject(MEDIA_STORAGE) private readonly storage: MediaStorage,
    @Inject(MEDIA_REFERENCE_FINDER)
    private readonly references: MediaReferenceFinder,
  ) {}

  async execute(rawId: string): Promise<void> {
    const id = ensureMediaId(rawId)
    const asset = await this.repository.findById(id)
    if (asset === null) {
      throw new ResourceNotFoundError(`mídia ${id}`)
    }

    const inUseBy = await this.references.findReferencesTo(id)
    if (inUseBy.length > 0) {
      throw new ResourceInUseError(
        `mídia ${id}`,
        inUseBy.map((reference) => reference.label),
      )
    }

    await this.repository.delete(id)

    const { bucket, objectPath } = splitStoragePath(asset.storagePath)
    await this.storage.remove(bucket, objectPath)
  }
}
