import { Module } from '@nestjs/common'
import { DeleteLeadUseCase } from './application/delete-lead.use-case'
import { ExportLeadsUseCase } from './application/export-leads.use-case'
import { ListLeadsUseCase } from './application/list-leads.use-case'
import { SubmitLeadUseCase } from './application/submit-lead.use-case'
import { LEAD_INTAKE } from './domain/lead-intake.port'
import { LEAD_REPOSITORY } from './domain/lead-repository.port'
import { SupabaseLeadRepository } from './infrastructure/supabase-lead.repository'
import { AdminLeadsController } from './presentation/admin-leads.controller'
import { PublicLeadsController } from './presentation/public-leads.controller'

/**
 * Leads do formulário da LP (T8).
 *
 * Camadas (SDD § "Visão de layers dentro da API"): `presentation/` traduz HTTP,
 * `application/` orquestra casos de uso, `domain/` guarda as regras e as portas,
 * `infrastructure/` implementa as portas. A dependência aponta sempre para
 * dentro: nada em `domain/` importa framework, Supabase ou camada de fora.
 *
 * São duas portas sobre a mesma tabela, implementadas pela mesma classe e
 * registradas sob os dois tokens: `LEAD_INTAKE` é o que o caminho público
 * enxerga — apenas gravar — e `LEAD_REPOSITORY` é o que só o caminho
 * administrativo enxerga: listar, exportar e excluir (ISP; a justificativa está
 * em `lead-intake.port.ts`).
 *
 * Não há mais porta de repasse: o destino externo foi descontinuado em
 * 2026-09-03 e o banco do CMS é o único lugar onde o lead existe (SDD § C-11).
 * A saída do dado é a exportação em CSV (§ RN-01).
 */
@Module({
  controllers: [PublicLeadsController, AdminLeadsController],
  providers: [
    SupabaseLeadRepository,
    { provide: LEAD_INTAKE, useExisting: SupabaseLeadRepository },
    { provide: LEAD_REPOSITORY, useExisting: SupabaseLeadRepository },
    SubmitLeadUseCase,
    ListLeadsUseCase,
    ExportLeadsUseCase,
    DeleteLeadUseCase,
  ],
})
export class LeadsModule {}
