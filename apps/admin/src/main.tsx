import React from 'react'
import ReactDOM from 'react-dom/client'
import { AdminApiClient } from './api/admin-api-client'
import { App } from './App'
import { createApiAuthGateway } from './auth/api-auth-gateway'
import { readEnvironment } from './config/env'
import './index.css'

/** Caminho em que o painel é servido, o mesmo `base` do `vite.config.ts`. */
const ADMIN_BASENAME = '/admin'

const container = document.getElementById('root') as HTMLElement

/**
 * Um erro de ambiente vira uma mensagem legível em vez de página em branco.
 *
 * `readEnvironment` não tem hoje nenhuma variável obrigatória (SDD § D-03: o
 * painel só fala com a própria API, `apiBaseUrl` sempre tem um valor por
 * padrão), então este caminho não deveria disparar na prática — fica como
 * rede de segurança para uma variável obrigatória que venha a existir no
 * futuro, em vez de uma página em branco sem explicação.
 */
function renderConfigurationError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error)
  container.textContent = `Painel não configurado. ${message}`
}

try {
  const environment = readEnvironment(import.meta.env)
  ReactDOM.createRoot(container).render(
    <React.StrictMode>
      <App
        authGateway={createApiAuthGateway(environment)}
        apiClient={new AdminApiClient(environment.apiBaseUrl)}
        basename={ADMIN_BASENAME}
      />
    </React.StrictMode>,
  )
} catch (error) {
  renderConfigurationError(error)
}
