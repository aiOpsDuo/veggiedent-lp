import { existsSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { Logger } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import type { Request, Response, NextFunction } from 'express'
import { API_PREFIX } from './configure-app'

/**
 * Serve a LP e o painel pelo próprio processo da API, para que as três peças
 * respondam numa **origem única** sem nginx na frente.
 *
 * Existe por causa da publicação em serviço gerenciado (Render): lá um serviço
 * é um contêiner com uma porta, e o produto precisa de `/`, `/admin` e `/api/*`
 * no mesmo endereço — `<url>/admin` é requisito, não conveniência. O
 * `docker-compose.yml` continua a valer para desenvolvimento e homologação
 * local; este módulo é o mesmo mapa de caminhos de `docker/nginx.conf`, escrito
 * em middleware:
 *
 *   /        -> apps/lp/dist
 *   /admin   -> apps/admin/dist (build com base `/admin/`, SDD § D-04)
 *   /api/*   -> os controladores do Nest, intocados
 *
 * Se um dos `dist` não existir, a peça simplesmente não é servida e a API sobe
 * igual. É o que mantém os testes e o `npm run dev` — onde quem serve os
 * front-ends é o Vite — funcionando sem nenhuma condição especial.
 */

/** Caminho público do painel, sem barra final. */
const ADMIN_BASE = '/admin'

/** Nome da pasta de assets com hash no nome — a que pode ser imutável. */
const ASSETS_DIR = 'assets'

const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable'

const logger = new Logger('StaticSites')

/**
 * `dist` de cada front-end, relativo a este arquivo compilado
 * (`apps/api/dist/shared/presentation/`). Espelha o layout do repositório, que
 * é também o layout dentro da imagem — ver `docker/Dockerfile`, alvo `render`.
 */
function distPath(app: 'lp' | 'admin'): string {
  return resolve(__dirname, '..', '..', '..', '..', app, 'dist')
}

/**
 * Só arquivo com hash no nome recebe cache imutável. `index.html` nunca: é ele
 * que aponta para o bundle novo depois de cada publicação, e um `index.html`
 * imutável deixaria o navegador preso na versão anterior.
 */
function setAssetHeaders(response: Response, filePath: string): void {
  if (filePath.includes(`${sep}${ASSETS_DIR}${sep}`)) {
    response.setHeader('Cache-Control', IMMUTABLE_CACHE)
  }
}

/**
 * `index: false` e `redirect: false` deixam toda decisão de "qual index.html" e
 * de barra final para o middleware de fallback, num lugar só.
 */
const STATIC_OPTIONS = {
  index: false,
  redirect: false,
  setHeaders: setAssetHeaders,
} as const

function isApiPath(path: string): boolean {
  return path === `/${API_PREFIX}` || path.startsWith(`/${API_PREFIX}/`)
}

/**
 * Um pedido de asset que chegou até aqui é asset que não existe: devolver o
 * `index.html` faria o navegador receber HTML no lugar de um `.js` e falhar com
 * erro de tipo MIME, que esconde a causa. Deixa seguir para o 404.
 */
function isMissingAsset(path: string): boolean {
  return (
    path.startsWith(`/${ASSETS_DIR}/`) ||
    path.startsWith(`${ADMIN_BASE}/${ASSETS_DIR}/`)
  )
}

/**
 * Fallback de SPA: caminho que não casou com arquivo nenhum devolve o
 * `index.html` do front-end correspondente, para o roteador do React assumir.
 */
function createSpaFallback(
  lpIndex: string | undefined,
  adminIndex: string | undefined,
) {
  return function spaFallback(
    request: Request,
    response: Response,
    next: NextFunction,
  ): void {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      next()
      return
    }

    if (isApiPath(request.path) || isMissingAsset(request.path)) {
      next()
      return
    }

    // Depois do login o roteador do painel deixa o endereço em `/admin`, sem
    // barra. Recarregar ali precisa devolver o painel, e não a LP — o mesmo
    // cuidado do `location = /admin` do nginx e do plugin do Vite.
    if (request.path === ADMIN_BASE) {
      response.redirect(301, `${ADMIN_BASE}/`)
      return
    }

    const index = request.path.startsWith(`${ADMIN_BASE}/`) ? adminIndex : lpIndex
    if (index === undefined) {
      next()
      return
    }

    response.sendFile(index)
  }
}

/**
 * Monta o serviço de arquivos das duas SPAs. Chamada depois de `configureApp` e
 * antes do `listen`; devolve quais peças foram encontradas, para o log de
 * inicialização dizer o que está no ar.
 */
export function serveStaticSites(app: NestExpressApplication): {
  lp: boolean
  admin: boolean
} {
  const lpDist = distPath('lp')
  const adminDist = distPath('admin')

  const lpIndex = join(lpDist, 'index.html')
  const adminIndex = join(adminDist, 'index.html')

  const hasLp = existsSync(lpIndex)
  const hasAdmin = existsSync(adminIndex)

  if (hasAdmin) {
    // O painel primeiro: o `express.static` da LP está na raiz e veria
    // `/admin/...` como caminho seu, sem nada para casar.
    app.useStaticAssets(adminDist, { ...STATIC_OPTIONS, prefix: ADMIN_BASE })
  } else {
    logger.warn(`Painel não encontrado em ${adminDist} — /admin não será servido.`)
  }

  if (hasLp) {
    app.useStaticAssets(lpDist, STATIC_OPTIONS)
  } else {
    logger.warn(`LP não encontrada em ${lpDist} — a raiz não será servida.`)
  }

  if (hasLp || hasAdmin) {
    app.use(
      createSpaFallback(
        hasLp ? lpIndex : undefined,
        hasAdmin ? adminIndex : undefined,
      ),
    )
  }

  return { lp: hasLp, admin: hasAdmin }
}
