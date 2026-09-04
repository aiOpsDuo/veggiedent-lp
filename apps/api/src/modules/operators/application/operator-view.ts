import type { OperatorAccount } from '../domain/operator-account'

/**
 * O que a tela de operadores recebe (SDD § C-13): identidade e as duas datas
 * que ajudam a reconhecer uma conta na lista. Nenhuma senha, nenhum metadado
 * interno do Supabase — só o que o operador convidando precisa ver.
 */
export interface OperatorView {
  readonly id: string
  readonly email: string
  readonly createdAt: string
  readonly lastSignInAt: string | null
}

export function toOperatorView(account: OperatorAccount): OperatorView {
  return {
    id: account.id,
    email: account.email,
    createdAt: account.createdAt,
    lastSignInAt: account.lastSignInAt,
  }
}
