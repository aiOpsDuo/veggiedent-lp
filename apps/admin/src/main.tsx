import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AdminApiClient } from './api/admin-api-client'
import { App } from './App'
import { createSupabaseAuthGateway } from './auth/supabase-auth-gateway'
import { readEnvironment } from './config/env'
import './index.css'

/** Caminho em que o painel é servido, o mesmo `base` do `vite.config.ts`. */
const ADMIN_BASENAME = '/admin'

const container = document.getElementById('root') as HTMLElement

/**
 * Um erro de ambiente vira uma mensagem legível em vez de página em branco:
 * sem as variáveis do Supabase não existe login possível, e quem está subindo o
 * painel precisa saber qual variável falta.
 */
function renderConfigurationError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error)
  container.textContent = `Painel não configurado. ${message}`
}

try {
  const environment = readEnvironment(import.meta.env)
  ReactDOM.createRoot(container).render(
    <React.StrictMode>
      <BrowserRouter basename={ADMIN_BASENAME}>
        <App
          authGateway={createSupabaseAuthGateway(environment)}
          apiClient={new AdminApiClient(environment.apiBaseUrl)}
        />
      </BrowserRouter>
    </React.StrictMode>,
  )
} catch (error) {
  renderConfigurationError(error)
}
