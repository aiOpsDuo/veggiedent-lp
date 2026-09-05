import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AuthContext, type AuthState, type AuthContextValue } from './auth-context'
import type { AuthGateway } from './auth-gateway'
import type { OperatorCredentials } from './operator-session'

interface AuthProviderProps {
  readonly gateway: AuthGateway
  readonly children: ReactNode
}

/**
 * Mantém o estado da sessão a partir de uma única fonte: o que o gateway avisa.
 *
 * Nem o login nem o logout escrevem o estado por conta própria — os dois só
 * pedem a ação e esperam o aviso. É o que garante que uma sessão renovada, uma
 * expirada ou uma encerrada em outra aba cheguem pelo mesmo caminho, em vez de
 * o painel manter uma cópia que pode divergir da real.
 */
export function AuthProvider({ gateway, children }: AuthProviderProps): JSX.Element {
  const [state, setState] = useState<AuthState>({ status: 'verificando' })

  useEffect(
    () =>
      gateway.observeSession((session) => {
        setState(session === null ? { status: 'ausente' } : { status: 'ativa', session })
      }),
    [gateway],
  )

  /**
   * As duas ações vivem em `useCallback`, presas só ao `gateway`, para que a
   * identidade delas não mude a cada transição de `state`.
   */
  const signIn = useCallback(
    (credentials: OperatorCredentials) => gateway.signIn(credentials),
    [gateway],
  )
  const signOut = useCallback(() => gateway.signOut(), [gateway])

  const value = useMemo<AuthContextValue>(
    () => ({ state, signIn, signOut }),
    [state, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
