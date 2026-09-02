import {
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Query,
  Res,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger'
import type { Response } from 'express'
import type { AuthenticatedOperator } from '../../auth/domain/authenticated-operator'
import { CurrentOperator } from '../../auth/presentation/current-operator.decorator'
import { requireOperator } from '../../auth/presentation/require-operator'
import { DeleteLeadUseCase } from '../application/delete-lead.use-case'
import { ExportLeadsUseCase } from '../application/export-leads.use-case'
import type { LeadsPageView } from '../application/lead-view'
import { ListLeadsUseCase } from '../application/list-leads.use-case'
import { ExportLeadsQueryDto } from './export-leads.query.dto'
import { ListLeadsQueryDto } from './list-leads.query.dto'

const CSV_CONTENT_TYPE = 'text/csv; charset=utf-8'

/**
 * Consulta, exportação e exclusão de leads. Sem marcação de público: a guarda
 * global exige token em todas as rotas daqui — é o que cumpre "nenhum lead é
 * acessível sem autenticação" (SDD § C-12) sem depender de ninguém lembrar.
 *
 * Os métodos só traduzem HTTP em chamada de caso de uso (risco R-06). O CSV é
 * montado no caso de uso; o que este arquivo decide é apenas como ele viaja:
 * tipo de conteúdo e nome do arquivo baixado.
 */
@ApiTags('Administração — leads')
@ApiBearerAuth()
@Controller('admin/leads')
export class AdminLeadsController {
  constructor(
    private readonly listLeads: ListLeadsUseCase,
    private readonly exportLeads: ExportLeadsUseCase,
    private readonly deleteLead: DeleteLeadUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Lista os leads, do mais recente ao mais antigo.',
    description:
      'Paginada. Os filtros from e to são dias no formato AAAA-MM-DD, inclusivos nos dois extremos, interpretados em UTC.',
  })
  async listar(@Query() filtros: ListLeadsQueryDto): Promise<LeadsPageView> {
    return this.listLeads.execute(filtros)
  }

  /**
   * Declarada antes de qualquer rota com parâmetro para que `export` nunca seja
   * lido como o identificador de um lead.
   */
  @Get('export')
  @Header('Content-Type', CSV_CONTENT_TYPE)
  @ApiProduces(CSV_CONTENT_TYPE)
  @ApiOperation({
    summary: 'Exporta os leads do período em CSV.',
    description:
      'Separador ponto e vírgula e BOM UTF-8, para abrir no Excel em português com a acentuação correta. Respeita os mesmos filtros da listagem.',
  })
  async exportar(
    @Query() filtros: ExportLeadsQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<string> {
    const arquivo = await this.exportLeads.execute(filtros.from, filtros.to)
    response.setHeader('Content-Disposition', `attachment; filename="${arquivo.filename}"`)
    return arquivo.content
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Exclui um lead definitivamente, a pedido do titular (LGPD).',
    description: 'Não há desfazer. Identificador inexistente responde 404.',
  })
  async excluir(
    @Param('id') id: string,
    @CurrentOperator() operator: AuthenticatedOperator | undefined,
  ): Promise<void> {
    await this.deleteLead.execute(id, requireOperator(operator).id)
  }
}
