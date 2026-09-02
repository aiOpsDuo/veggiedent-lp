import type { AuthenticatedOperator } from './authenticated-operator'

/** Token de injeção da porta. O domínio declara; a infraestrutura implementa. */
export const TOKEN_VERIFIER = Symbol('TokenVerifier')

/**
 * Porta de verificação de token (SDD § "Visão de layers dentro da API").
 *
 * O domínio declara o que precisa — provar quem assinou o token e quem ele
 * representa — sem saber que a prova vem de um JWKS, de um JWT ou do Supabase.
 * Toda implementação recusa lançando `InvalidTokenError`; nenhum erro de
 * biblioteca atravessa esta fronteira.
 */
export interface TokenVerifier {
  verify(token: string): Promise<AuthenticatedOperator>
}
