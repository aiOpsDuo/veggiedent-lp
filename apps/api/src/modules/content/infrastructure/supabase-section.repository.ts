import { Inject, Injectable } from '@nestjs/common'
import type { SupabaseClient } from '@supabase/supabase-js'
import { isSectionKey, type SectionKey } from '@veggiedent/content-schema'
import { SUPABASE_CLIENT } from '../../../shared/infrastructure/supabase-client'
import {
  unwrap,
  unwrapRequired,
} from '../../../shared/infrastructure/supabase-operation.error'
import type {
  SectionRepository,
  StoredSection,
} from '../domain/section-repository.port'
import type { ValidatedSectionDocument } from '../domain/validated-section-document'

const TABLE = 'content_sections'
const COLUMNS = 'key,data,is_published,updated_at'

interface SectionRow {
  key: string
  data: unknown
  is_published: boolean
  updated_at: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * A linha vira documento de domínio, ou é descartada.
 *
 * Uma chave fora das 10 não pode existir (o `check` da migração a barra) mas,
 * se existisse, entrar no conteúdo servido seria pior do que sumir: o restante
 * da página continua correto. `data` fora de forma vira documento vazio pela
 * mesma razão — o banco guarda `jsonb` e não garante estrutura (SDD § D-01).
 */
function toStoredSection(row: SectionRow): StoredSection | null {
  if (!isSectionKey(row.key)) {
    return null
  }
  return {
    key: row.key,
    data: isRecord(row.data) ? row.data : {},
    isPublished: row.is_published,
    updatedAt: row.updated_at,
  }
}

/**
 * Repositório de seções sobre o Supabase. Único lugar do módulo que fala com o
 * banco, e o faz sempre com a chave secreta (SDD § "Modelo de dados").
 */
@Injectable()
export class SupabaseSectionRepository implements SectionRepository {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  /** Uma consulta para as 10 seções — a leitura agregada do risco R-05. */
  async findAll(): Promise<StoredSection[]> {
    const rows = unwrap<SectionRow[]>(
      'listar seções',
      await this.supabase.from(TABLE).select(COLUMNS).returns<SectionRow[]>(),
    )
    return (rows ?? [])
      .map(toStoredSection)
      .filter((section): section is StoredSection => section !== null)
  }

  async findByKey(key: SectionKey): Promise<StoredSection | null> {
    const row = unwrap<SectionRow>(
      'ler seção',
      await this.supabase
        .from(TABLE)
        .select(COLUMNS)
        .eq('key', key)
        .maybeSingle<SectionRow>(),
    )
    return row === null ? null : toStoredSection(row)
  }

  /**
   * Substitui o documento e publica: salvar é publicar (SDD § "Linguagem
   * ubíqua"). `upsert` porque a seção existe no conjunto fechado das 10 desde
   * sempre — a primeira gravação cria a linha, as seguintes a substituem, e a
   * chave nunca é inventada aqui: quem chega até este método já passou por
   * `ensureSectionKey`.
   */
  async save(
    key: SectionKey,
    document: ValidatedSectionDocument,
    operatorId: string,
  ): Promise<StoredSection> {
    const row = unwrapRequired<SectionRow>(
      'gravar seção',
      await this.supabase
        .from(TABLE)
        .upsert(
          {
            key,
            data: document,
            is_published: true,
            updated_at: new Date().toISOString(),
            updated_by: operatorId,
          },
          { onConflict: 'key' },
        )
        .select(COLUMNS)
        .single<SectionRow>(),
    )
    return toStoredSection(row) as StoredSection
  }

  /**
   * `update` e não `upsert`: alternar a visibilidade de uma seção que nunca foi
   * salva criaria uma linha com documento vazio. Sem linha, nada é atualizado e
   * o retorno é `null` — o caso de uso o traduz em recurso inexistente.
   */
  async setVisibility(
    key: SectionKey,
    isPublished: boolean,
    operatorId: string,
  ): Promise<StoredSection | null> {
    const row = unwrap<SectionRow>(
      'alterar visibilidade da seção',
      await this.supabase
        .from(TABLE)
        .update({
          is_published: isPublished,
          updated_at: new Date().toISOString(),
          updated_by: operatorId,
        })
        .eq('key', key)
        .select(COLUMNS)
        .maybeSingle<SectionRow>(),
    )
    return row === null ? null : toStoredSection(row)
  }
}
