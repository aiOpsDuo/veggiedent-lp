/**
 * A porta pela qual o painel alcança as rotas de operadores da API
 * (SDD § D-09, § C-13). Como nas seções, na mídia e nos metadados, a tela
 * depende desta interface e nunca da classe que fala HTTP.
 */

/** Um operador do painel, como a API o lista. */
export interface OperatorView {
  readonly id: string
  readonly email: string
  readonly name: string
  readonly createdAt: string
  readonly lastSignInAt: string | null
}

export type OperatorsListResult =
  | { readonly status: 'ok'; readonly value: readonly OperatorView[] }
  | { readonly status: 'falha'; readonly message: string }

/**
 * O que a tela pede para criar um operador (SDD § D-09, revista na T34): a
 * conta nasce pronta para logar com estes três campos, sem link nem e-mail.
 */
export interface OperatorCreateInput {
  readonly email: string
  readonly password: string
  readonly name: string
}

/**
 * `invalido` é o `422` de campo malformado (e-mail, senha curta, nome
 * ausente); `falha` é qualquer outra recusa (rede fora do ar, `500`). A
 * distinção é a mesma dos outros formulários administrativos: erro de campo
 * pertence ao campo, o resto vira mensagem geral.
 */
export type OperatorCreateResult =
  | { readonly status: 'criado'; readonly value: OperatorView }
  | { readonly status: 'invalido'; readonly message: string }
  | { readonly status: 'falha'; readonly message: string }

/**
 * `recusado` é o `409` das duas guardas de R-10 (remover a si mesmo, remover
 * o último operador) — a tela já tenta evitar chegar aqui desabilitando o
 * botão nesses dois casos, mas a API é quem de fato decide.
 */
export type OperatorRemoveResult =
  | { readonly status: 'removido' }
  | { readonly status: 'recusado'; readonly message: string }
  | { readonly status: 'falha'; readonly message: string }

export interface OperatorsGateway {
  listOperators(accessToken: string): Promise<OperatorsListResult>
  createOperator(accessToken: string, input: OperatorCreateInput): Promise<OperatorCreateResult>
  removeOperator(accessToken: string, id: string): Promise<OperatorRemoveResult>
}
