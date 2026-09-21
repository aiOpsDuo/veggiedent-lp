import { Inject, Injectable } from '@nestjs/common'
import { isSectionKey, type SectionKey } from '@veggiedent/content-schema'
import type { ContentSection, PrismaClient } from '../../../generated/prisma/client'
import { Prisma } from '../../../generated/prisma/client'
import { PRISMA_CLIENT } from '../../../shared/infrastructure/prisma-client'
import type {
  SectionRepository,
  StoredSection,
} from '../domain/section-repository.port'
import type { ValidatedSectionDocument } from '../domain/validated-section-document'

/** Código Prisma para "registro não encontrado" em `update`/`delete`. */
const RECORD_NOT_FOUND = 'P2025'

function isRecordNotFoundError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === RECORD_NOT_FOUND
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * A linha vira documento de domínio, ou é descartada.
 *
 * Uma chave fora das 9 não pode existir (validada em toda escrita por
 * `ensureSectionKey`, já que o MySQL não tem CHECK declarativo portável —
 * `schema.prisma`, nota de `ContentSection.key`) mas, se existisse, entrar no
 * conteúdo servido seria pior do que sumir: o restante da página continua
 * correto. `data` fora de forma vira documento vazio pela mesma razão — o
 * banco guarda `json` e não garante estrutura (SDD § D-01). Mesma robustez do
 * adaptador Supabase que este substitui.
 */
function toStoredSection(row: ContentSection): StoredSection | null {
  if (!isSectionKey(row.key)) {
    return null
  }
  return {
    key: row.key,
    data: isRecord(row.data) ? row.data : {},
    isPublished: row.isPublished,
    updatedAt: row.updatedAt.toISOString(),
  }
}

/**
 * Repositório de seções sobre o Prisma/MySQL — substitui `SupabaseSectionRepository`
 * (SDD § D-10). Único lugar do módulo que fala com o banco.
 */
@Injectable()
export class MySqlSectionRepository implements SectionRepository {
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  /** Uma consulta para as 9 seções — a leitura agregada do risco R-05. */
  async findAll(): Promise<StoredSection[]> {
    const rows = await this.prisma.contentSection.findMany()
    return rows
      .map(toStoredSection)
      .filter((section): section is StoredSection => section !== null)
  }

  async findByKey(key: SectionKey): Promise<StoredSection | null> {
    const row = await this.prisma.contentSection.findUnique({
      where: { key },
    })
    return row === null ? null : toStoredSection(row)
  }

  /**
   * Substitui o documento e publica: salvar é publicar (SDD § "Linguagem
   * ubíqua"). `upsert` porque a seção existe no conjunto fechado das 9 desde
   * sempre — a primeira gravação cria a linha, as seguintes a substituem, e a
   * chave nunca é inventada aqui: quem chega até este método já passou por
   * `ensureSectionKey`.
   */
  async save(
    key: SectionKey,
    document: ValidatedSectionDocument,
    operatorId: string,
  ): Promise<StoredSection> {
    const data = document as unknown as Prisma.InputJsonValue
    const row = await this.prisma.contentSection.upsert({
      where: { key },
      create: {
        key,
        data,
        isPublished: true,
        updatedAt: new Date(),
        updatedById: operatorId,
      },
      update: {
        data,
        isPublished: true,
        updatedAt: new Date(),
        updatedById: operatorId,
      },
    })
    return toStoredSection(row) as StoredSection
  }

  /**
   * `update` e não `upsert`: alternar a visibilidade de uma seção que nunca foi
   * salva criaria uma linha com documento vazio. Sem linha, o Prisma lança
   * `P2025` — capturado aqui e traduzido em `null`, que o caso de uso converte
   * em recurso inexistente. Nunca deixamos a exceção subir.
   */
  async setVisibility(
    key: SectionKey,
    isPublished: boolean,
    operatorId: string,
  ): Promise<StoredSection | null> {
    try {
      const row = await this.prisma.contentSection.update({
        where: { key },
        data: {
          isPublished,
          updatedAt: new Date(),
          updatedById: operatorId,
        },
      })
      return toStoredSection(row)
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        return null
      }
      throw error
    }
  }
}
