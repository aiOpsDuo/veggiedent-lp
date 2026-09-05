import type { OperatorAccount } from './operator-account'

export const OPERATOR_DIRECTORY = Symbol('OperatorDirectory')

/**
 * O que a Admin API do Supabase precisa para criar um operador pronto para
 * logar (SDD § D-09, revista na T34): sem link, sem e-mail — quem cria já
 * define e-mail, senha e nome nesta mesma chamada.
 */
export interface CreateOperatorInput {
  readonly email: string
  readonly password: string
  readonly name: string
}

/**
 * Porta para a Admin API do Supabase Auth (SDD § D-09). É a única forma de a
 * API conhecer, criar ou remover um operador — não existe tabela de
 * operadores no banco do CMS, então não existe um "repositório" no sentido dos
 * outros módulos (mídia, metadados, leads): quem implementa esta porta fala
 * `auth.admin.*`, nunca `.from(...)`.
 */
export interface OperatorDirectory {
  listAll(): Promise<OperatorAccount[]>
  create(input: CreateOperatorInput): Promise<OperatorAccount>
  remove(id: string): Promise<void>
}
