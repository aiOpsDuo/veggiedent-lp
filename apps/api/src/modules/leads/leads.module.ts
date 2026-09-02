import { Module } from '@nestjs/common'
import { DeleteLeadUseCase } from './application/delete-lead.use-case'
import { ExportLeadsUseCase } from './application/export-leads.use-case'
import { ListLeadsUseCase } from './application/list-leads.use-case'
import { SubmitLeadUseCase } from './application/submit-lead.use-case'
import { LEAD_INTAKE } from './domain/lead-intake.port'
import { LEAD_RELAY } from './domain/lead-relay.port'
import { LEAD_REPOSITORY } from './domain/lead-repository.port'
import { RdStationLeadRelay } from './infrastructure/rdstation-lead.relay'
import { SupabaseLeadRepository } from './infrastructure/supabase-lead.repository'
import { AdminLeadsController } from './presentation/admin-leads.controller'
import { PublicLeadsController } from './presentation/public-leads.controller'

/**
 * Leads do formulário da LP e o repasse ao RD Station (T8).
 *
 * Camadas (SDD § "Visão de layers dentro da API"): `presentation/` traduz HTTP,
 * `application/` orquestra casos de uso, `domain/` guarda as regras e as portas,
 * `infrastructure/` implementa as portas. A dependência aponta sempre para
 * dentro: nada em `domain/` importa framework, Supabase ou camada de fora.
 *
 * São três portas. Duas delas caem sobre a mesma tabela e são implementadas
 * pela mesma classe, registrada sob os dois tokens: `LEAD_INTAKE` é o que o
 * caminho público enxerga — gravar e registrar o resultado do repasse — e
 * `LEAD_REPOSITORY` é o que só o caminho administrativo enxerga: listar,
 * exportar e excluir (ISP; a justificativa está em `lead-intake.port.ts`).
 *
 * A terceira, `LEAD_RELAY`, é a fronteira com o RD Station. É trocá-la por um
 * dublê que permite provar, sem nenhuma chamada de rede, que uma recusa do RD
 * Station não perde o lead nem faz o visitante ver erro (SDD § C-11).
 */
@Module({
  controllers: [PublicLeadsController, AdminLeadsController],
  providers: [
    SupabaseLeadRepository,
    { provide: LEAD_INTAKE, useExisting: SupabaseLeadRepository },
    { provide: LEAD_REPOSITORY, useExisting: SupabaseLeadRepository },
    { provide: LEAD_RELAY, useClass: RdStationLeadRelay },
    SubmitLeadUseCase,
    ListLeadsUseCase,
    ExportLeadsUseCase,
    DeleteLeadUseCase,
  ],
})
export class LeadsModule {}
