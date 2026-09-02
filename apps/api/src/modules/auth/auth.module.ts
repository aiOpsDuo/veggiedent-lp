import { Global, Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { ENVIRONMENT } from '../../config/environment'
import { AuthenticateOperatorUseCase } from './application/authenticate-operator.use-case'
import { TOKEN_VERIFIER } from './domain/token-verifier.port'
import { createJwksTokenVerifier } from './infrastructure/jwks-token-verifier'
import { AuthenticationGuard } from './presentation/authentication.guard'

/**
 * Verificação do token do Supabase Auth e a guarda global (SDD § D-03).
 *
 * Camadas (SDD § "Visão de layers dentro da API"): `presentation/` traduz HTTP,
 * `application/` orquestra casos de uso, `domain/` guarda as regras e as portas,
 * `infrastructure/` implementa as portas. A dependência aponta sempre para
 * dentro: nada em `domain/` importa framework, Supabase ou camada de fora.
 *
 * A guarda é registrada por `APP_GUARD`, e não rota a rota. É o que faz um
 * endpoint novo nascer protegido: proteger não exige lembrar de nada; abrir,
 * sim — exige um `@Public()` escrito de propósito.
 *
 * `@Global()` para que os módulos das tarefas seguintes possam injetar o caso
 * de uso sem reimportar o módulo, mantendo o registro da guarda em um só lugar.
 */
@Global()
@Module({
  providers: [
    {
      provide: TOKEN_VERIFIER,
      inject: [ENVIRONMENT],
      useFactory: createJwksTokenVerifier,
    },
    AuthenticateOperatorUseCase,
    { provide: APP_GUARD, useClass: AuthenticationGuard },
  ],
  exports: [TOKEN_VERIFIER, AuthenticateOperatorUseCase],
})
export class AuthModule {}
