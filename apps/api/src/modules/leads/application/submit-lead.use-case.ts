import { randomUUID } from 'node:crypto'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { LEAD_INTAKE, type LeadIntake } from '../domain/lead-intake.port'
import { LEAD_RELAY, type LeadRelay } from '../domain/lead-relay.port'
import {
  isHoneypotTriggered,
  toLeadSubmission,
  type LeadSubmission,
  type RawLeadSubmission,
} from '../domain/lead-submission'
import { relayFailed, type RdStationOutcome } from '../domain/rdstation-outcome'
import type { LeadSubmissionResult } from './lead-view'

const SUCCESS: LeadSubmissionResult = { success: true }

/**
 * Recebe o formulário da LP (SDD § D-07, § C-11 e § "Endpoints públicos").
 *
 * A ordem dos três passos é a regra de negócio desta tarefa, e é ela que o
 * relay serverless não tinha:
 *
 * 1. **Honeypot antes de tudo.** Robô recebe sucesso; nada é gravado, nada é
 *    repassado. A checagem vem antes da validação porque era assim no relay que
 *    esta classe substitui — um robô que preenche o campo invisível e erra o
 *    e-mail continua vendo sucesso, e não um erro que lhe ensina o formulário.
 * 2. **Gravar.** Se a gravação falhar, aí sim o visitante vê erro: o lead se
 *    perderia, que é exatamente o que esta tarefa existe para impedir.
 * 3. **Repassar.** Depois, e nunca antes. O resultado vira `rdstation_status`.
 *    **Nenhuma falha daqui para baixo chega ao visitante** — nem recusa do RD
 *    Station, nem queda de rede, nem falha ao registrar esse resultado. O lead
 *    já está guardado; insistir em responder erro só transformaria um problema
 *    de marketing em um lead perdido.
 */
@Injectable()
export class SubmitLeadUseCase {
  private readonly logger = new Logger(SubmitLeadUseCase.name)

  constructor(
    @Inject(LEAD_INTAKE) private readonly intake: LeadIntake,
    @Inject(LEAD_RELAY) private readonly relay: LeadRelay,
  ) {}

  async execute(raw: RawLeadSubmission): Promise<LeadSubmissionResult> {
    if (isHoneypotTriggered(raw.website)) {
      return SUCCESS
    }

    const submission = toLeadSubmission(raw)
    const id = randomUUID()
    await this.intake.record({ ...submission, id })

    await this.registerRelayOutcome(id, await this.forward(submission))
    return SUCCESS
  }

  private async forward(submission: LeadSubmission): Promise<RdStationOutcome> {
    try {
      return await this.relay.forward(submission)
    } catch (error) {
      this.logger.error('Falha ao repassar o lead ao RD Station.', toStack(error))
      return relayFailed(unexpectedFailureMessage(error))
    }
  }

  /**
   * O resultado do repasse é informação secundária: o lead já está gravado.
   * Uma falha ao registrá-lo fica no log do servidor e não muda a resposta.
   */
  private async registerRelayOutcome(id: string, outcome: RdStationOutcome): Promise<void> {
    try {
      await this.intake.recordRelayOutcome(id, outcome)
    } catch (error) {
      this.logger.error(
        'Lead gravado, mas o resultado do repasse não pôde ser registrado.',
        toStack(error),
      )
    }
  }
}

/**
 * A mensagem guardada em `rdstation_error` é lida pelo painel e sai na
 * exportação. Ela diz o **tipo** da falha e manda o resto para o log: a URL do
 * RD Station carrega o token na query, e uma mensagem de erro que a
 * repetisse gravaria a credencial no banco (SDD § R-09, mesmo espírito).
 */
function unexpectedFailureMessage(error: unknown): string {
  const tipo = error instanceof Error ? error.name : typeof error
  return `Falha inesperada ao repassar o lead (${tipo}). Detalhe no log do servidor.`
}

function toStack(error: unknown): string {
  return error instanceof Error ? (error.stack ?? error.message) : String(error)
}
