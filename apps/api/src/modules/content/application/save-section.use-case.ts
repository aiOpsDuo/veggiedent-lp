import { Inject, Injectable } from '@nestjs/common'
import { getSectionSchema } from '@veggiedent/content-schema'
import {
  SECTION_REPOSITORY,
  type SectionRepository,
} from '../domain/section-repository.port'
import {
  ensureSectionKey,
  validateSection,
} from '../domain/validated-section-document'
import type { SectionDetail } from './section-view'

/**
 * Substitui o documento de uma seção. Salvar publica: não há rascunho
 * (SDD § "Linguagem ubíqua" — Publicação).
 *
 * A ordem das três linhas do `execute` é a regra inteira do risco R-03: chave
 * conhecida, documento válido, só então grava. Não existe outro caminho até o
 * repositório — a porta nem aceita um documento que não tenha passado por aqui.
 */
@Injectable()
export class SaveSectionUseCase {
  constructor(
    @Inject(SECTION_REPOSITORY) private readonly repository: SectionRepository,
  ) {}

  async execute(
    key: string,
    document: unknown,
    operatorId: string,
  ): Promise<SectionDetail> {
    const sectionKey = ensureSectionKey(key)
    const validated = validateSection(sectionKey, document)
    const stored = await this.repository.save(sectionKey, validated, operatorId)

    return {
      key: stored.key,
      label: getSectionSchema(stored.key).label,
      isPublished: stored.isPublished,
      updatedAt: stored.updatedAt,
      data: stored.data,
    }
  }
}
