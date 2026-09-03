import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/** Porta do painel em desenvolvimento — a LP ocupa a 5173. */
const DEV_PORT = 5174

/** Porta da API local, para o proxy de desenvolvimento. */
const LOCAL_API_ORIGIN = 'http://localhost:3000'

/**
 * Build do painel (SDD § D-04).
 *
 * `base` é `/admin/` porque em produção o painel divide o domínio com a LP: a
 * raiz serve a página pública e `/admin` serve este build (T16). Sem isso os
 * caminhos dos assets sairiam apontando para a raiz do domínio, que é da LP.
 *
 * O servidor de desenvolvimento encaminha `/api` para a API local pelo mesmo
 * motivo: em produção painel e API respondem no mesmo domínio, então o painel
 * chama caminhos relativos e não existe requisição entre origens para liberar.
 */
export default defineConfig({
  base: '/admin/',
  plugins: [react()],
  server: {
    port: DEV_PORT,
    strictPort: true,
    proxy: {
      '/api': { target: LOCAL_API_ORIGIN, changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
})
