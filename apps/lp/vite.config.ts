import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Porta da **entrada única** de desenvolvimento (T20).
 *
 * É o único endereço que quem trabalha no projeto precisa conhecer: a LP na
 * raiz, o painel em `/admin` e a API em `/api/*`. As portas do painel e da API
 * viram detalhe interno, alcançadas só pelo encaminhamento abaixo.
 */
const DEV_PORT = 5173

/** Porta em que o servidor de desenvolvimento do painel escuta por trás. */
const ADMIN_TARGET = 'http://localhost:5174'

/** Porta em que a API NestJS escuta por trás. */
const API_TARGET = 'http://localhost:3000'

/**
 * Mapa de caminhos da entrada única — o mesmo do domínio único de produção
 * (SDD § "Visão de tiers" e § D-04).
 *
 * `ws: true` no painel é o que mantém a **recarga automática** dele viva
 * através do proxy. O cliente do Vite do painel abre a conexão de HMR contra a
 * origem que o serviu — a entrada única, em `ws://localhost:5173/admin/` —, e
 * sem encaminhar essa conexão o painel seria servido mas nenhuma alteração
 * chegaria ao navegador. A recarga da própria LP não passa por aqui: ela fala
 * com este mesmo servidor, na raiz.
 */
const SINGLE_ENTRY_PROXY = {
  '/admin': { target: ADMIN_TARGET, changeOrigin: true, ws: true },
  '/api': { target: API_TARGET, changeOrigin: true },
}

// Build estático (SPA) — ver Especificação Funcional, seção 2.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: DEV_PORT,
    strictPort: true,
    proxy: SINGLE_ENTRY_PROXY,
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
})
