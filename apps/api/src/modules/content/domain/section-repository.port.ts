import type { SectionKey } from '@veggiedent/content-schema'
import type { ValidatedSectionDocument } from './validated-section-document'

/** Token de injeção da porta. O domínio declara; a infraestrutura implementa. */
export const SECTION_REPOSITORY = Symbol('SectionRepository')

/** Um documento de seção como está guardado, com seu estado de publicação. */
export interface StoredSection {
  readonly key: SectionKey
  readonly data: Readonly<Record<string, unknown>>
  readonly isPublished: boolean
  readonly updatedAt: string
}

/**
 * Porta de persistência das seções (SDD § "Visão de layers dentro da API").
 *
 * O domínio declara o que precisa sem saber que do outro lado há Postgres,
 * `jsonb` ou PostgREST — a mesma inversão que a T5 aplicou à verificação de
 * token. Duas exigências viajam no contrato:
 *
 * - `findAll` devolve **todas** as seções de uma vez. É a assinatura que impede
 *   o N+1 do risco R-05: não existe método que leia uma seção por vez em lote.
 * - `save` só aceita `ValidatedSectionDocument`, então não há gravação possível
 *   sem passar pelo esquema (risco R-03).
 */
export interface SectionRepository {
  findAll(): Promise<StoredSection[]>
  findByKey(key: SectionKey): Promise<StoredSection | null>
  save(
    key: SectionKey,
    document: ValidatedSectionDocument,
    operatorId: string,
  ): Promise<StoredSection>
  /** Devolve `null` quando a seção ainda não tem documento guardado. */
  setVisibility(
    key: SectionKey,
    isPublished: boolean,
    operatorId: string,
  ): Promise<StoredSection | null>
}
