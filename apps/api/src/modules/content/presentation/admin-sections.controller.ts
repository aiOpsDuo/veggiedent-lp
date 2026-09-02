import { Body, Controller, Get, Param, Patch, Put } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { AuthenticatedOperator } from '../../auth/domain/authenticated-operator'
import { CurrentOperator } from '../../auth/presentation/current-operator.decorator'
import { requireOperator } from '../../auth/presentation/require-operator'
import { GetSectionUseCase } from '../application/get-section.use-case'
import { ListSectionsUseCase } from '../application/list-sections.use-case'
import { SaveSectionUseCase } from '../application/save-section.use-case'
import { SetSectionVisibilityUseCase } from '../application/set-section-visibility.use-case'
import type { SectionDetail, SectionSummary } from '../application/section-view'
import { UpdateVisibilityDto } from './update-visibility.dto'

/**
 * Edição de seções pelo painel. Sem marcação de público: a guarda global exige
 * token em todas as rotas daqui (SDD § C-01).
 *
 * Os métodos só traduzem HTTP em chamada de caso de uso — nenhuma regra de
 * conteúdo, de visibilidade ou de validação mora neste arquivo (risco R-06).
 */
@ApiTags('Administração — seções')
@ApiBearerAuth()
@Controller('admin/sections')
export class AdminSectionsController {
  constructor(
    private readonly listSections: ListSectionsUseCase,
    private readonly getSection: GetSectionUseCase,
    private readonly saveSection: SaveSectionUseCase,
    private readonly setVisibility: SetSectionVisibilityUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Lista as 12 seções, na ordem da página.',
    description: 'Traz o estado de publicação e a data da última edição de cada seção.',
  })
  async listar(): Promise<{ sections: SectionSummary[] }> {
    return { sections: await this.listSections.execute() }
  }

  @Get(':key')
  @ApiOperation({
    summary: 'Documento completo de uma seção, publicado ou não.',
    description: 'Chave fora das 12 conhecidas responde 404.',
  })
  async ler(@Param('key') key: string): Promise<SectionDetail> {
    return this.getSection.execute(key)
  }

  @Put(':key')
  @ApiOperation({
    summary: 'Substitui o documento da seção. Salvar publica.',
    description:
      'Valida contra o esquema da seção; documento inválido é recusado com 422 e erros por campo.',
  })
  async gravar(
    @Param('key') key: string,
    @Body() document: unknown,
    @CurrentOperator() operator: AuthenticatedOperator | undefined,
  ): Promise<SectionDetail> {
    return this.saveSection.execute(key, document, requireOperator(operator).id)
  }

  @Patch(':key/visibility')
  @ApiOperation({ summary: 'Liga ou desliga a seção na landing page.' })
  async alterarVisibilidade(
    @Param('key') key: string,
    @Body() body: UpdateVisibilityDto,
    @CurrentOperator() operator: AuthenticatedOperator | undefined,
  ): Promise<SectionSummary> {
    return this.setVisibility.execute(key, body.isPublished, requireOperator(operator).id)
  }
}
