import 'reflect-metadata'
import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { ENVIRONMENT } from './config/environment'
import type { Environment } from './config/environment.schema'
import { API_PREFIX, configureApp } from './shared/presentation/configure-app'

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule)
  const environment = app.get<Environment>(ENVIRONMENT)

  // Liga os hooks de desligamento do Nest a SIGTERM/SIGINT: sem isto,
  // `onModuleDestroy` (usado por `PrismaModule` para fechar o pool de conexões
  // do MySQL, SDD § D-10) nunca é chamado — o Nest não escuta sinais do
  // sistema operacional por padrão.
  app.enableShutdownHooks()

  configureApp(app, environment)
  await app.listen(environment.PORT)

  new Logger('Bootstrap').log(
    `API disponível em http://localhost:${environment.PORT}/${API_PREFIX}`,
  )
}

bootstrap().catch((error: unknown) => {
  new Logger('Bootstrap').error(
    error instanceof Error ? error.message : String(error),
  )
  process.exit(1)
})
