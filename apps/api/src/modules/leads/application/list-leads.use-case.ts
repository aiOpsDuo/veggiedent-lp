import { Inject, Injectable } from '@nestjs/common'
import {
  LEAD_REPOSITORY,
  type LeadRepository,
} from '../domain/lead-repository.port'
import { toLeadQuery, type LeadQueryInput } from '../domain/lead-query'
import { toLeadView, type LeadsPageView } from './lead-view'

/**
 * A listagem do painel: mais recente primeiro, paginada, com filtro por período
 * (SDD § "Endpoints administrativos" e § C-12).
 */
@Injectable()
export class ListLeadsUseCase {
  constructor(
    @Inject(LEAD_REPOSITORY) private readonly repository: LeadRepository,
  ) {}

  async execute(input: LeadQueryInput): Promise<LeadsPageView> {
    const query = toLeadQuery(input)
    const { leads, total } = await this.repository.list(query)
    return {
      leads: leads.map(toLeadView),
      total,
      page: query.page,
      pageSize: query.pageSize,
    }
  }
}
