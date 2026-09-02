import { Inject, Injectable } from '@nestjs/common'
import { getSectionSchema } from '@veggiedent/content-schema'
import { ResourceNotFoundError } from '../../../shared/domain/resource-not-found.error'
import {
  SECTION_REPOSITORY,
  type SectionRepository,
} from '../domain/section-repository.port'
import { ensureSectionKey } from '../domain/validated-section-document'
import type { SectionSummary } from './section-view'

/**
 * Liga e desliga uma seção sem apagar o conteúdo (SDD § C-08).
 *
 * Uma seção que nunca foi salva não tem visibilidade a alternar: publicá-la
 * significaria criar um documento vazio, que é exatamente a forma inválida que
 * o risco R-03 quer impedir. Nesse caso a operação é recusada como recurso
 * inexistente — grave a seção primeiro.
 */
@Injectable()
export class SetSectionVisibilityUseCase {
  constructor(
    @Inject(SECTION_REPOSITORY) private readonly repository: SectionRepository,
  ) {}

  async execute(
    key: string,
    isPublished: boolean,
    operatorId: string,
  ): Promise<SectionSummary> {
    const sectionKey = ensureSectionKey(key)
    const stored = await this.repository.setVisibility(
      sectionKey,
      isPublished,
      operatorId,
    )
    if (stored === null) {
      throw new ResourceNotFoundError(`documento da seção "${sectionKey}"`)
    }

    return {
      key: stored.key,
      label: getSectionSchema(stored.key).label,
      isPublished: stored.isPublished,
      updatedAt: stored.updatedAt,
    }
  }
}
