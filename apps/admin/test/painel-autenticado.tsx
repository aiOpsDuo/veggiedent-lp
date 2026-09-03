import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
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
}

export function montarTela(tela: ReactNode, options: MontagemOptions = {}): void {
  const { routePattern = '*', initialPath = '/', mediaService = null } = options
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider gateway={SESSAO_ATIVA}>
        <MediaServiceProvider service={mediaService}>
          <Routes>
            <Route path={routePattern} element={tela} />
          </Routes>
        </MediaServiceProvider>
      </AuthProvider>
    </MemoryRouter>,
  )
}
