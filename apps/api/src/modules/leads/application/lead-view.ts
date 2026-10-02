import type { Lead } from '../domain/lead'

/**
 * O que as rotas de lead devolvem. Formas de saída, sem regra de negócio: a
 * apresentação não monta resposta e o domínio não conhece a forma do JSON.
 *
 * `LeadView` traz o registro do consentimento LGPD desde 2026-10-02. Nos leads
 * anteriores a essa data, `aceiteLgpdTexto` e `aceiteLgpdPoliticaUrl` vêm
 * `null`: o texto e o endereço não eram guardados (ver `domain/lead.ts`).
 */

/** Resposta de `POST /api/leads`. */
export interface LeadSubmissionResult {
  readonly success: true
}

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
  readonly aceiteLgpd: boolean
  readonly aceiteLgpdEm: string | null
  readonly aceiteLgpdTexto: string | null
  readonly aceiteLgpdPoliticaUrl: string | null
}

/** Uma página da listagem administrativa, com o que a paginação precisa. */
export interface LeadsPageView {
  readonly leads: readonly LeadView[]
  readonly total: number
  readonly page: number
  readonly pageSize: number
}

export function toLeadView(lead: Lead): LeadView {
  return { ...lead }
}
