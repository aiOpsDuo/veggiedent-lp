import type { LeadSubmission } from './lead-submission'
import type { RdStationStatus } from './rdstation-outcome'

/**
 * Um lead guardado (SDD § "Modelo de dados" — tabela `leads`).
 *
 * É o envio do formulário mais o que só existe depois da gravação: o
 * identificador, o instante e o resultado do repasse ao RD Station.
 */
export interface Lead extends LeadSubmission {
  readonly id: string
  readonly createdAt: string
  readonly rdstationStatus: RdStationStatus
  readonly rdstationError: string | null
}

/** O lead no instante da gravação, antes de qualquer tentativa de repasse. */
export interface NewLead extends LeadSubmission {
  readonly id: string
}
