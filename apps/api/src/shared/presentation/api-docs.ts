import type { INestApplication } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import type { Environment } from '../../config/environment.schema'

export const API_DOCS_PATH = 'api/docs'

/**
 * A documentação existe para os dois consumidores da API (LP e painel) durante
 * o desenvolvimento; em produção ela é um catálogo dos endpoints `/api/admin/*`
 * e por isso nunca é publicada (README § "Visualização da API").
 */
export function shouldExposeApiDocs(nodeEnv: Environment['NODE_ENV']): boolean {
  return nodeEnv !== 'production'
}

export function setupApiDocs(app: INestApplication, environment: Environment): void {
  if (!shouldExposeApiDocs(environment.NODE_ENV)) {
    return
  }

  const config = new DocumentBuilder()
    .setTitle('API do CMS Veggiedent')
    .setDescription('Conteúdo, mídia, metadados e leads da landing page.')
    .setVersion('1.0')
    .addBearerAuth()
    .build()

  SwaggerModule.setup(API_DOCS_PATH, app, () =>
    SwaggerModule.createDocument(app, config),
  )
}
