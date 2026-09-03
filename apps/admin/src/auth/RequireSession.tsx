import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './auth-context'
import { SessionCheck } from '../screens/SessionCheck'
import { LOGIN_PATH } from '../routing/paths'

/**
 * A guarda de rota do painel (SDD § D-04 e § C-01).
 *
 * Nada administrativo é renderizado antes de a sessão ser confirmada. As duas
 * saídas que não são `Outlet` existem por motivos diferentes e nenhuma delas
 * pode ser removida: sem a de `verificando` o painel piscaria conteúdo
 * protegido no instante entre a montagem e a leitura do armazenamento; sem a de
 * `ausente` ele o renderizaria para quem não tem sessão nenhuma.
 *
 * O caminho de origem viaja no estado da navegação para que o login devolva o
 * operador onde ele estava tentando entrar.
 */
export function RequireSession(): JSX.Element {
  const { state } = useAuth()
  const location = useLocation()

  if (state.status === 'verificando') {
    return <SessionCheck />
  }

  if (state.status === 'ausente') {
    return <Navigate to={LOGIN_PATH} replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
