import { Inject, Injectable } from '@nestjs/common'
import {
  SITE_METADATA_REPOSITORY,
  type SiteMetadataRepository,
} from '../domain/site-metadata-repository.port'
import type { SiteMetadataView } from './seo-metadata'

/** Os metadados como o painel os edita — na forma do esquema, não do SEO. */
@Injectable()
export class GetSiteMetadataUseCase {
  constructor(
    @Inject(SITE_METADATA_REPOSITORY)
    private readonly repository: SiteMetadataRepository,
  ) {}

  async execute(): Promise<SiteMetadataView> {
    const stored = await this.repository.find()
    return { metadata: stored?.document ?? {}, updatedAt: stored?.updatedAt ?? null }
  }
}
