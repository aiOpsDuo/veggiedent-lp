import type {
  LeadDeleteResult,
  LeadPeriod,
  LeadView,
  LeadsExportResult,
  LeadsGateway,
  LeadsPageResult,
  LeadsQuery,
} from '../src/leads/leads-gateway'

/**
 * Dublê da API de leads: guarda os leads em memória e responde como a API
 * responde. A rede inteira do painel mora aqui e só aqui — a tela, o filtro, a
 * ordenação e a exclusão exercitados nos testes são o código de produção.
 *
 * Ele **recorta o período do jeito que a API recorta**, em horário de Brasília
 * (SDD § C-12), e pagina sobre o mesmo conjunto ordenado que ela pagina —
 * senão a página 2 do dublê traria leads que a página 2 da API não traria.
 *
 * O que ele faz de propósito é entregar cada página na ordem **inversa** da
 * esperada, pelo mesmo motivo que o dublê de seções embaralha a lista: a ordem
 * que o operador vê é responsabilidade do painel, e um teste que depende de a
 * resposta já vir ordenada não prova nada.
 */

const BRASILIA_UTC_OFFSET = '-03:00'

/** O CSV que a API responderia: BOM UTF-8, ponto e vírgula, fim de linha CRLF. */
const CSV_BOM = '﻿'
export const CSV_DO_PERIODO = `${CSV_BOM}"Recebido em";"Nome"\r\n"03/09/2026 00:00";"Ana Conceição"\r\n`
export const NOME_DO_ARQUIVO = 'leads-2026-09-03.csv'

export interface FakeLeadsGatewayOptions {
  readonly leads?: readonly LeadView[]
  readonly pageSize?: number
  /** Quando presente, toda listagem falha com esta mensagem. */
  readonly failListWith?: string
  /** Quando presente, toda exportação falha com esta mensagem. */
  readonly failExportWith?: string
  /** Quando presente, toda exclusão falha com esta mensagem. */
  readonly failDeleteWith?: string
}

const DEFAULT_PAGE_SIZE = 50

function startOfDay(day: string): number {
  return Date.parse(`${day}T00:00:00.000${BRASILIA_UTC_OFFSET}`)
}

function endOfDay(day: string): number {
  return Date.parse(`${day}T23:59:59.999${BRASILIA_UTC_OFFSET}`)
}

export class FakeLeadsGateway implements LeadsGateway {
  /** Toda consulta recebida, na ordem em que chegou. */
  readonly consultas: LeadsQuery[] = []
  /** Todo período pedido para exportação. */
  readonly exportacoes: LeadPeriod[] = []
  /** Todo identificador cuja exclusão foi pedida à API. */
  readonly exclusoes: string[] = []

  private leads: LeadView[]

  constructor(private readonly options: FakeLeadsGatewayOptions = {}) {
    this.leads = [...(options.leads ?? [])]
  }

  async listLeads(_accessToken: string, query: LeadsQuery): Promise<LeadsPageResult> {
    this.consultas.push(query)
    if (this.options.failListWith !== undefined) {
      return { status: 'falha', message: this.options.failListWith }
    }

    const noPeriodo = this.leads
      .filter((lead) => this.dentroDoPeriodo(lead, query))
      .sort((esquerda, direita) => Date.parse(direita.createdAt) - Date.parse(esquerda.createdAt))
    const pageSize = this.options.pageSize ?? DEFAULT_PAGE_SIZE
    const inicio = (query.page - 1) * pageSize
    return {
      status: 'ok',
      value: {
        leads: noPeriodo.slice(inicio, inicio + pageSize).reverse(),
        total: noPeriodo.length,
        page: query.page,
        pageSize,
      },
    }
  }

  async exportLeads(_accessToken: string, period: LeadPeriod): Promise<LeadsExportResult> {
    this.exportacoes.push(period)
    if (this.options.failExportWith !== undefined) {
      return { status: 'falha', message: this.options.failExportWith }
    }
    return {
      status: 'ok',
      value: {
        filename: NOME_DO_ARQUIVO,
        content: new Blob([CSV_DO_PERIODO], { type: 'text/csv; charset=utf-8' }),
      },
    }
  }

  async deleteLead(_accessToken: string, id: string): Promise<LeadDeleteResult> {
    this.exclusoes.push(id)
    if (this.options.failDeleteWith !== undefined) {
      return { status: 'falha', message: this.options.failDeleteWith }
    }
    this.leads = this.leads.filter((lead) => lead.id !== id)
    return { status: 'excluido' }
  }

  private dentroDoPeriodo(lead: LeadView, period: LeadPeriod): boolean {
    const instante = Date.parse(lead.createdAt)
    const depoisDoInicio = period.from === '' || instante >= startOfDay(period.from)
    const antesDoFim = period.to === '' || instante <= endOfDay(period.to)
    return depoisDoInicio && antesDoFim
  }
}

/** Um lead com os campos preenchidos, para o teste variar só o que importa. */
export function leadDeTeste(overrides: Partial<LeadView> & Pick<LeadView, 'id'>): LeadView {
  return {
    nome: 'Ana Conceição',
    email: 'ana@exemplo.com',
    telefone: '11999999999',
    nomeCachorro: 'Bidu',
    porteCachorro: 'medio',
    cidadeEstado: 'São Paulo/SP',
    conheceVirbac: 'sim',
    usaProdutoVirbac: 'não',
    qualProdutoVirbac: null,
    aceiteComunicacoes: true,
    origem: 'lp-veggiedent',
    rdstationStatus: 'nao_enviado',
    rdstationError: null,
    createdAt: '2026-09-03T12:00:00.000Z',
    ...overrides,
  }
}
