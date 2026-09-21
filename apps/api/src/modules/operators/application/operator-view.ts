import type { OperatorAccount } from '../domain/operator-account'

/**
 * O que a tela de operadores recebe (SDD § C-13): identidade, nome e a data
 * de criação. Nenhuma senha, nenhum metadado interno — só o que quem
 * administra precisa ver.
 *
 * `name` nunca é vazio, na mesma garantia de `OperatorAccount.name` (coluna
 * `operators.name` é `NOT NULL`, e `CreateOperatorDto.name` já exige uma
 * string não vazia na criação). Removido nesta migração: o antigo fallback
 * derivado do e-mail (`fallbackName`), que só existia para o caso do Supabase
 * Auth de um operador sem `user_metadata.name` — caso que não existe mais,
 * já que não há caminho de escrita que grave um operador sem nome. Removido
 * também `lastSignInAt` (ver `operator-account.ts`).
 */
export interface OperatorView {
  readonly id: string
  readonly email: string
  readonly name: string
  readonly createdAt: string
}

export function toOperatorView(account: OperatorAccount): OperatorView {
  return {
    id: account.id,
    email: account.email,
    name: account.name,
    createdAt: account.createdAt,
  }
}
