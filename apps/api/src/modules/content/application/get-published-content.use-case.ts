import { Inject, Injectable } from '@nestjs/common'
import {
  MEDIA_URL_REPOSITORY,
  type MediaUrlRepository,
} from '../../media/domain/media-url-repository.port'
import { toPublishedMetadata } from '../../metadata/domain/published-site-metadata'
import {
  SITE_METADATA_REPOSITORY,
  type SiteMetadataRepository,
} from '../../metadata/domain/site-metadata-repository.port'
import {
  SECTION_REPOSITORY,
  type SectionRepository,
} from '../domain/section-repository.port'
import {
  collectSectionMediaIds,
  withResolvedSectionMedia,
} from '../domain/section-media'
import { toPublishedSections } from '../domain/section-visibility'
import type { PublishedContent } from './section-view'

/**
 * Todo o conteúdo publicado em uma resposta (SDD § "Contratos de dados/API").
 *
 * **Risco R-05.** A rota faz no máximo três consultas, e esse número não depende
 * de quantas seções, itens de lista ou imagens existem: uma varredura das 9
 * linhas de `content_sections`, uma leitura do registro único de `site_metadata`
 * e, quando há mídia referenciada, uma leitura de `media_assets` com **todos**
 * os identificadores de uma vez. São três porque são três tabelas — não porque
 * cada seção ou cada imagem custa uma consulta. `test/conteudo-publico.e2e-spec.ts`
 * e `test/midia-no-conteudo.e2e-spec.ts` prendem esse número contando as
 * chamadas ao cliente Supabase, inclusive dobrando a quantidade de itens.
 *
 * As duas primeiras vão juntas: nenhuma depende do resultado da outra. A
 * terceira vem depois porque só o conteúdo publicado diz quais mídias importam
 * — mídia de seção ou de item despublicado não é sequer buscada.
 */
@Injectable()
export class GetPublishedContentUseCase {
  constructor(
    @Inject(SECTION_REPOSITORY) private readonly sections: SectionRepository,
    @Inject(SITE_METADATA_REPOSITORY)
    private readonly metadata: SiteMetadataRepository,
    @Inject(MEDIA_URL_REPOSITORY)
    private readonly mediaUrls: MediaUrlRepository,
  ) {}

  async execute(): Promise<PublishedContent> {
    const [sections, metadata] = await Promise.all([
      this.sections.findAll(),
      this.metadata.find(),
    ])

    const published = toPublishedSections(sections)
    const urls = await this.mediaUrls.findPublicUrls(
      collectSectionMediaIds(published),
    )

    return {
      sections: withResolvedSectionMedia(published, urls),
      metadata: toPublishedMetadata(metadata),
    }
  }
}
