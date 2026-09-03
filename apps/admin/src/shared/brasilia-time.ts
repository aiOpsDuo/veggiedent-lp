/**
 * Data e hora no fuso que o operador do painel enxerga.
 *
 * Brasília, não UTC. É a mesma decisão que o filtro de leads da API já segue
 * (SDD § C-12): o dia que o operador entende é o dele, não o do servidor.
 * Mostrar "04/09" para um lead recebido às 22h do dia 3 seria contar uma data
 * que não aconteceu para quem lê a tela.
 *
 * Fica em um lugar só para que a data da última edição de uma seção e a data de
 * recebimento de um lead nunca divirjam de fuso.
 */
const BRASILIA_TIME_ZONE = 'America/Sao_Paulo'

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: BRASILIA_TIME_ZONE,
})

/**
 * O instante ISO escrito no fuso de Brasília, ou `null` quando o texto recebido
 * não é uma data — o que a tela mostra no lugar é decisão de quem chama, porque
 * "nunca editada" e "data ilegível" não são a mesma frase em toda tela.
 */
export function formatBrasiliaDateTime(instant: string): string | null {
  const moment = new Date(instant)
  return Number.isNaN(moment.getTime()) ? null : DATE_TIME_FORMATTER.format(moment)
}
