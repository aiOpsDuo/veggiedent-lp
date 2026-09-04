import { Inject, Injectable } from '@nestjs/common'
import { getSectionSchema } from '@veggiedent/content-schema'
import {
  SECTION_REPOSITORY,
  type SectionRepository,
} from '../domain/section-repository.port'
import { ensureSectionKey } from '../domain/validated-section-document'
import type { SectionDetail } from './section-view'

/**
 * Documento completo de uma seção, publicado ou não — a tela de edição precisa
 * ver o que está guardado, não o que a LP recebe.
 *
 * Seção conhecida que ainda não foi salva devolve documento vazio, e não `404`:
 * ela existe no conjunto fechado das 9, só não tem conteúdo. `404` fica
 * reservado para chave que não é seção nenhuma.
 */
@Injectable()
export class GetSectionUseCase {
  constructor(
    @Inject(SECTION_REPOSITORY) private readonly repository: SectionRepository,
  ) {}

  async execute(key: string): Promise<SectionDetail> {
    const sectionKey = ensureSectionKey(key)
    const stored = await this.repository.findByKey(sectionKey)
    return {
      key: sectionKey,
      label: getSectionSchema(sectionKey).label,
      isPublished: stored?.isPublished ?? false,
      updatedAt: stored?.updatedAt ?? null,
      data: stored?.data ?? {},
    }
  }
}
