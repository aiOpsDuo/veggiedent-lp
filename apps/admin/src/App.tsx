import { Navigate, Route, Routes } from 'react-router-dom'
import type { AdminApiClient } from './api/admin-api-client'
import { AuthProvider } from './auth/AuthProvider'
import type { AuthGateway } from './auth/auth-gateway'
import { RequireSession } from './auth/RequireSession'
import { LoginRoute } from './routing/LoginRoute'
import { HOME_PATH, LOGIN_PATH } from './routing/paths'
import { AdminLayout } from './screens/AdminLayout'
import { HomeScreen } from './screens/HomeScreen'

interface AppProps {
  readonly authGateway: AuthGateway
  readonly apiClient: AdminApiClient
}

/**
 * O painel inteiro, com uma única rota pública: a de login.
 *
 * A guarda é uma rota de layout, e não um invólucro repetido em cada tela. É a
 * mesma ideia da guarda global da API (SDD § D-03): proteger não exige lembrar
 * de nada, porque toda rota nova nasce dentro dela; expor exigiria declarar a
 * rota fora da guarda, de propósito.
 *
 * Recebe o gateway e o cliente da API prontos para que o teste monte o painel de
 * verdade com dublês no lugar da rede.
 */
export function App({ authGateway, apiClient }: AppProps): JSX.Element {
  return (
    <AuthProvider gateway={authGateway}>
      <Routes>
        <Route path={LOGIN_PATH} element={<LoginRoute />} />
        <Route element={<RequireSession />}>
          <Route element={<AdminLayout />}>
            <Route path={HOME_PATH} element={<HomeScreen apiClient={apiClient} />} />
            <Route path="*" element={<Navigate to={HOME_PATH} replace />} />
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  )
}
