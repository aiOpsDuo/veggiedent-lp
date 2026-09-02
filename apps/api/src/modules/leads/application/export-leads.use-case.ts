import { Inject, Injectable } from '@nestjs/common'
import { toLeadPeriod } from '../domain/lead-period'
import {
  LEAD_REPOSITORY,
  type LeadRepository,
} from '../domain/lead-repository.port'
import { EXPORT_ROW_LIMIT } from '../domain/lead-query'
import { toCsv, type CsvFile } from './leads-csv'

/**
 * A exportação em CSV, respeitando os mesmos filtros da listagem
 * (SDD § "Endpoints administrativos" e § C-12).
 *
 * Não é paginada: quem exporta quer o período inteiro em um arquivo. O teto de
 * `EXPORT_ROW_LIMIT` linhas existe porque o arquivo é montado em memória antes
 * de ser enviado — sem ele, um período largo derrubaria a API em vez de gerar
 * um arquivo grande.
 */
@Injectable()
export class ExportLeadsUseCase {
  constructor(
    @Inject(LEAD_REPOSITORY) private readonly repository: LeadRepository,
  ) {}

  async execute(from?: string, to?: string): Promise<CsvFile> {
    const period = toLeadPeriod(from, to)
    const leads = await this.repository.listForExport(period, EXPORT_ROW_LIMIT)
    return toCsv(leads)
  }
}
