import 'reflect-metadata'
import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { AppModule } from './app.module'
import { ENVIRONMENT } from './config/environment'
import type { Environment } from './config/environment.schema'
import { API_PREFIX, configureApp } from './shared/presentation/configure-app'
import { serveStaticSites } from './shared/presentation/static-sites'

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule)
  const environment = app.get<Environment>(ENVIRONMENT)

  configureApp(app, environment)

  // Origem única: se os `dist` da LP e do painel estiverem ao lado, este mesmo
  // processo os serve em `/` e `/admin`. Ver static-sites.ts.
  const servidos = serveStaticSites(app)

  // `0.0.0.0` e não o padrão do Node: em contêiner de serviço gerenciado
  // (Render) o roteador externo alcança o processo por outra interface, e ficar
  // só em localhost apareceria como "no open ports detected".
  await app.listen(environment.PORT, '0.0.0.0')

  const logger = new Logger('Bootstrap')
  const base = `http://localhost:${environment.PORT}`
  logger.log(`API disponível em ${base}/${API_PREFIX}`)
  if (servidos.lp) {
    logger.log(`LP disponível em ${base}/`)
  }
  if (servidos.admin) {
    logger.log(`Painel disponível em ${base}/admin/`)
  }
}

bootstrap().catch((error: unknown) => {
  new Logger('Bootstrap').error(
    error instanceof Error ? error.message : String(error),
  )
  process.exit(1)
})
