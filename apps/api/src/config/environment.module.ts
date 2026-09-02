import { Global, Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { ENVIRONMENT, parseEnvironment } from './environment'
import {
  ENVIRONMENT_VARIABLE_NAMES,
  type Environment,
} from './environment.schema'

function readEnvironment(configService: ConfigService): Environment {
  const raw = Object.fromEntries(
    ENVIRONMENT_VARIABLE_NAMES.map((name) => [name, configService.get(name)]),
  )
  return parseEnvironment(raw)
}

/**
 * Carrega o `.env`, valida o ambiente na inicialização e expõe o resultado
 * tipado sob o token `ENVIRONMENT` — nenhum consumidor lê `process.env`.
 *
 * `skipProcessEnv` faz o `ConfigService` responder a partir da configuração já
 * validada, e não do `process.env` cru, onde todo valor seria uma string.
 */
@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      skipProcessEnv: true,
      validate: parseEnvironment,
    }),
  ],
  providers: [
    {
      provide: ENVIRONMENT,
      inject: [ConfigService],
      useFactory: readEnvironment,
    },
  ],
  exports: [ENVIRONMENT],
})
export class EnvironmentModule {}
