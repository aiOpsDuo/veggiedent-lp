/**
 * A porta pela qual o painel alcança as rotas de lead da API
 * (SDD § "Endpoints administrativos", § C-12). Como nas seções e na mídia, a
 * tela depende desta interface e nunca da classe que fala HTTP.
 */

/**
 * Um lead como o painel o exibe.
 *
 * **Não existe `aceiteLgpd` aqui, e nem no lead que a API devolve.** O
 * consentimento com a Política de Privacidade é condição de envio, não dado do
 * registro: sem ele nenhum lead nasce, então a coluna só poderia dizer "sim" e
 * não distinguiria um lead de outro (ver `agent_context/CHANGELOG.md`,
 * 2026-09-02).
 */
export interface LeadView {
  readonly id: string
  readonly nome: string
  readonly email: string
  readonly telefone: string | null
  readonly nomeCachorro: string | null
  readonly porteCachorro: string | null
  readonly cidadeEstado: string | null
  readonly conheceVirbac: string | null
  readonly usaProdutoVirbac: string | null
  readonly qualProdutoVirbac: string | null
  readonly aceiteComunicacoes: boolean
  readonly origem: string | null
  readonly createdAt: string
}

export interface LeadsPage {
  readonly leads: readonly LeadView[]
  readonly total: number
  readonly page: number
  readonly pageSize: number
}

/**
 * O recorte por período, em dias `AAAA-MM-DD`. Vazio significa "sem limite
 * deste lado". O dia é o de Brasília — quem faz esse corte é a API, e é por
 * isso que o painel manda o dia, e não um instante já convertido (SDD § C-12).
 */
export interface LeadPeriod {
  readonly from: string
  readonly to: string
}

export interface LeadsQuery extends LeadPeriod {
  readonly page: number
}

/** O arquivo exportado, exatamente como a API o entregou. */
export interface LeadsExport {
  readonly filename: string
  readonly content: Blob
}

export type LeadsPageResult =
  | { readonly status: 'ok'; readonly value: LeadsPage }
  | { readonly status: 'falha'; readonly message: string }

export type LeadsExportResult =
  | { readonly status: 'ok'; readonly value: LeadsExport }
  | { readonly status: 'falha'; readonly message: string }

export type LeadDeleteResult =
  | { readonly status: 'excluido' }
  | { readonly status: 'falha'; readonly message: string }

export interface LeadsGateway {
  listLeads(accessToken: string, query: LeadsQuery): Promise<LeadsPageResult>
  exportLeads(accessToken: string, period: LeadPeriod): Promise<LeadsExportResult>
  deleteLead(accessToken: string, id: string): Promise<LeadDeleteResult>
}
