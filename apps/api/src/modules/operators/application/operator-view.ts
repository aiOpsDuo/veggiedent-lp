import type { OperatorAccount } from '../domain/operator-account'

/**
 * O que a tela de operadores recebe (SDD § C-13): identidade, nome e as duas
 * datas que ajudam a reconhecer uma conta na lista. Nenhuma senha, nenhum
 * metadado interno do Supabase — só o que quem administra precisa ver.
 *
 * Diferente de `OperatorAccount.name`, este `name` nunca é vazio: um operador
 * sem nome em `user_metadata` (SDD § D-09 — o operador original, criado antes
 * deste campo existir) recebe o nome derivado do e-mail em `fallbackName`.
 */
export interface OperatorView {
  readonly id: string
  readonly email: string
  readonly name: string
  readonly createdAt: string
  readonly lastSignInAt: string | null
}

const NAME_SEPARATORS = /[._-]+/

/**
 * Deriva um nome legível da parte local do e-mail (antes do `@`) — o fallback
 * sensato para um operador sem `user_metadata.name` (SDD § D-09). Um e-mail
 * sem parte local reconhecível (ex.: vazio) devolve o próprio e-mail: melhor
 * mostrar algo identificável do que uma string vazia.
 */
export function fallbackName(email: string): string {
  const localPart = email.split('@')[0] ?? ''
  const words = localPart.split(NAME_SEPARATORS).filter((word) => word.length > 0)
  if (words.length === 0) {
    return email
  }
  return words.map((word) => word[0]?.toUpperCase() + word.slice(1)).join(' ')
}

export function toOperatorView(account: OperatorAccount): OperatorView {
  return {
    id: account.id,
    email: account.email,
    name: account.name !== null && account.name.trim().length > 0
      ? account.name
      : fallbackName(account.email),
    createdAt: account.createdAt,
    lastSignInAt: account.lastSignInAt,
  }
}
