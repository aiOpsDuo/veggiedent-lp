import type { OperatorCredentials, OperatorSession } from './operator-session'

/**
 * Por que a recusa do login tem só dois motivos.
 *
 * `credenciais-invalidas` cobre **toda** recusa do provedor de identidade: senha
 * errada, e-mail inexistente, usuário não confirmado, conta desativada. Separá-los
 * daria ao visitante da tela de login um oráculo de e-mails cadastrados, que é
 * justamente o que o SDD § C-02 proíbe. `indisponivel` é o caso em que ninguém
 * chegou a julgar as credenciais — a rede falhou —, e aí dizer "e-mail ou senha
 * inválidos" seria mentira, não discrição.
 */
export type SignInRejection = 'credenciais-invalidas' | 'indisponivel'

export type SignInResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly rejection: SignInRejection }

/** Cancela a observação da sessão. */
export type Unsubscribe = () => void

/**
 * Porta de autenticação (mesma inversão de dependência que a API aplica em
 * `TokenVerifier`): o painel declara o que precisa — entrar, sair e ser avisado
 * de quem está logado — sem saber que quem responde é o Supabase Auth.
 *
 * É o que mantém os testes fora da rede: o dublê entra aqui, e o provedor, a
 * guarda e as telas exercitadas são os de verdade.
 */
export interface AuthGateway {
  /**
   * Observa a sessão corrente. O primeiro aviso é **obrigatório** e vem assim
   * que possível, com a sessão recuperada do armazenamento ou com `null` — é
   * ele que tira o painel do estado "verificando" e, portanto, o que impede
   * tanto o piscar de tela protegida quanto a expulsão de quem está logado.
   */
  observeSession(listener: (session: OperatorSession | null) => void): Unsubscribe
  signIn(credentials: OperatorCredentials): Promise<SignInResult>
  signOut(): Promise<void>
}
