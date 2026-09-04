import { randomUUID } from 'node:crypto'
import { Inject, Injectable } from '@nestjs/common'
import { LEAD_INTAKE, type LeadIntake } from '../domain/lead-intake.port'
import {
  isHoneypotTriggered,
  toLeadSubmission,
  type RawLeadSubmission,
} from '../domain/lead-submission'
import type { LeadSubmissionResult } from './lead-view'

const SUCCESS: LeadSubmissionResult = { success: true }

/**
 * Recebe o formulário da LP (SDD § C-11 e § "Endpoints públicos").
 *
 * São dois passos, e a ordem entre eles é regra de negócio:
 *
 * 1. **Honeypot antes de tudo.** Robô recebe sucesso; nada é gravado. A
 *    checagem vem antes da validação porque era assim no relay serverless que
 *    esta classe substituiu — um robô que preenche o campo invisível e erra o
 *    e-mail continua vendo sucesso, e não um erro que lhe ensina o formulário.
 * 2. **Gravar.** Se a gravação falhar, o visitante vê erro, e é assim que tem
 *    de ser: desde que o repasse a sistema externo foi descontinuado
 *    (2026-09-03), o banco do CMS é o **único** lugar onde o lead existe. Não há
 *    mais um segundo destino para reconciliar depois, então engolir a falha aqui
 *    — responder sucesso a um lead que não foi gravado — perderia o dado em
 *    silêncio. Nenhum `catch` envolve `record`: a exceção sobe até o filtro
 *    global, que responde `500`, e o visitante reenvia.
 */
@Injectable()
export class SubmitLeadUseCase {
  constructor(@Inject(LEAD_INTAKE) private readonly intake: LeadIntake) {}

  async execute(raw: RawLeadSubmission): Promise<LeadSubmissionResult> {
    if (isHoneypotTriggered(raw.website)) {
      return SUCCESS
    }

    const submission = toLeadSubmission(raw)
    await this.intake.record({ ...submission, id: randomUUID() })
    return SUCCESS
  }
}
