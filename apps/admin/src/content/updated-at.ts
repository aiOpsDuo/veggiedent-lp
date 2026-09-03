/**
 * Data da última edição, no fuso que o operador entende.
 *
 * Brasília, não UTC — a mesma decisão que o filtro de leads já segue: o dia que
 * o operador enxerga é o dia dele, não o do servidor.
 */
const BRASILIA = 'America/Sao_Paulo'

const FORMATTER = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: BRASILIA,
})

export const NEVER_EDITED = 'Nunca editada'

export function formatUpdatedAt(updatedAt: string | null): string {
  if (updatedAt === null) {
    return NEVER_EDITED
  }
  const moment = new Date(updatedAt)
  return Number.isNaN(moment.getTime()) ? NEVER_EDITED : FORMATTER.format(moment)
}
