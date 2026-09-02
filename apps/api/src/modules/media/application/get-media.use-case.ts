import { Inject, Injectable } from '@nestjs/common'
import { ResourceNotFoundError } from '../../../shared/domain/resource-not-found.error'
import { ensureMediaId } from '../domain/media-id'
import { MEDIA_REPOSITORY, type MediaRepository } from '../domain/media-repository.port'
import { toMediaView, type MediaView } from './media-view'

/** O registro de uma mídia (SDD § "Endpoints administrativos"). */
@Injectable()
export class GetMediaUseCase {
  constructor(
    @Inject(MEDIA_REPOSITORY) private readonly repository: MediaRepository,
  ) {}

  async execute(id: string): Promise<MediaView> {
    const asset = await this.repository.findById(ensureMediaId(id))
    if (asset === null) {
      throw new ResourceNotFoundError(`mídia ${id}`)
    }
    return toMediaView(asset)
  }
}
