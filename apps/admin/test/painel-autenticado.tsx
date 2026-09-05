import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { RouterProvider, createMemoryRouter, type RouteObject } from 'react-router-dom'
import { AuthProvider } from '../src/auth/AuthProvider'
import type { AuthGateway } from '../src/auth/auth-gateway'
import { MediaServiceProvider } from '../src/media/media-context'
import type { MediaService } from '../src/media/media-service'

/**
 * Monta uma tela do painel com um operador já logado.
 *
 * O que está sob teste aqui é o formulário, não a autenticação — a guarda de
 * rota e o login têm testes próprios em `src/App.test.tsx`. Este dublê existe
 * só para que a tela receba um token, que é a única coisa que ela pede à sessão.
 *
 * Usa um roteador de dados (`createMemoryRouter`), e não `<MemoryRouter>` como
 * antes: é o que `UnsavedChangesGuard` (`useBlocker`, T30-d) exige do React
 * Router para funcionar — e como ele é montado dentro da própria tela, um
 * teste que a monta fora de um roteador de dados quebraria com o erro do
 * React Router, não com uma falha de asserção.
 */

export const TOKEN_DO_OPERADOR = 'token-do-operador'

const OPERADORA = {
  operatorId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  operatorEmail: 'operadora@veggiedent.test',
  accessToken: TOKEN_DO_OPERADOR,
}

const SESSAO_ATIVA: AuthGateway = {
  observeSession: (listener) => {
    listener(OPERADORA)
    return () => undefined
  },
  signIn: async () => ({ ok: true }),
  signOut: async () => undefined,
}

interface MontagemOptions {
  /** Padrão da rota que renderiza a tela, quando ela lê parâmetros do caminho. */
  readonly routePattern?: string
  readonly initialPath?: string
  /** Envio de mídia. Sem ele os campos de mídia desenham, mas não enviam. */
  readonly mediaService?: MediaService
  /**
   * Rotas adicionais, registradas ao lado da rota da tela — o que um teste de
   * navegação (ex.: `UnsavedChangesGuard`) precisa para ter para onde navegar.
   */
  readonly extraRoutes?: readonly RouteObject[]
}

export function montarTela(tela: ReactNode, options: MontagemOptions = {}): void {
  const {
    routePattern = '*',
    initialPath = '/',
    mediaService = null,
    extraRoutes = [],
  } = options

  const router = createMemoryRouter([{ path: routePattern, element: tela }, ...extraRoutes], {
    initialEntries: [initialPath],
  })

  render(
    <AuthProvider gateway={SESSAO_ATIVA}>
      <MediaServiceProvider service={mediaService}>
        <RouterProvider router={router} />
      </MediaServiceProvider>
    </AuthProvider>,
  )
}
