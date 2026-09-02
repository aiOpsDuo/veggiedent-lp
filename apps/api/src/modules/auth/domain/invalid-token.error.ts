/**
 * Recusa de um token, com o motivo em texto fixo.
 *
 * O motivo existe para o log do servidor e é sempre uma das frases declaradas
 * abaixo — nunca a mensagem do verificador, nunca o token, nunca um claim.
 * O cliente jamais o vê: a guarda responde apenas `401` no formato único de
 * erro, para não transformar a resposta em oráculo de tokens válidos.
 */
export const TOKEN_REJECTION_REASONS = {
  ausente: 'token ausente na requisição',
  expirado: 'token expirado',
  assinaturaInvalida: 'assinatura não confere com nenhuma chave do JWKS',
  chaveDesconhecida: 'nenhuma chave do JWKS corresponde ao token',
  algoritmoNaoAceito: 'algoritmo de assinatura fora do conjunto aceito',
  malformado: 'token malformado',
  claimInvalido: 'claim obrigatório ausente ou fora do esperado',
  jwksIndisponivel: 'JWKS não pôde ser consultado',
  desconhecido: 'token recusado pelo verificador',
} as const

export type TokenRejectionReason =
  (typeof TOKEN_REJECTION_REASONS)[keyof typeof TOKEN_REJECTION_REASONS]

export class InvalidTokenError extends Error {
  readonly reason: TokenRejectionReason

  constructor(reason: TokenRejectionReason) {
    super(reason)
    this.name = 'InvalidTokenError'
    this.reason = reason
  }
}
