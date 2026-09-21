import { Module } from '@nestjs/common'
import { CreateOperatorUseCase } from './application/create-operator.use-case'
import { ListOperatorsUseCase } from './application/list-operators.use-case'
import { RemoveOperatorUseCase } from './application/remove-operator.use-case'
import { OPERATOR_DIRECTORY } from './domain/operator-directory.port'
import { MySqlOperatorDirectory } from './infrastructure/mysql-operator.directory'
import { AdminOperatorsController } from './presentation/admin-operators.controller'

/**
 * Gestão de operadores dentro do painel (SDD § D-09), revertendo o trade-off
 * original de D-03 que deixava isso só no painel do Supabase.
 *
 * Camadas (SDD § "Visão de layers dentro da API"): igual aos demais módulos —
 * `presentation/` traduz HTTP, `application/` orquestra, `domain/` guarda a
 * porta e as duas regras de recusa (R-10), `infrastructure/` fala com a tabela
 * `operators` do MySQL via Prisma (SDD § D-10 — substitui a Admin API do
 * Supabase Auth). `PRISMA_CLIENT` não precisa ser importado aqui: `PrismaModule`
 * é `@Global()` (ver `shared/infrastructure/prisma.module.ts`) e já está
 * registrado uma única vez em `AppModule`.
 */
@Module({
  controllers: [AdminOperatorsController],
  providers: [
    { provide: OPERATOR_DIRECTORY, useClass: MySqlOperatorDirectory },
    ListOperatorsUseCase,
    CreateOperatorUseCase,
    RemoveOperatorUseCase,
  ],
})
export class OperatorsModule {}
