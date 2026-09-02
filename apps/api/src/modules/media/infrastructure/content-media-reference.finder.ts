import { Inject, Injectable } from '@nestjs/common'
import { getSectionSchema, siteMetadataSchema } from '@veggiedent/content-schema'
import { collectMediaIds } from '../../../shared/domain/media-references'
import {
  SECTION_REPOSITORY,
  type SectionRepository,
} from '../../content/domain/section-repository.port'
import {
  SITE_METADATA_REPOSITORY,
  type SiteMetadataRepository,
} from '../../metadata/domain/site-metadata-repository.port'
import type {
  MediaReference,
  MediaReferenceFinder,
} from '../domain/media-reference-finder.port'

const METADATA_LABEL = 'Metadados da página'

/**
 * Responde "quem está usando esta mídia" lendo o conteúdo pelas portas dos
 * módulos donos dele — nunca pelas tabelas: `content_sections` e
 * `site_metadata` continuam sendo assunto de quem as declarou (a mesma regra
 * que a T6 seguiu ao ler mídia pela porta em vez de pela tabela).
 *
 * Duas consultas no total, uma por tabela, e nenhuma por seção: os documentos
 * chegam em bloco e a varredura acontece em memória, com as mesmas funções que
 * resolvem mídia no conteúdo publicado (risco R-05).
 *
 * Seção despublicada conta como referência. Visibilidade retira da LP sem
 * apagar (SDD § "Linguagem ubíqua"), e apagar a mídia de uma seção desligada
 * impediria que ela voltasse idêntica, que é o que o critério C-08 exige.
 */
@Injectable()
export class ContentMediaReferenceFinder implements MediaReferenceFinder {
  constructor(
    @Inject(SECTION_REPOSITORY) private readonly sections: SectionRepository,
    @Inject(SITE_METADATA_REPOSITORY)
    private readonly metadata: SiteMetadataRepository,
  ) {}

  async findReferencesTo(mediaId: string): Promise<MediaReference[]> {
    const [sections, metadata] = await Promise.all([
      this.sections.findAll(),
      this.metadata.find(),
    ])

    const references: MediaReference[] = sections
      .filter((section) =>
        collectMediaIds(getSectionSchema(section.key), section.data).includes(mediaId),
      )
      .map((section) => ({
        scope: 'secao' as const,
        label: getSectionSchema(section.key).label,
      }))

    const metadataIds =
      metadata === null ? [] : collectMediaIds(siteMetadataSchema, metadata.document)
    if (metadataIds.includes(mediaId)) {
      references.push({ scope: 'metadados', label: METADATA_LABEL })
    }

    return references
  }
}
