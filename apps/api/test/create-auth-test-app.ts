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
 * Por quê: `AppModule` também importa `SupabaseModule`
 * (`src/shared/infrastructure/supabase-client.ts`), que hoje não compila
 * contra o `environment.schema.ts` já revisado por esta fase — as variáveis
 * `SUPABASE_URL`/`SUPABASE_SECRET_KEY` saíram do esquema (SDD § D-10) e
 * `supabase-client.ts` só será atualizado pelas tarefas em paralelo que ainda
 * migram os outros módulos (ver `agent_context/PLAN.md`). Esse arquivo está
 * fora do escopo desta tarefa (`autenticacao-propria` só toca
 * `modules/auth/`), então este harness evita `AppModule` para que a suíte de
 * autenticação rode e prove o comportamento real, sem esperar a migração dos
 * módulos irmãos.
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
