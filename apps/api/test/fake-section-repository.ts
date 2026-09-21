import { isSectionKey, type SectionKey } from '@veggiedent/content-schema'
import type {
  SectionRepository,
  StoredSection,
} from '../src/modules/content/domain/section-repository.port'
import type { ValidatedSectionDocument } from '../src/modules/content/domain/validated-section-document'
import type { FakeSupabaseDatabase, Row } from './fake-supabase'

/**
 * `SectionRepository` de teste — substitui `SupabaseSectionRepository` nos
 * testes, do mesmo jeito que `FakeMediaRepository` substitui
 * `supabase-media.repository.ts` (ver o comentário lá, que já previa esta
 * reconciliação).
 *
 * Fala diretamente com a tabela genérica `content_sections` de
 * `FakeSupabaseDatabase` em vez de fingir ser o `PrismaClient` inteiro — a
 * mesma razão de sempre: a superfície gerada do Prisma é grande demais para
 * replicar por inteiro num dublê de nível de porta. É por isso que
 * `admin-secoes.e2e-spec.ts`, `conteudo-publico.e2e-spec.ts`,
 * `midia-no-conteudo.e2e-spec.ts`, `carga-do-instantaneo.e2e-spec.ts` e
 * `texto-rico.e2e-spec.ts` não precisam mudar nenhum
 * `harness.database.seed('content_sections', ...)` nem
 * `harness.database.rows('content_sections')`.
 */

const TABLE = 'content_sections'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** A linha vira documento de domínio, ou é descartada — mesma robustez do adaptador Prisma. */
function toStoredSection(row: Row): StoredSection | null {
  const key = row.key
  if (typeof key !== 'string' || !isSectionKey(key)) {
    return null
  }
  return {
    key,
    data: isRecord(row.data) ? row.data : {},
    isPublished: Boolean(row.is_published),
    updatedAt: row.updated_at as string,
  }
}

export class FakeSectionRepository implements SectionRepository {
  constructor(private readonly database: FakeSupabaseDatabase) {}

  /** Uma consulta para as 9 seções — a leitura agregada do risco R-05. */
  async findAll(): Promise<StoredSection[]> {
    this.database.record({ table: TABLE, operation: 'select' })
    this.failIfConfigured()
    return this.database
      .rows(TABLE)
      .map(toStoredSection)
      .filter((section): section is StoredSection => section !== null)
  }

  async findByKey(key: SectionKey): Promise<StoredSection | null> {
    this.database.record({ table: TABLE, operation: 'select' })
    this.failIfConfigured()
    const row = this.database.rows(TABLE).find((candidate) => candidate.key === key)
    return row === undefined ? null : toStoredSection(row)
  }

  /** Substitui o documento e publica: salvar é publicar — `upsert` por `key`. */
  async save(
    key: SectionKey,
    document: ValidatedSectionDocument,
    operatorId: string,
  ): Promise<StoredSection> {
    this.database.record({ table: TABLE, operation: 'upsert' })
    this.failIfConfigured()
    const row = this.database.upsert(TABLE, {
      key,
      data: document as unknown as Record<string, unknown>,
      is_published: true,
      updated_at: new Date().toISOString(),
      updated_by: operatorId,
    })
    return toStoredSection(row) as StoredSection
  }

  /**
   * `update`, não `upsert`: alternar a visibilidade de uma seção que nunca foi
   * salva não cria uma linha com documento vazio — devolve `null`, mesma
   * tradução que `MySqlSectionRepository.setVisibility` faz do `P2025`.
   */
  async setVisibility(
    key: SectionKey,
    isPublished: boolean,
    operatorId: string,
  ): Promise<StoredSection | null> {
    this.database.record({ table: TABLE, operation: 'update' })
    this.failIfConfigured()
    const rows = this.database.rows(TABLE)
    const existing = rows.find((candidate) => candidate.key === key)
    if (existing === undefined) {
      return null
    }
    const [updated] = this.database.update(TABLE, [existing], {
      is_published: isPublished,
      updated_at: new Date().toISOString(),
      updated_by: operatorId,
    })
    return toStoredSection(updated)
  }

  /** Reproduz `database.failOn(TABLE)`, como a `FakeQueryBuilder` faria. */
  private failIfConfigured(): void {
    const failure = this.database.failureFor(TABLE)
    if (failure) {
      throw new Error(`Falha simulada em "${TABLE}": ${failure.message}`)
    }
  }
}
