import type { OperatorAccount } from './operator-account'

export const OPERATOR_DIRECTORY = Symbol('OperatorDirectory')

/**
 * O que a tabela `operators` precisa para criar um operador pronto para logar
 * (SDD § D-09, revista em 2026-09-21): sem link, sem e-mail — quem cria já
 * define e-mail, senha e nome nesta mesma chamada.
 */
export interface CreateOperatorInput {
  readonly email: string
  readonly password: string
  readonly name: string
}

/**
 * Porta para a tabela `operators` do MySQL (SDD § D-09, § "Modelo de dados").
 * É a única forma de a API conhecer, criar ou remover um operador. A forma da
 * porta (`listAll`/`create`/`remove`) não muda desde a versão sobre a Admin
 * API do Supabase Auth que esta migração substitui — só quem a implementa
 * passa a falar `prisma.operator.*` em vez de `auth.admin.*`.
 */
export interface OperatorDirectory {
  listAll(): Promise<OperatorAccount[]>
  create(input: CreateOperatorInput): Promise<OperatorAccount>
  remove(id: string): Promise<void>
}
