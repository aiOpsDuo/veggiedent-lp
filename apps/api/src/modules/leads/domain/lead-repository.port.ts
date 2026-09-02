import type { Lead } from './lead'
import type { LeadPeriod } from './lead-period'
import type { LeadQuery } from './lead-query'

/** Token de injeção da porta. O domínio declara; a infraestrutura implementa. */
export const LEAD_REPOSITORY = Symbol('LeadRepository')

/** Uma página de leads e o total que o filtro alcança, para a paginação. */
export interface LeadsPage {
  readonly leads: readonly Lead[]
  readonly total: number
}

/**
 * A consulta e a exclusão de leads — o caminho administrativo, atrás de token
 * (SDD § C-12: "Nenhum lead é acessível sem autenticação").
 *
 * `list` devolve o total junto da página porque quem pagina precisa dos dois na
 * mesma pergunta; separá-los faria a tela do painel consultar duas vezes o que
 * o banco responde de uma.
 */
export interface LeadRepository {
  list(query: LeadQuery): Promise<LeadsPage>
  /** Todos os leads do período, do mais recente ao mais antigo, para o CSV. */
  listForExport(period: LeadPeriod, limit: number): Promise<readonly Lead[]>
  findById(id: string): Promise<Lead | null>
  /** Exclusão definitiva, para pedido do titular (LGPD). Não há desfazer. */
  delete(id: string): Promise<void>
}
