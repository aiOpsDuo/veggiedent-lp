/** Token de injeção da porta. O domínio declara; a infraestrutura implementa. */
export const TOKEN_ISSUER = Symbol('TokenIssuer')

/** Quem o token emitido representa — o mínimo que a assinatura precisa saber. */
export interface OperatorClaims {
  readonly id: string
  readonly email: string
}

/** O que o login devolve ao painel (SDD § "Contratos de dados/API/interfaces"). */
export interface IssuedToken {
  readonly accessToken: string
  readonly expiresInSeconds: number
}

/**
 * Porta de emissão de token (SDD § D-03).
 *
 * Espelha `TokenVerifier`, no sentido oposto: o domínio declara que precisa
 * transformar um operador autenticado em um token assinado, sem saber que a
 * assinatura é um JWT HS256 feito com `jose` — só a infraestrutura sabe disso.
 */
export interface TokenIssuer {
  issue(operator: OperatorClaims): Promise<IssuedToken>
}
