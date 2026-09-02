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
