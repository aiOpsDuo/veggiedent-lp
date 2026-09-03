import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import { LoginScreen } from '../screens/LoginScreen'
import { SessionCheck } from '../screens/SessionCheck'
import { HOME_PATH } from './paths'

interface LoginLocationState {
  readonly from?: string
}

/**
 * A rota de login. Quem já tem sessão não volta a ver o formulário: é devolvido
 * ao caminho que tentou abrir, ou ao início quando chegou direto no login.
 */
export function LoginRoute(): JSX.Element {
  const { state } = useAuth()
  const location = useLocation()

  if (state.status === 'verificando') {
    return <SessionCheck />
  }

  if (state.status === 'ativa') {
    const origin = (location.state as LoginLocationState | null)?.from
    return <Navigate to={origin ?? HOME_PATH} replace />
  }

  return <LoginScreen />
}
