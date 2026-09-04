import type { NewLead } from './lead'

/** Token de injeção da porta. O domínio declara; a infraestrutura implementa. */
export const LEAD_INTAKE = Symbol('LeadIntake')

/**
 * A gravação do lead que chega do formulário — e só ela.
 *
 * Está separada de `LeadRepository` de propósito (ISP). Esta é a porta do
 * caminho **público**: quem a injeta é o caso de uso que qualquer visitante da
 * internet alcança. Uma porta única obrigaria esse caso de uso a carregar
 * também `list`, `findById` e `delete`, capacidades que ele nunca usa e que
 * ninguém deveria alcançar sem token.
 *
 * `record` é o **único** destino do lead. O repasse a sistema externo de
 * marketing foi descontinuado em 2026-09-03 e não há mais cópia em lugar nenhum:
 * o que esta porta não gravar está perdido, e é por isso que uma falha dela
 * precisa chegar ao visitante como erro (SDD § C-11).
 */
export interface LeadIntake {
  record(lead: NewLead): Promise<void>
}
