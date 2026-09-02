import type { INestApplication, ModuleMetadata } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { AppModule } from '../src/app.module'
import { ENVIRONMENT, parseEnvironment } from '../src/config/environment'
import type { Environment } from '../src/config/environment.schema'
import { configureApp } from '../src/shared/presentation/configure-app'

/**
 * Sobe a aplicação real — mesmos módulos, mesmo pipe, mesmo filtro, mesma
 * guarda, mesmo prefixo — para que o teste exercite a configuração que vai para
 * produção. `extraMetadata` permite acrescentar um controller-sonda ao teste sem
 * que ele exista na aplicação publicada.
 *
 * `environmentOverrides` troca variáveis de ambiente *depois* que o `.env` já
 * foi lido: o `ConfigModule` congela o ambiente no momento em que o módulo é
 * importado, cedo demais para um `beforeAll` alcançar. É o que permite apontar a
 * verificação de token a um JWKS local sem tocar em nenhum arquivo de `src/`.
 */
export async function createTestApp(
  extraMetadata: ModuleMetadata = {},
  environmentOverrides: Partial<Environment> = {},
): Promise<INestApplication> {
  const builder = Test.createTestingModule({
    imports: [AppModule, ...(extraMetadata.imports ?? [])],
    controllers: extraMetadata.controllers ?? [],
    providers: extraMetadata.providers ?? [],
  })

  if (Object.keys(environmentOverrides).length > 0) {
    builder
      .overrideProvider(ENVIRONMENT)
      .useValue(parseEnvironment({ ...process.env, ...environmentOverrides }))
  }

  const moduleRef = await builder.compile()
  const app = moduleRef.createNestApplication({ logger: false })
  configureApp(app, app.get<Environment>(ENVIRONMENT))
  await app.init()
  return app
}
