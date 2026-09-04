import { Inject, Injectable } from '@nestjs/common'
import type { SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_CLIENT } from '../../../shared/infrastructure/supabase-client'
import { unwrap } from '../../../shared/infrastructure/supabase-operation.error'
import type { Lead, NewLead } from '../domain/lead'
import type { LeadIntake } from '../domain/lead-intake.port'
import type { LeadPeriod } from '../domain/lead-period'
import type { LeadQuery } from '../domain/lead-query'
import type { LeadRepository, LeadsPage } from '../domain/lead-repository.port'
import type { PorteDeCachorro } from '../domain/lead-submission'

const TABLE = 'leads'
const COLUMNS =
  'id,nome,email,telefone,nome_cachorro,porte_cachorro,cidade_estado,' +
  'conhece_virbac,usa_produto_virbac,qual_produto_virbac,' +
  'aceite_comunicacoes,origem,created_at'

const CREATED_AT = 'created_at'

interface LeadRow {
  id: string
  nome: string
  email: string
  telefone: string | null
  nome_cachorro: string | null
  porte_cachorro: string | null
  cidade_estado: string | null
  conhece_virbac: string | null
  usa_produto_virbac: string | null
  qual_produto_virbac: string | null
  aceite_comunicacoes: boolean
  origem: string | null
  created_at: string
}

function toLead(row: LeadRow): Lead {
  return {
    id: row.id,
    nome: row.nome,
    email: row.email,
    telefone: row.telefone,
    nomeCachorro: row.nome_cachorro,
    porteCachorro: row.porte_cachorro as PorteDeCachorro | null,
    cidadeEstado: row.cidade_estado,
    conheceVirbac: row.conhece_virbac,
    usaProdutoVirbac: row.usa_produto_virbac,
    qualProdutoVirbac: row.qual_produto_virbac,
    aceiteComunicacoes: row.aceite_comunicacoes,
    origem: row.origem,
    createdAt: row.created_at,
  }
}

/**
 * Os leads sobre o Supabase — único lugar do módulo que fala com o banco.
 *
 * Uma classe implementa as **duas** portas do módulo. Elas são separadas para
 * que o caminho público não carregue a exclusão (ver `lead-intake.port.ts`),
 * mas as duas traduzem a mesma tabela: separar também o adaptador duplicaria o
 * mapa de colunas, que é justamente o conhecimento que não pode ter duas
 * versões (G5). Quem injeta continua vendo só a porta que declarou.
 */
@Injectable()
export class SupabaseLeadRepository implements LeadIntake, LeadRepository {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  /**
   * A gravação do lead. Desde que o repasse a sistema externo foi descontinuado
   * (2026-09-03) esta tabela é o **único** lugar onde o lead passa a existir: se
   * este `insert` falhar, `unwrap` lança e o visitante vê erro, porque não há
   * segundo destino de onde recuperá-lo.
   */
  async record(lead: NewLead): Promise<void> {
    unwrap(
      'gravar lead',
      await this.supabase.from(TABLE).insert({
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
      }),
    )
  }

  /**
   * Uma consulta traz a página e o total: `count: 'exact'` vem no mesmo
   * `select`, então paginar não custa uma segunda ida ao banco.
   */
  async list(query: LeadQuery): Promise<LeadsPage> {
    const first = (query.page - 1) * query.pageSize
    const response = await this.withPeriod(
      this.supabase.from(TABLE).select(COLUMNS, { count: 'exact' }),
      query.period,
    )
      .order(CREATED_AT, { ascending: false })
      .range(first, first + query.pageSize - 1)
      .returns<LeadRow[]>()

    const rows = unwrap<LeadRow[]>('listar leads', response) ?? []
    return { leads: rows.map(toLead), total: response.count ?? 0 }
  }

  async listForExport(period: LeadPeriod, limit: number): Promise<readonly Lead[]> {
    const rows = unwrap<LeadRow[]>(
      'exportar leads',
      await this.withPeriod(this.supabase.from(TABLE).select(COLUMNS), period)
        .order(CREATED_AT, { ascending: false })
        .range(0, limit - 1)
        .returns<LeadRow[]>(),
    )
    return (rows ?? []).map(toLead)
  }

  async findById(id: string): Promise<Lead | null> {
    const row = unwrap<LeadRow>(
      'ler lead',
      await this.supabase.from(TABLE).select(COLUMNS).eq('id', id).maybeSingle<LeadRow>(),
    )
    return row === null ? null : toLead(row)
  }

  async delete(id: string): Promise<void> {
    unwrap('excluir lead', await this.supabase.from(TABLE).delete().eq('id', id))
  }

  /**
   * O mesmo recorte por data para a listagem e para a exportação — é o que faz
   * o CSV respeitar exatamente os filtros da tela que o gerou (SDD § C-12).
   */
  private withPeriod<T extends PeriodFilterable>(query: T, period: LeadPeriod): T {
    let filtered = query
    if (period.from !== null) {
      filtered = filtered.gte(CREATED_AT, period.from)
    }
    if (period.to !== null) {
      filtered = filtered.lte(CREATED_AT, period.to)
    }
    return filtered
  }
}

/** O mínimo que `withPeriod` precisa saber sobre a consulta que recebe. */
interface PeriodFilterable {
  gte(column: string, value: string): this
  lte(column: string, value: string): this
}
