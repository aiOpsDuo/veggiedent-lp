import { useMemo } from 'react'
import {
  Navigate,
  Outlet,
  Route,
  RouterProvider,
  createBrowserRouter,
  createMemoryRouter,
  createRoutesFromElements,
} from 'react-router-dom'
import type { AdminApiClient } from './api/admin-api-client'
import { AuthProvider } from './auth/AuthProvider'
import type { AuthGateway } from './auth/auth-gateway'
import { RequireSession } from './auth/RequireSession'
import { SectionEditorScreen } from './content/SectionEditorScreen'
import { SectionsScreen } from './content/SectionsScreen'
import { DashboardScreen } from './dashboard/DashboardScreen'
import { LeadsScreen } from './leads/LeadsScreen'
import { ApiMediaProvider } from './media/media-context'
import { MultiImageFieldHarnessScreen } from './media/MultiImageFieldHarnessScreen'
import { MetadataScreen } from './metadata/MetadataScreen'
import { OperatorsScreen } from './operators/OperatorsScreen'
import { LoginRoute } from './routing/LoginRoute'
import {
  HOME_PATH,
  LEADS_PATH,
  LOGIN_PATH,
  METADATA_PATH,
  MULTI_IMAGE_HARNESS_PATH,
  OPERATORS_PATH,
  SECTIONS_PATH,
  SECTION_EDITOR_ROUTE,
} from './routing/paths'
import { AdminLayout } from './screens/AdminLayout'
import { ThemeProvider } from './theme/theme-context'

interface AppProps {
  readonly authGateway: AuthGateway
  readonly apiClient: AdminApiClient
  /** O prefixo em que o navegador de verdade serve o painel (ver `main.tsx`). */
  readonly basename?: string
  /**
   * Só para teste: entradas de um roteador em memória, no lugar do navegador
   * de verdade. Presente aqui (e não escondida em `main.tsx`) para que o
   * mesmo `App` monte tanto a aplicação real quanto a suíte de testes — sem
   * isso, o bloqueio de navegação de `UnsavedChangesGuard` (`useBlocker`)
   * exigiria um roteador de dados que só existiria em produção, e a suíte não
   * conseguiria exercitá-lo.
   */
  readonly initialEntries?: readonly string[]
}

interface AppShellProps {
  readonly authGateway: AuthGateway
  readonly apiClient: AdminApiClient
}

/**
 * A raiz de toda rota: quem dá a sessão e o cliente da API a tudo que vem
 * abaixo. Existe como rota de layout — e não como o invólucro de `App` — para
 * que `authGateway`/`apiClient` continuem vindo de fora por prop, e não por um
 * módulo global, mesmo com as rotas descritas fora do corpo do componente.
 */
function AppShell({ authGateway, apiClient }: AppShellProps): JSX.Element {
  return (
    <ThemeProvider>
      <AuthProvider gateway={authGateway}>
        <ApiMediaProvider gateway={apiClient}>
          <Outlet />
        </ApiMediaProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

/**
 * O painel inteiro, com uma única rota pública: o login.
 *
 * A guarda é uma rota de layout, e não um invólucro repetido em cada tela. É a
 * mesma ideia da guarda global da API (SDD § D-03): proteger não exige lembrar
 * de nada, porque toda rota nova nasce dentro dela; expor exigiria declarar a
 * rota fora da guarda, de propósito.
 *
 * `/` (`HOME_PATH`) é o painel de início (T35, item 10) — diferente da tela
 * "Início" que a T30-c removeu por só repetir os links do menu lateral: esta
 * mostra dado de verdade (leads recentes, seção despublicada) e atalhos, não
 * uma segunda navegação.
 *
 * Usa um roteador de dados (`createBrowserRouter`/`createMemoryRouter`), e não
 * `<BrowserRouter>`/`<Routes>` como antes: é o que `UnsavedChangesGuard`
 * (`useBlocker`, T30-d) exige do React Router para interceptar uma navegação
 * antes dela acontecer. Em teste, passar `initialEntries` troca o roteador do
 * navegador por um em memória, sem duplicar a árvore de rotas.
 */
export function App({ authGateway, apiClient, basename, initialEntries }: AppProps): JSX.Element {
  const router = useMemo(() => {
    const routes = createRoutesFromElements(
      <Route element={<AppShell authGateway={authGateway} apiClient={apiClient} />}>
        <Route path={LOGIN_PATH} element={<LoginRoute />} />
        <Route element={<RequireSession />}>
          <Route element={<AdminLayout apiClient={apiClient} />}>
            <Route path={HOME_PATH} element={<DashboardScreen gateway={apiClient} />} />
            <Route path={SECTIONS_PATH} element={<SectionsScreen gateway={apiClient} />} />
            <Route
              path={SECTION_EDITOR_ROUTE}
              element={<SectionEditorScreen gateway={apiClient} />}
            />
            <Route path={METADATA_PATH} element={<MetadataScreen gateway={apiClient} />} />
            <Route path={LEADS_PATH} element={<LeadsScreen gateway={apiClient} />} />
            <Route path={OPERATORS_PATH} element={<OperatorsScreen gateway={apiClient} />} />
            <Route path={MULTI_IMAGE_HARNESS_PATH} element={<MultiImageFieldHarnessScreen />} />
            <Route path="*" element={<Navigate to={SECTIONS_PATH} replace />} />
          </Route>
        </Route>
      </Route>,
    )
    return initialEntries !== undefined
      ? createMemoryRouter(routes, { initialEntries: [...initialEntries] })
      : createBrowserRouter(routes, { basename })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initialEntries só varia entre testes, nunca dentro da vida de uma instância montada
  }, [authGateway, apiClient, basename])

  return <RouterProvider router={router} />
}
