/**
 * Quem está por trás de uma requisição autenticada. É o mínimo que a API
 * precisa saber sobre o operador: identidade e e-mail, ambos vindos do token.
 * A API não guarda usuários — a gestão deles vive no Supabase Auth (SDD § D-03).
 */
export interface AuthenticatedOperator {
  readonly id: string
  readonly email?: string
}
