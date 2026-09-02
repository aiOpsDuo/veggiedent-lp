import { Inject, Injectable } from '@nestjs/common'
import { orderedSectionSchemas } from '@veggiedent/content-schema'
import {
  SECTION_REPOSITORY,
  type SectionRepository,
  type StoredSection,
} from '../domain/section-repository.port'
import type { SectionSummary } from './section-view'

/**
 * Lista as seções para o painel (SDD § C-03).
 *
 * A lista sai do esquema, não do banco: as 12 seções são um conjunto fechado e
 * aparecem sempre, na ordem da página, mesmo antes de existir documento salvo —
 * é o que faz o painel abrir com sentido em um banco recém-migrado. O banco
 * responde apenas *quando* cada uma foi editada e se está publicada.
 *
 * Uma consulta só, para as 12 (risco R-05).
 */
@Injectable()
export class ListSectionsUseCase {
  constructor(
    @Inject(SECTION_REPOSITORY) private readonly repository: SectionRepository,
  ) {}

  async execute(): Promise<SectionSummary[]> {
    const stored = await this.repository.findAll()
    const byKey = new Map<string, StoredSection>(
      stored.map((section) => [section.key, section]),
    )

    return orderedSectionSchemas.map((schema) => {
      const section = byKey.get(schema.key)
      return {
        key: schema.key,
        label: schema.label,
        isPublished: section?.isPublished ?? false,
        updatedAt: section?.updatedAt ?? null,
      }
    })
  }
}
