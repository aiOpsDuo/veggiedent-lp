/**
 * Quem está por trás de uma requisição autenticada. É o mínimo que a API
 * precisa saber sobre o operador: identidade e e-mail, ambos vindos do token.
 * A gestão completa da conta (listar/criar/remover) vive no módulo
 * `operators`, sobre a tabela `operators` do MySQL (SDD § D-03/D-09).
 */
export interface AuthenticatedOperator {
  readonly id: string
  readonly email?: string
}
