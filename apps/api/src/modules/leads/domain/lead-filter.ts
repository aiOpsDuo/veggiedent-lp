import { toLeadPeriod, type LeadPeriod } from './lead-period'

/**
 * O recorte do conjunto de leads, o mesmo na listagem e na exportação: o
 * período e um trecho do e-mail. A busca por e-mail é pedido do cliente de
 * 2026-10-05 — o Marketing precisa achar o lead de quem pede a exclusão dos
 * próprios dados (LGPD) sem percorrer a lista inteira.
 *
 * O trecho é **texto literal**, não padrão de busca: quem digita `maria_s`
 * procura esse sublinhado, e não "qualquer caractere no lugar". Traduzi-lo
 * para a sintaxe do banco é trabalho do adaptador; aqui ele só perde as bordas
 * e, vazio, deixa de filtrar — o mesmo tratamento que `from`/`to` recebem em
 * `lead-period.ts`.
 */

/** O tamanho da coluna `leads.email`: um trecho maior não caberia em e-mail nenhum. */
export const EMAIL_FILTER_MAX_LENGTH = 255

export interface LeadFilter {
  readonly period: LeadPeriod
  /** Trecho do e-mail, aparado; `null` quando não há busca. */
  readonly email: string | null
}

export interface LeadFilterInput {
  readonly from?: string
  readonly to?: string
  readonly email?: string
}

function toEmailFragment(email: string | undefined): string | null {
  const trimmed = email?.trim() ?? ''
  return trimmed.length === 0 ? null : trimmed
}

export function toLeadFilter(input: LeadFilterInput): LeadFilter {
  return {
    period: toLeadPeriod(input.from, input.to),
    email: toEmailFragment(input.email),
  }
}
