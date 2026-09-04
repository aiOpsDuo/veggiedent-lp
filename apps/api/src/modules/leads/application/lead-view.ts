import type { Lead } from '../domain/lead'

/**
 * O que as rotas de lead devolvem. Formas de saída, sem regra de negócio: a
 * apresentação não monta resposta e o domínio não conhece a forma do JSON.
 *
 * `LeadView` não tem aceite da Política de Privacidade porque o lead não o tem:
 * o consentimento é condição de envio e não é gravado (SDD § "Modelo de dados").
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
