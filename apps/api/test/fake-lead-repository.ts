import type { Lead, NewLead } from '../src/modules/leads/domain/lead'
import type { LeadIntake } from '../src/modules/leads/domain/lead-intake.port'
import type { LeadPeriod } from '../src/modules/leads/domain/lead-period'
import type { LeadQuery } from '../src/modules/leads/domain/lead-query'
import type { LeadRepository, LeadsPage } from '../src/modules/leads/domain/lead-repository.port'
import type { PorteDeCachorro } from '../src/modules/leads/domain/lead-submission'
import type { FakeSupabaseDatabase, Row } from './fake-supabase'

/**
 * `LeadIntake`/`LeadRepository` de teste — substitui `SupabaseLeadRepository`
 * nos testes, mesma dupla-porta que `MySqlLeadRepository` implementa em
 * produção (as duas portas compartilham o mesmo mapa de campos — G5 — e por
 * isso uma única classe as satisfaz aqui também).
 *
 * Fala com a tabela genérica `leads` de `FakeSupabaseDatabase` em vez de
 * fingir ser o `PrismaClient` inteiro, mesmo padrão de
 * `FakeMediaRepository`/`FakeSectionRepository`. `admin-leads.e2e-spec.ts` e
 * `captura-de-lead.e2e-spec.ts` continuam chamando
 * `harness.database.seed('leads', ...)`/`harness.database.rows('leads')` com
 * as mesmas colunas em `snake_case` de sempre.
 */

const TABLE = 'leads'

/**
 * `NewLead`/`Lead` são `camelCase` (mesma forma que o Prisma usa, já que
 * `MySqlLeadRepository.record` grava `{ ...lead }` sem tradução — o
 * `schema.prisma` já declara as colunas em `camelCase`). A tabela genérica
 * `leads` deste dublê, porém, herdou os nomes de coluna do PostgREST
 * (`snake_case`, ver `admin-leads.e2e-spec.ts`/`captura-de-lead.e2e-spec.ts`)
 * — este par de funções é a única tradução entre as duas formas.
 */
function toRow(lead: NewLead): Row {
  return {
    id: lead.id,
    nome: lead.nome,
    email: lead.email,
    telefone: lead.telefone,
    nome_cachorro: lead.nomeCachorro,
    porte_cachorro: lead.porteCachorro,
    cidade_estado: lead.cidadeEstado,
    conhece_virbac: lead.conheceVirbac,
    usa_produto_virbac: lead.usaProdutoVirbac,
    qual_produto_virbac: lead.qualProdutoVirbac,
    aceite_comunicacoes: lead.aceiteComunicacoes,
    origem: lead.origem,
  }
}

function toLead(row: Row): Lead {
  return {
    id: row.id as string,
    nome: row.nome as string,
    email: row.email as string,
    telefone: (row.telefone as string | null) ?? null,
    nomeCachorro: (row.nome_cachorro as string | null) ?? null,
    porteCachorro: (row.porte_cachorro as PorteDeCachorro | null) ?? null,
    cidadeEstado: (row.cidade_estado as string | null) ?? null,
    conheceVirbac: (row.conhece_virbac as string | null) ?? null,
    usaProdutoVirbac: (row.usa_produto_virbac as string | null) ?? null,
    qualProdutoVirbac: (row.qual_produto_virbac as string | null) ?? null,
    aceiteComunicacoes: Boolean(row.aceite_comunicacoes),
    origem: (row.origem as string | null) ?? null,
    createdAt: row.created_at as string,
  }
}

/**
 * O mesmo recorte por data da listagem e da exportação — `LeadPeriod.from`/`to`
 * já chegam como instante UTC (`brasilia-time.ts`), comparados aqui como texto
 * ISO-8601, que ordena e compara exatamente como o instante que representa.
 */
function withinPeriod(row: Row, period: LeadPeriod): boolean {
  const createdAt = row.created_at as string
  if (period.from !== null && createdAt < period.from) {
    return false
  }
  if (period.to !== null && createdAt > period.to) {
    return false
  }
  return true
}

function byCreatedAtDesc(a: Row, b: Row): number {
  return (b.created_at as string) < (a.created_at as string) ? -1 : 1
}

export class FakeLeadRepository implements LeadIntake, LeadRepository {
  constructor(private readonly database: FakeSupabaseDatabase) {}

  /**
   * A gravação do lead. `insert` recusa chave duplicada, mesma semântica de
   * `create` do adaptador Prisma — o `id` já chega pronto de
   * `SubmitLeadUseCase`.
   */
  async record(lead: NewLead): Promise<void> {
    this.database.record({ table: TABLE, operation: 'insert' })
    this.failIfConfigured()
    this.database.insert(TABLE, toRow(lead))
  }

  async list(query: LeadQuery): Promise<LeadsPage> {
    this.database.record({ table: TABLE, operation: 'select' })
    this.failIfConfigured()
    const matching = this.database
      .rows(TABLE)
      .filter((row) => withinPeriod(row, query.period))
      .sort(byCreatedAtDesc)
    const start = (query.page - 1) * query.pageSize
    const page = matching.slice(start, start + query.pageSize)
    return { leads: page.map(toLead), total: matching.length }
  }

  async listForExport(period: LeadPeriod, limit: number): Promise<readonly Lead[]> {
    this.database.record({ table: TABLE, operation: 'select' })
    this.failIfConfigured()
    return this.database
      .rows(TABLE)
      .filter((row) => withinPeriod(row, period))
      .sort(byCreatedAtDesc)
      .slice(0, limit)
      .map(toLead)
  }

  async findById(id: string): Promise<Lead | null> {
    this.database.record({ table: TABLE, operation: 'select' })
    this.failIfConfigured()
    const row = this.database.rows(TABLE).find((candidate) => candidate.id === id)
    return row === undefined ? null : toLead(row)
  }

  /** Exclusão definitiva; identificador inexistente não é erro (mesma tolerância do adaptador Prisma). */
  async delete(id: string): Promise<void> {
    this.database.record({ table: TABLE, operation: 'delete' })
    this.failIfConfigured()
    const matching = this.database.rows(TABLE).filter((row) => row.id === id)
    this.database.delete(TABLE, matching)
  }

  private failIfConfigured(): void {
    const failure = this.database.failureFor(TABLE)
    if (failure) {
      throw new Error(`Falha simulada em "${TABLE}": ${failure.message}`)
    }
  }
}
