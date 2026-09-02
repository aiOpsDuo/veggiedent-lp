import type { INestApplication, ModuleMetadata } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { AppModule } from '../src/app.module'
import { ENVIRONMENT } from '../src/config/environment'
import type { Environment } from '../src/config/environment.schema'
import { configureApp } from '../src/shared/presentation/configure-app'

/**
 * Sobe a aplicação real — mesmos módulos, mesmo pipe, mesmo filtro, mesmo
 * prefixo — para que o teste exercite a configuração que vai para produção.
 * `extraMetadata` permite acrescentar um controller-sonda ao teste sem que ele
 * exista na aplicação publicada.
 */
export async function createTestApp(
  extraMetadata: ModuleMetadata = {},
): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule, ...(extraMetadata.imports ?? [])],
    controllers: extraMetadata.controllers ?? [],
    providers: extraMetadata.providers ?? [],
  }).compile()

  const app = moduleRef.createNestApplication({ logger: false })
  configureApp(app, app.get<Environment>(ENVIRONMENT))
  await app.init()
  return app
}
