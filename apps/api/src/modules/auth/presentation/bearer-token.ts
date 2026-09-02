const BEARER_SCHEME = 'bearer'
const AUTHORIZATION_PARTS = 2

/**
 * Extrai o token de `Authorization: Bearer <token>`.
 *
 * Devolve `undefined` para qualquer coisa fora desse formato — outro esquema,
 * partes a mais, partes a menos — em vez de tentar adivinhar o que o cliente
 * quis dizer. É pura: não conhece Express nem NestJS.
 */
export function extractBearerToken(header: unknown): string | undefined {
  if (typeof header !== 'string') {
    return undefined
  }

  const parts = header.split(' ')
  if (parts.length !== AUTHORIZATION_PARTS) {
    return undefined
  }

  const [scheme, token] = parts
  if (scheme.toLowerCase() !== BEARER_SCHEME || token.length === 0) {
    return undefined
  }

  return token
}
