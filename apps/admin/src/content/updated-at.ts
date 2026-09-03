import { formatBrasiliaDateTime } from '../shared/brasilia-time'

/** Data da última edição de uma seção, no fuso que o operador entende. */
export const NEVER_EDITED = 'Nunca editada'

export function formatUpdatedAt(updatedAt: string | null): string {
  if (updatedAt === null) {
    return NEVER_EDITED
  }
  return formatBrasiliaDateTime(updatedAt) ?? NEVER_EDITED
}
