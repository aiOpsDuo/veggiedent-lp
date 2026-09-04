import type { OperatorAccount } from './operator-account'

export const OPERATOR_DIRECTORY = Symbol('OperatorDirectory')

/**
 * O link de ativação de uso único (SDD § D-09). Devolvido apenas na resposta
 * de `POST /api/admin/operators` — nenhuma outra porta o reexibe depois, e o
 * tipo não tem um `id` ou getter porque a API não guarda o convite em lugar
 * nenhum para reexibir.
 */
export interface OperatorInvite {
  readonly email: string
  readonly activationLink: string
}

/**
 * Porta para a Admin API do Supabase Auth (SDD § D-09). É a única forma de a
 * API conhecer, convidar ou remover um operador — não existe tabela de
 * operadores no banco do CMS, então não existe um "repositório" no sentido dos
 * outros módulos (mídia, metadados, leads): quem implementa esta porta fala
 * `auth.admin.*`, nunca `.from(...)`.
 */
export interface OperatorDirectory {
  listAll(): Promise<OperatorAccount[]>
  invite(email: string): Promise<OperatorInvite>
  remove(id: string): Promise<void>
}
