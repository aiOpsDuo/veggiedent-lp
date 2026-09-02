import type { NewLead } from './lead'
import type { RdStationOutcome } from './rdstation-outcome'

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
 * `record` e `recordRelayOutcome` são dois passos porque a ordem é regra de
 * negócio: o lead é gravado **antes** de o RD Station ser tentado, e o
 * resultado do repasse chega depois (SDD § "Endpoints públicos" e § C-11).
 */
export interface LeadIntake {
  record(lead: NewLead): Promise<void>
  recordRelayOutcome(id: string, outcome: RdStationOutcome): Promise<void>
}
