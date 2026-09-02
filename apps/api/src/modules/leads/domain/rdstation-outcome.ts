/**
 * O resultado do repasse do lead ao RD Station, como a tabela o guarda
 * (SDD § "Modelo de dados" — `leads.rdstation_status` e `rdstation_error`).
 *
 * O tipo existe para tornar impossível de escrever o estado que a migração
 * proíbe: `rdstation_error` é nulo quando o repasse deu certo. As três funções
 * abaixo são as únicas formas de construir um resultado, e nenhuma delas
 * produz `ok` com mensagem de erro (G27 — estrutura em vez de convenção).
 */

export const RDSTATION_STATUSES = ['ok', 'falhou', 'nao_enviado'] as const

export type RdStationStatus = (typeof RDSTATION_STATUSES)[number]

export interface RdStationOutcome {
  readonly status: RdStationStatus
  /** Sempre nulo quando `status` é `ok`. */
  readonly error: string | null
}

/** O RD Station aceitou a conversão. */
export function relayAccepted(): RdStationOutcome {
  return { status: 'ok', error: null }
}

/** A tentativa aconteceu e falhou — recusa do RD Station ou erro de rede. */
export function relayFailed(error: string): RdStationOutcome {
  return { status: 'falhou', error }
}

/**
 * Nem se tentou. Hoje o caso real é a credencial ausente: `RDSTATION_API_TOKEN`
 * e `RDSTATION_CONVERSION_IDENTIFIER` estão vazios enquanto a Virbac não
 * confirma a configuração da conta (SDD § R-08). O lead é gravado do mesmo
 * jeito, e a razão fica registrada na linha.
 */
export function relayNotAttempted(reason: string): RdStationOutcome {
  return { status: 'nao_enviado', error: reason }
}
