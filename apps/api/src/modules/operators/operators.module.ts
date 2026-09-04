import { Module } from '@nestjs/common'
import { InviteOperatorUseCase } from './application/invite-operator.use-case'
import { ListOperatorsUseCase } from './application/list-operators.use-case'
import { RemoveOperatorUseCase } from './application/remove-operator.use-case'
import { OPERATOR_DIRECTORY } from './domain/operator-directory.port'
import { SupabaseOperatorDirectory } from './infrastructure/supabase-operator.directory'
import { AdminOperatorsController } from './presentation/admin-operators.controller'

/**
 * Gestão de operadores dentro do painel (SDD § D-09), revertendo o trade-off
 * original de D-03 que deixava isso só no painel do Supabase.
 *
 * Camadas (SDD § "Visão de layers dentro da API"): igual aos demais módulos —
 * `presentation/` traduz HTTP, `application/` orquestra, `domain/` guarda a
 * porta e as duas regras de recusa (R-10), `infrastructure/` fala com a Admin
 * API do Supabase Auth. Não existe repositório de banco aqui: o Supabase Auth
 * é a única fonte, por isso não há tabela `operators` nem migração para ela.
 */
@Module({
  controllers: [AdminOperatorsController],
  providers: [
    { provide: OPERATOR_DIRECTORY, useClass: SupabaseOperatorDirectory },
    ListOperatorsUseCase,
    InviteOperatorUseCase,
    RemoveOperatorUseCase,
  ],
})
export class OperatorsModule {}
