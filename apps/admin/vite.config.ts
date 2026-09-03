import type { Connect } from 'vite'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Porta interna do painel em desenvolvimento.
 *
 * Detalhe de implementação desde a T20: quem trabalha no projeto entra pela
 * **entrada única** (a 5173) e alcança o painel em `/admin`. Nada aqui precisa
 * saber disso — o cliente de HMR do Vite abre a conexão contra a origem que o
 * serviu, que é a entrada única, e o encaminhamento a traz de volta para cá.
 */
const DEV_PORT = 5174

/** Porta em que `npm run preview -w apps/admin` serve o build do painel. */
const PREVIEW_PORT = 4174

/** Encaminhamento de `/api` para a API local, em desenvolvimento e no preview. */
const API_PROXY = { '/api': { target: 'http://localhost:3000', changeOrigin: true } }

/**
 * Redireciona `/admin` para `/admin/` no servidor de desenvolvimento.
 *
 * Depois do login o roteador deixa o endereço em `/admin`, sem a barra final, e
 * uma requisição a esse caminho cai fora da base do Vite — recarregar a página
 * ali devolveria a mensagem de base incorreta em vez do painel. Vale para o
 * servidor de desenvolvimento e para o `preview`. Em desenvolvimento a
 * requisição chega encaminhada pela entrada única (T20), e o `location`
 * relativo mantém o navegador nela. Em produção o mesmo cuidado é da
 * configuração de rotas do domínio único (T16): `/admin` e `/admin/` precisam
 * servir o mesmo `index.html`.
 */
function redirectAdminRoot(): Plugin {
  const redirect: Connect.NextHandleFunction = (request, response, next) => {
    if (request.url === '/admin') {
      response.writeHead(302, { location: '/admin/' })
      response.end()
      return
    }
    next()
  }

  return {
    name: 'veggiedent-redireciona-admin-sem-barra',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(redirect)
    },
    configurePreviewServer(server) {
      server.middlewares.use(redirect)
    },
  }
}

/**
 * Build do painel (SDD § D-04).
 *
 * `base` é `/admin/` porque em produção o painel divide o domínio com a LP: a
 * raiz serve a página pública e `/admin` serve este build (T16). Sem isso os
 * caminhos dos assets sairiam apontando para a raiz do domínio, que é da LP.
 *
 * O encaminhamento de `/api` existe pelo mesmo motivo: em produção painel e API
 * respondem no mesmo domínio, então o painel chama caminhos relativos e não
 * existe requisição entre origens para liberar. Em desenvolvimento quem
 * encaminha é a entrada única (T20); o encaminhamento daqui atende o `preview`
 * e quem alcance este servidor pela porta interna.
 */
export default defineConfig({
  base: '/admin/',
  plugins: [react(), redirectAdminRoot()],
  server: {
    port: DEV_PORT,
    strictPort: true,
    proxy: API_PROXY,
  },
  preview: {
    port: PREVIEW_PORT,
    strictPort: true,
    proxy: API_PROXY,
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
})
