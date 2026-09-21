import { Global, Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { ENVIRONMENT } from '../../config/environment'
import { PrismaModule } from '../../shared/infrastructure/prisma.module'
import { AuthenticateOperatorUseCase } from './application/authenticate-operator.use-case'
import { LoginOperatorUseCase } from './application/login-operator.use-case'
import { OPERATOR_CREDENTIALS_READER } from './domain/operator-credentials-reader.port'
import { TOKEN_ISSUER } from './domain/token-issuer.port'
import { TOKEN_VERIFIER } from './domain/token-verifier.port'
import { createAppJwtIssuer } from './infrastructure/app-jwt-issuer'
import { createAppJwtVerifier } from './infrastructure/app-jwt-verifier'
import { PrismaOperatorCredentialsReader } from './infrastructure/prisma-operator-credentials.reader'
import { AuthController } from './presentation/auth.controller'
import { AuthenticationGuard } from './presentation/authentication.guard'

/**
 * Login, emissão/verificação do JWT próprio e a guarda global (SDD § D-03,
 * reescrita em 2026-09-21 — antes verificava contra o JWKS do Supabase Auth).
 *
 * Camadas (SDD § "Visão de layers dentro da API"): `presentation/` traduz HTTP,
 * `application/` orquestra casos de uso, `domain/` guarda as regras e as portas,
 * `infrastructure/` implementa as portas. A dependência aponta sempre para
 * dentro: nada em `domain/` importa framework, Prisma ou camada de fora.
 *
 * A guarda é registrada por `APP_GUARD`, e não rota a rota. É o que faz um
 * endpoint novo nascer protegido: proteger não exige lembrar de nada; abrir,
 * sim — exige um `@Public()` escrito de propósito.
 *
 * `@Global()` para que os módulos das tarefas seguintes possam injetar o caso
 * de uso sem reimportar o módulo, mantendo o registro da guarda em um só lugar.
 *
 * `PrismaOperatorCredentialsReader` é um adaptador **estreito**: só lê
 * `operators` por e-mail, para o login. Não é a gestão completa da tabela
 * (listar/criar/remover) — essa é `OperatorDirectory`, do módulo `operators`,
 * tarefa futura e sequencial `migracao-mysql/gestao-operadores`.
 */
@Global()
@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [
    {
      provide: TOKEN_VERIFIER,
      inject: [ENVIRONMENT],
      useFactory: createAppJwtVerifier,
    },
    {
      provide: TOKEN_ISSUER,
      inject: [ENVIRONMENT],
      useFactory: createAppJwtIssuer,
    },
    {
      provide: OPERATOR_CREDENTIALS_READER,
      useClass: PrismaOperatorCredentialsReader,
    },
    AuthenticateOperatorUseCase,
    LoginOperatorUseCase,
    { provide: APP_GUARD, useClass: AuthenticationGuard },
  ],
  exports: [TOKEN_VERIFIER, AuthenticateOperatorUseCase],
})
export class AuthModule {}
