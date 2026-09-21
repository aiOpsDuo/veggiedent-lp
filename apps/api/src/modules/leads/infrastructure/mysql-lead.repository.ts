import { Inject, Injectable } from '@nestjs/common'
import { Prisma, type PrismaClient } from '../../../generated/prisma/client'
import { PRISMA_CLIENT } from '../../../shared/infrastructure/prisma-client'
import type { Lead, NewLead } from '../domain/lead'
import type { LeadIntake } from '../domain/lead-intake.port'
import type { LeadPeriod } from '../domain/lead-period'
import type { LeadQuery } from '../domain/lead-query'
import type { LeadRepository, LeadsPage } from '../domain/lead-repository.port'
import type { PorteDeCachorro } from '../domain/lead-submission'

/** Código do Prisma para "registro não encontrado" (`P2025`), o mesmo em toda operação. */
const RECORD_NOT_FOUND = 'P2025'

/** A forma como o Prisma devolve a linha de `leads` (tipos gerados de `schema.prisma`). */
interface LeadRow {
  id: string
  nome: string
  email: string
  telefone: string | null
  nomeCachorro: string | null
  porteCachorro: string | null
  cidadeEstado: string | null
  conheceVirbac: string | null
  usaProdutoVirbac: string | null
  qualProdutoVirbac: string | null
  aceiteComunicacoes: boolean
  origem: string | null
  createdAt: Date
}

function toLead(row: LeadRow): Lead {
  return {
    id: row.id,
    nome: row.nome,
    email: row.email,
    telefone: row.telefone,
    nomeCachorro: row.nomeCachorro,
    porteCachorro: row.porteCachorro as PorteDeCachorro | null,
    cidadeEstado: row.cidadeEstado,
    conheceVirbac: row.conheceVirbac,
    usaProdutoVirbac: row.usaProdutoVirbac,
    qualProdutoVirbac: row.qualProdutoVirbac,
    aceiteComunicacoes: row.aceiteComunicacoes,
    origem: row.origem,
    createdAt: row.createdAt.toISOString(),
  }
}

/**
 * O mesmo recorte por data para a listagem e para a exportação — o que faz o
 * CSV respeitar exatamente os filtros da tela que o gerou (SDD § C-12).
 *
 * `LeadPeriod.from`/`to` já chegam como instante UTC (`brasilia-time.ts`
 * converteu o dia de Brasília antes disso); este adaptador só os repassa como
 * `gte`/`lte` sobre `createdAt` — a mesma tradução literal que
 * `SupabaseLeadRepository.withPeriod` fazia sobre `gte`/`lte` do PostgREST.
 * Nenhuma conversão de fuso acontece aqui: repeti-la seria uma segunda cópia
 * da regra de `brasilia-time.ts`, e é exatamente esse tipo de duplicação que
 * quebraria o filtro em silêncio se um dia divergisse (G5).
 */
function whereForPeriod(period: LeadPeriod): Prisma.LeadWhereInput {
  if (period.from === null && period.to === null) {
    return {}
  }
  const createdAt: Prisma.DateTimeFilter = {}
  if (period.from !== null) {
    createdAt.gte = period.from
  }
  if (period.to !== null) {
    createdAt.lte = period.to
  }
  return { createdAt }
}

/** `true` quando o Prisma reporta que a linha já não existia (delete/update). */
function isRecordNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === RECORD_NOT_FOUND
}

/**
 * Os leads sobre o Prisma/MySQL — único lugar do módulo que fala com o banco
 * (substitui `SupabaseLeadRepository`, SDD § D-10).
 *
 * Uma classe implementa as **duas** portas do módulo, pelo mesmo motivo já
 * documentado no adaptador Supabase que esta substitui: separar duplicaria o
 * mapa de campos, que é justamente o conhecimento que não pode ter duas
 * versões (G5). Quem injeta continua vendo só a porta que declarou.
 */
@Injectable()
export class MySqlLeadRepository implements LeadIntake, LeadRepository {
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  /**
   * A gravação do lead. Desde que o repasse a sistema externo foi
   * descontinuado (2026-09-03) esta tabela é o **único** lugar onde o lead
   * passa a existir: se este `create` falhar, a exceção sobe e o visitante vê
   * erro, porque não há segundo destino de onde recuperá-lo.
   *
   * O `id` já chega pronto (`randomUUID()` gerado por `SubmitLeadUseCase`,
   * SDD § "DECISÃO — geração de UUID passa do banco para a aplicação" no topo
   * de `schema.prisma`): este método nunca gera identificador, só grava o que
   * recebe.
   */
  async record(lead: NewLead): Promise<void> {
    await this.prisma.lead.create({ data: { ...lead } })
  }

  /**
   * Uma consulta traz a página e o total. Diferente do PostgREST (que devolve
   * os dois no mesmo `select`, via `count: 'exact'`), o Prisma não tem uma
   * operação única equivalente — a forma documentada para "página + total" é
   * `$transaction([findMany, count])`: duas consultas, mas uma única
   * transação/ida lógica ao banco, não duas idas independentes nem N+1 (o
   * `count` não roda uma vez por linha da página).
   */
  async list(query: LeadQuery): Promise<LeadsPage> {
    const where = whereForPeriod(query.period)
    const skip = (query.page - 1) * query.pageSize

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.lead.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.pageSize,
      }),
      this.prisma.lead.count({ where }),
    ])

    return { leads: rows.map(toLead), total }
  }

  async listForExport(period: LeadPeriod, limit: number): Promise<readonly Lead[]> {
    const rows = await this.prisma.lead.findMany({
      where: whereForPeriod(period),
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    return rows.map(toLead)
  }

  async findById(id: string): Promise<Lead | null> {
    const row = await this.prisma.lead.findUnique({ where: { id } })
    return row === null ? null : toLead(row)
  }

  /**
   * Exclusão definitiva. Um identificador que já não existe (corrida entre a
   * checagem de `DeleteLeadUseCase.execute` e este `delete`) não é erro: o
   * PostgREST que este adaptador substitui também não falhava ao apagar zero
   * linhas, e preservar esse comportamento evita que uma corrida rara vire
   * `500` numa operação que, do ponto de vista de quem pediu, já teve o efeito
   * desejado (o lead não existe mais).
   */
  async delete(id: string): Promise<void> {
    try {
      await this.prisma.lead.delete({ where: { id } })
    } catch (error) {
      if (!isRecordNotFound(error)) {
        throw error
      }
    }
  }
}
