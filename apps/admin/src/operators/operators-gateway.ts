/**
 * A porta pela qual o painel alcança as rotas de operadores da API
 * (SDD § D-09, § C-13). Como nas seções, na mídia e nos metadados, a tela
 * depende desta interface e nunca da classe que fala HTTP.
 */

/** Um operador do painel, como a API o lista. */
export interface OperatorView {
  readonly id: string
  readonly email: string
  readonly createdAt: string
  readonly lastSignInAt: string | null
}

export type OperatorsListResult =
  | { readonly status: 'ok'; readonly value: readonly OperatorView[] }
  | { readonly status: 'falha'; readonly message: string }

/**
 * O link de ativação de uso único (SDD § D-09). É o que `POST` devolve — e só
 * nesta resposta: a tela nunca o pede de volta nem o guarda além da sessão de
 * quem convidou.
 */
export interface OperatorInvite {
  readonly email: string
  readonly activationLink: string
}

/**
 * `invalido` é o `422` de e-mail malformado; `falha` é qualquer outra recusa
 * (rede fora do ar, `500`). A distinção é a mesma dos outros formulários
 * administrativos: erro de campo pertence ao campo, o resto vira mensagem geral.
 */
export type OperatorInviteResult =
  | { readonly status: 'convidado'; readonly value: OperatorInvite }
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
  inviteOperator(accessToken: string, email: string): Promise<OperatorInviteResult>
  removeOperator(accessToken: string, id: string): Promise<OperatorRemoveResult>
}
