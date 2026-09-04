import { Inject, Injectable } from '@nestjs/common'
import { getSectionSchema } from '@veggiedent/content-schema'
import {
  RICH_TEXT_SANITIZER,
  type RichTextSanitizer,
} from '../../../shared/domain/rich-text-sanitizer.port'
import { sanitizeRichTextFields } from '../../../shared/domain/sanitize-rich-text-fields'
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
 * A ordem das linhas do `execute` é a regra inteira do risco R-03: chave
 * conhecida, texto rico sanitizado, documento válido, só então grava. Não
 * existe outro caminho até o repositório — a porta nem aceita um documento que
 * não tenha passado por aqui.
 *
 * A sanitização vem **antes** da validação de propósito: o que é gravado tem
 * que ser exatamente o que foi validado, e um campo que só tinha `<script>`
 * fica vazio depois de sanitizado — então é a validação que recusa, com a
 * mensagem de campo obrigatório, em vez de gravar um título em branco.
 */
@Injectable()
export class SaveSectionUseCase {
  constructor(
    @Inject(SECTION_REPOSITORY) private readonly repository: SectionRepository,
    @Inject(RICH_TEXT_SANITIZER) private readonly sanitizeRichText: RichTextSanitizer,
  ) {}

  async execute(
    key: string,
    document: unknown,
    operatorId: string,
  ): Promise<SectionDetail> {
    const sectionKey = ensureSectionKey(key)
    const sanitized = sanitizeRichTextFields(
      getSectionSchema(sectionKey),
      document,
      this.sanitizeRichText,
    )
    const validated = validateSection(sectionKey, sanitized)
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
