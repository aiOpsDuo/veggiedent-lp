import { FieldValidationError } from '../../../shared/domain/field-validation.error'
import { toLeadPeriod, type LeadPeriod } from './lead-period'

/**
 * A consulta da listagem administrativa: o recorte por data mais a página
 * (SDD § "Endpoints administrativos" — "Lista paginada, mais recente primeiro").
 *
 * A ordenação não é parâmetro. O SDD fixa "mais recente primeiro" e o índice da
 * migração é descendente sobre `created_at`; deixar a ordem aberta seria
 * oferecer uma consulta que o banco não sabe responder rápido, para uma
 * pergunta que ninguém fez.
 */

export const DEFAULT_PAGE_SIZE = 50
export const MAX_PAGE_SIZE = 200

/** Teto da exportação: o CSV é montado inteiro em memória antes de ser enviado. */
export const EXPORT_ROW_LIMIT = 10000

const PAGE_MESSAGE = 'A página precisa ser um número inteiro a partir de 1.'
const PAGE_SIZE_MESSAGE = `O tamanho da página precisa estar entre 1 e ${MAX_PAGE_SIZE}.`

export interface LeadQuery {
  readonly period: LeadPeriod
  readonly page: number
  readonly pageSize: number
}

export interface LeadQueryInput {
  readonly from?: string
  readonly to?: string
  readonly page?: number
  readonly pageSize?: number
}

function toPage(page: number | undefined): number {
  if (page === undefined) {
    return 1
  }
  if (!Number.isInteger(page) || page < 1) {
    throw new FieldValidationError({ page: PAGE_MESSAGE })
  }
  return page
}

function toPageSize(pageSize: number | undefined): number {
  if (pageSize === undefined) {
    return DEFAULT_PAGE_SIZE
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
    throw new FieldValidationError({ pageSize: PAGE_SIZE_MESSAGE })
  }
  return pageSize
}

export function toLeadQuery(input: LeadQueryInput): LeadQuery {
  return {
    period: toLeadPeriod(input.from, input.to),
    page: toPage(input.page),
    pageSize: toPageSize(input.pageSize),
  }
}
