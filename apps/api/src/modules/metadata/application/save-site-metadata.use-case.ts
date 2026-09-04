import { Inject, Injectable } from '@nestjs/common'
import { siteMetadataSchema } from '@veggiedent/content-schema'
import {
  RICH_TEXT_SANITIZER,
  type RichTextSanitizer,
} from '../../../shared/domain/rich-text-sanitizer.port'
import { sanitizeRichTextFields } from '../../../shared/domain/sanitize-rich-text-fields'
import {
  SITE_METADATA_REPOSITORY,
  type SiteMetadataRepository,
} from '../domain/site-metadata-repository.port'
import { validateMetadata } from '../domain/validated-site-metadata'
import type { SiteMetadataView } from './seo-metadata'

/**
 * Grava os metadados da página. Como nas seções, sanitizar texto rico vem antes
 * de validar, validar vem antes de gravar, e não existe caminho alternativo até
 * o repositório (risco R-03).
 *
 * Hoje o esquema dos metadados não tem campo de texto rico, e a sanitização é
 * um laço sobre nenhum campo. Ela está aqui para que o dia em que tiver não
 * dependa de alguém lembrar: os dois caminhos de gravação de conteúdo passam
 * pela mesma política.
 */
@Injectable()
export class SaveSiteMetadataUseCase {
  constructor(
    @Inject(SITE_METADATA_REPOSITORY)
    private readonly repository: SiteMetadataRepository,
    @Inject(RICH_TEXT_SANITIZER) private readonly sanitizeRichText: RichTextSanitizer,
  ) {}

  async execute(document: unknown, operatorId: string): Promise<SiteMetadataView> {
    const sanitized = sanitizeRichTextFields(siteMetadataSchema, document, this.sanitizeRichText)
    const stored = await this.repository.save(validateMetadata(sanitized), operatorId)
    return { metadata: stored.document, updatedAt: stored.updatedAt }
  }
}
