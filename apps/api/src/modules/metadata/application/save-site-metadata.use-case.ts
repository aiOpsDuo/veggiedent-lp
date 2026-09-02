import { Inject, Injectable } from '@nestjs/common'
import {
  SITE_METADATA_REPOSITORY,
  type SiteMetadataRepository,
} from '../domain/site-metadata-repository.port'
import { validateMetadata } from '../domain/validated-site-metadata'
import type { SiteMetadataView } from './seo-metadata'

/**
 * Grava os metadados da página. Como nas seções, validar vem antes de gravar e
 * não existe caminho alternativo até o repositório (risco R-03).
 */
@Injectable()
export class SaveSiteMetadataUseCase {
  constructor(
    @Inject(SITE_METADATA_REPOSITORY)
    private readonly repository: SiteMetadataRepository,
  ) {}

  async execute(document: unknown, operatorId: string): Promise<SiteMetadataView> {
    const stored = await this.repository.save(validateMetadata(document), operatorId)
    return { metadata: stored.document, updatedAt: stored.updatedAt }
  }
}
