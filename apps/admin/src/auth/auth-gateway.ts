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

/** Os dois tokens que o link de convite entrega no fragmento da URL. */
export interface ActivationTokens {
  readonly accessToken: string
  readonly refreshToken: string
}

/**
 * `link-invalido` cobre todo motivo pelo qual o Supabase recusa os tokens do
 * fragmento — expirado, já usado, malformado. Não há como (nem por que)
 * distinguir esses casos para quem só está tentando ativar a própria conta.
 */
export type ActivationRejection = 'link-invalido'

export type ActivationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly rejection: ActivationRejection }

/** `indisponivel` é a única recusa possível para quem já está autenticado. */
export type PasswordUpdateRejection = 'indisponivel'

export type PasswordUpdateResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly rejection: PasswordUpdateRejection }

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

  /**
   * Estabelece a sessão a partir dos tokens que o link de convite entrega no
   * fragmento da URL (SDD § D-09) — a contraparte, do lado do convidado, de
   * `SupabaseOperatorDirectory.invite` na API. Sucesso aqui já deixa a sessão
   * `ativa` (o mesmo aviso de `observeSession` dispara), e é o que permite à
   * tela de ativação levar o convidado ao painel sem pedir login de novo.
   */
  activate(tokens: ActivationTokens): Promise<ActivationResult>

  /**
   * Define a senha do operador **já autenticado** pela sessão que `activate`
   * estabeleceu. Não é uma segunda forma de entrar — é o mesmo Supabase Auth,
   * completando a jornada que o convite começou.
   */
  setPassword(password: string): Promise<PasswordUpdateResult>
}
