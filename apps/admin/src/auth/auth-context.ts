import { createContext, useContext } from 'react'
import type {
  ActivationResult,
  ActivationTokens,
  PasswordUpdateResult,
  SignInResult,
} from './auth-gateway'
import type { OperatorCredentials, OperatorSession } from './operator-session'

/**
 * Os três estados possíveis da sessão, e por que `verificando` é um deles.
 *
 * Recuperar a sessão do armazenamento é assíncrono. Sem um estado próprio para
 * esse intervalo, o painel teria de escolher entre tratar "ainda não sei" como
 * "não tem sessão" — expulsando quem acabou de recarregar a página — ou como
 * "tem" — e aí piscaria tela administrativa antes de descobrir que não tinha,
 * que é a falha do critério C-01. Com o terceiro estado não há nada a escolher.
 */
export type AuthState =
  | { readonly status: 'verificando' }
  | { readonly status: 'ausente' }
  | { readonly status: 'ativa'; readonly session: OperatorSession }

export interface AuthContextValue {
  readonly state: AuthState
  signIn(credentials: OperatorCredentials): Promise<SignInResult>
  signOut(): Promise<void>
  activate(tokens: ActivationTokens): Promise<ActivationResult>
  setPassword(password: string): Promise<PasswordUpdateResult>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

/** Acesso à sessão. Fora do provedor é erro de montagem, não estado válido. */
export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (value === null) {
    throw new Error('useAuth precisa de um AuthProvider acima na árvore.')
  }
  return value
}
