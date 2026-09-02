import { ResourceNotFoundError } from '../../../shared/domain/resource-not-found.error'

/**
 * `leads.id` é `uuid`. Um identificador fora dessa forma não é um lead que
 * sumiu: é um endereço que nunca existiu — e a checagem acontece antes da
 * consulta para que ele responda `404`, e não o erro de sintaxe de `uuid` que o
 * Postgres devolveria, virando `500`. Mesma regra já usada pela mídia na T7.
 */
const UUID_FORMAT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function ensureLeadId(id: string): string {
  if (!UUID_FORMAT.test(id)) {
    throw new ResourceNotFoundError(`lead "${id}"`)
  }
  return id
}
