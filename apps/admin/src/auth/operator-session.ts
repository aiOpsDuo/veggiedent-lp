/**
 * A sessão de um operador, do ponto de vista do painel.
 *
 * É o mínimo que as telas precisam: quem está logado (para o cabeçalho) e o
 * token com que a API é chamada. Nada mais do que o Supabase devolve atravessa
 * esta fronteira — o painel não conhece `refresh_token`, `provider` nem os
 * metadados do usuário, porque não faz nada com eles.
 */
export interface OperatorSession {
  readonly operatorId: string
  readonly operatorEmail: string
  readonly accessToken: string
}

/** E-mail e senha digitados na tela de login. */
export interface OperatorCredentials {
  readonly email: string
  readonly password: string
}
