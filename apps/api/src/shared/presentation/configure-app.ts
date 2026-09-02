import type { INestApplication } from '@nestjs/common'
import type { Environment } from '../../config/environment.schema'
import { setupApiDocs } from './api-docs'

export const API_PREFIX = 'api'

/**
 * Configuração de apresentação aplicada tanto em produção quanto nos testes —
 * um teste que passe aqui exercita a mesma aplicação que sobe de verdade.
 * O pipe de validação e o filtro de exceção são globais via DI (`AppModule`).
 */
export function configureApp(app: INestApplication, environment: Environment): void {
  app.setGlobalPrefix(API_PREFIX)
  setupApiDocs(app, environment)
}
