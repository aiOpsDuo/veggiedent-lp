import { Body, Controller, Get, Put } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { AuthenticatedOperator } from '../../auth/domain/authenticated-operator'
import { CurrentOperator } from '../../auth/presentation/current-operator.decorator'
import { requireOperator } from '../../auth/presentation/require-operator'
import { GetSiteMetadataUseCase } from '../application/get-site-metadata.use-case'
import { SaveSiteMetadataUseCase } from '../application/save-site-metadata.use-case'
import type { SiteMetadataView } from '../application/seo-metadata'

/**
 * Edição dos metadados da página pelo painel. Sem marcação de público: a guarda
 * global exige token (SDD § C-01).
 */
@ApiTags('Administração — metadados')
@ApiBearerAuth()
@Controller('admin/metadata')
export class AdminMetadataController {
  constructor(
    private readonly getMetadata: GetSiteMetadataUseCase,
    private readonly saveMetadata: SaveSiteMetadataUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Metadados da página, na forma que o painel edita.' })
  async ler(): Promise<SiteMetadataView> {
    return this.getMetadata.execute()
  }

  @Put()
  @ApiOperation({
    summary: 'Grava os metadados da página.',
    description: 'Valida contra o esquema; documento inválido é recusado com 422 e erros por campo.',
  })
  async gravar(
    @Body() document: unknown,
    @CurrentOperator() operator: AuthenticatedOperator | undefined,
  ): Promise<SiteMetadataView> {
    return this.saveMetadata.execute(document, requireOperator(operator).id)
  }
}
