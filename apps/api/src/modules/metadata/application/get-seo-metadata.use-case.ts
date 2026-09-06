import { Inject, Injectable } from '@nestjs/common'
import {
  SITE_METADATA_REPOSITORY,
  type SiteMetadataRepository,
} from '../domain/site-metadata-repository.port'
import type { SeoMetadata } from './seo-metadata'

function optionalText(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

/** Só os metadados, para o injetor de SEO da borda (SDD § D-06). */
@Injectable()
export class GetSeoMetadataUseCase {
  constructor(
    @Inject(SITE_METADATA_REPOSITORY)
    private readonly repository: SiteMetadataRepository,
  ) {}

  async execute(): Promise<SeoMetadata> {
    const stored = await this.repository.find()
    return {
      title: optionalText(stored?.document.title),
      description: optionalText(stored?.document.description),
      ogImageUrl: stored?.ogImageUrl ?? null,
    }
  }
}
