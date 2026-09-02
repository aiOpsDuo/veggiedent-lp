import { ResourceNotFoundError } from '../../../shared/domain/resource-not-found.error'

/**
 * `media_assets.id` é `uuid` (SDD § "Modelo de dados"). Um identificador fora
 * dessa forma não é um registro que sumiu: é um endereço que nunca existiu.
 *
 * A checagem acontece antes de qualquer consulta, pela mesma razão que a chave
 * de seção é conferida antes (T6): sem ela, um identificador malformado chega
 * ao Postgres e volta como erro de sintaxe de `uuid` — um `500` para o que é,
 * do lado de quem chamou, um `404`.
 */
const UUID_FORMAT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function ensureMediaId(id: string): string {
  if (!UUID_FORMAT.test(id)) {
    throw new ResourceNotFoundError(`mídia "${id}"`)
  }
  return id
}
