import type { INestApplication, ModuleMetadata } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { APP_FILTER, APP_PIPE } from '@nestjs/core'
import { ENVIRONMENT } from '../src/config/environment'
import { EnvironmentModule } from '../src/config/environment.module'
import type { Environment } from '../src/config/environment.schema'
import { HealthModule } from '../src/health/health.module'
import { AuthModule } from '../src/modules/auth/auth.module'
import { configureApp } from '../src/shared/presentation/configure-app'
import { AllExceptionsFilter } from '../src/shared/presentation/all-exceptions.filter'
import { createValidationPipe } from '../src/shared/presentation/validation.pipe'

export interface ProviderOverride {
  readonly provide: unknown
  readonly useValue: unknown
}

/**
 * Sobe só o que a autenticação precisa — `EnvironmentModule`, `HealthModule` e
 * `AuthModule` (que já importa `PrismaModule`) — em vez do `AppModule`
 * inteiro.
 *
 * Por quê: `autenticacao-propria` só toca `modules/auth/`, então este harness
 * evita depender dos demais módulos de domínio (conteúdo, metadados, mídia,
 * leads, operadores) para que a suíte de autenticação rode isolada, sem
 * precisar de um dublê para cada um deles.
 *
 * Mesmo pipe, mesmo filtro, mesmo prefixo de `configure-app.ts`/`AppModule` —
 * só o conjunto de módulos de domínio é menor.
 */
export async function createAuthTestApp(
  extraMetadata: ModuleMetadata = {},
  providerOverrides: readonly ProviderOverride[] = [],
): Promise<INestApplication> {
  const builder = Test.createTestingModule({
    imports: [EnvironmentModule, HealthModule, AuthModule, ...(extraMetadata.imports ?? [])],
    controllers: extraMetadata.controllers ?? [],
    providers: [
      { provide: APP_PIPE, useFactory: createValidationPipe },
      { provide: APP_FILTER, useClass: AllExceptionsFilter },
      ...(extraMetadata.providers ?? []),
    ],
  })

  for (const override of providerOverrides) {
    builder.overrideProvider(override.provide).useValue(override.useValue)
  }

  const moduleRef = await builder.compile()
  const app = moduleRef.createNestApplication({ logger: false })
  configureApp(app, app.get<Environment>(ENVIRONMENT))
  await app.init()
  return app
}
