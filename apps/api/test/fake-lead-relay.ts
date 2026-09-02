import type { LeadRelay } from '../src/modules/leads/domain/lead-relay.port'
import type { LeadSubmission } from '../src/modules/leads/domain/lead-submission'
import {
  relayAccepted,
  type RdStationOutcome,
} from '../src/modules/leads/domain/rdstation-outcome'

/**
 * O RD Station no lugar do RD Station. Substitui a porta `LEAD_RELAY`, então
 * todo o resto — controller, guarda, caso de uso e o repositório real sobre o
 * dublê do banco — continua sendo código de produção.
 *
 * Guarda o que recebeu, para que o teste verifique que **nada** foi repassado
 * quando o honeypot dispara, e sabe recusar ou explodir sob comando, que é como
 * se prova que uma falha do repasse não perde o lead (SDD § C-11).
 */
export class FakeLeadRelay implements LeadRelay {
  readonly forwarded: LeadSubmission[] = []
  private outcome: RdStationOutcome = relayAccepted()
  private failure: Error | null = null
  private observer: (() => void) | null = null

  respondWith(outcome: RdStationOutcome): void {
    this.outcome = outcome
    this.failure = null
  }

  throwOnForward(failure: Error): void {
    this.failure = failure
  }

  /**
   * Chamado no instante exato do repasse, antes de qualquer resposta. É o que
   * permite ao teste olhar o banco *durante* a chamada e provar que o lead já
   * estava gravado — a ordem que a tarefa exige, e que uma checagem feita
   * depois do fim da requisição não distingue.
   */
  observe(observer: () => void): void {
    this.observer = observer
  }

  async forward(lead: LeadSubmission): Promise<RdStationOutcome> {
    this.forwarded.push(lead)
    this.observer?.()
    if (this.failure !== null) {
      throw this.failure
    }
    return this.outcome
  }
}
