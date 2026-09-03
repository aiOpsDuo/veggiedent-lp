import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AuthContext, type AuthState, type AuthContextValue } from './auth-context'
import type { AuthGateway } from './auth-gateway'

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

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      signIn: (credentials) => gateway.signIn(credentials),
      signOut: () => gateway.signOut(),
    }),
    [state, gateway],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
