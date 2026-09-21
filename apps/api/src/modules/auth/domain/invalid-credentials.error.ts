/**
 * Recusa de um login, com o motivo em texto fixo.
 *
 * Mesma disciplina de `InvalidTokenError`: o motivo existe só para o log do
 * servidor, nunca para a resposta ao cliente. Aqui a exigência é ainda mais
 * direta (SDD § C-02, "não revelar se o e-mail existe"): e-mail inexistente e
 * senha incorreta usam o **mesmo** tipo de erro e a mesma resposta HTTP —
 * `presentation/auth.controller.ts` nunca inspeciona `reason` para decidir o
 * que devolver, só para decidir o que logar.
 */
export const CREDENTIALS_REJECTION_REASONS = {
  emailNaoEncontrado: 'e-mail não cadastrado',
  senhaIncorreta: 'senha incorreta',
} as const

export type CredentialsRejectionReason =
  (typeof CREDENTIALS_REJECTION_REASONS)[keyof typeof CREDENTIALS_REJECTION_REASONS]

export class InvalidCredentialsError extends Error {
  readonly reason: CredentialsRejectionReason

  constructor(reason: CredentialsRejectionReason) {
    super(reason)
    this.name = 'InvalidCredentialsError'
    this.reason = reason
  }
}
