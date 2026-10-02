import type { LeadSubmission } from './lead-submission'

/**
 * Um lead guardado (SDD § "Modelo de dados" — tabela `leads`).
 *
 * É o envio do formulário mais o que só existe depois da gravação: o
 * identificador e o instante.
 *
 * O registro do consentimento LGPD é mais frouxo aqui do que em
 * `LeadSubmission` de propósito: o lead novo sempre o tem completo, mas os
 * leads gravados antes de 2026-10-02 não guardaram o texto nem o endereço da
 * política — a migração que criou as colunas só pôde preencher o aceite e o
 * instante (`created_at`). Quem lê o lead precisa lidar com os dois casos.
 */
export interface Lead
  extends Omit<LeadSubmission, 'aceiteLgpd' | 'aceiteLgpdPoliticaUrl'> {
  readonly id: string
  readonly createdAt: string
  readonly aceiteLgpd: boolean
  readonly aceiteLgpdEm: string | null
  readonly aceiteLgpdPoliticaUrl: string | null
}

/** O lead no instante da gravação. */
export interface NewLead extends LeadSubmission {
  readonly id: string
  /** Instante do aceite, ISO-8601 em UTC, pelo relógio do servidor. */
  readonly aceiteLgpdEm: string
}
