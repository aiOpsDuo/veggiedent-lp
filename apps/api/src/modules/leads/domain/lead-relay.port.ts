import type { LeadSubmission } from './lead-submission'
import type { RdStationOutcome } from './rdstation-outcome'

/** Token de injeção da porta. O domínio declara; a infraestrutura implementa. */
export const LEAD_RELAY = Symbol('LeadRelay')

/**
 * O repasse do lead ao destino de marketing (SDD § D-07).
 *
 * A porta fala de "repassar um lead", não de RD Station: é o que permite trocar
 * o destino sem tocar no caso de uso, e é o que permite testar a regra "uma
 * falha do repasse nunca perde o lead" sem nenhuma chamada de rede.
 *
 * O contrato admite as duas formas de dar errado, e quem chama trata as duas:
 * devolver um resultado `falhou`/`nao_enviado`, ou lançar. Nenhum implementador
 * é obrigado a prometer que nunca lança — uma promessa dessas seria quebrada
 * pela primeira queda de rede (LSP).
 */
export interface LeadRelay {
  forward(lead: LeadSubmission): Promise<RdStationOutcome>
}
