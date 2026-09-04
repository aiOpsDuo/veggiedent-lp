import type { LeadSubmission } from './lead-submission'

/**
 * Um lead guardado (SDD § "Modelo de dados" — tabela `leads`).
 *
 * É o envio do formulário mais o que só existe depois da gravação: o
 * identificador e o instante.
 */
export interface Lead extends LeadSubmission {
  readonly id: string
  readonly createdAt: string
}

/** O lead no instante da gravação. */
export interface NewLead extends LeadSubmission {
  readonly id: string
}
