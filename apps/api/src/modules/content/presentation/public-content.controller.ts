import { Controller, Get } from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Public } from '../../auth/presentation/public.decorator'
import { GetPublishedContentUseCase } from '../application/get-published-content.use-case'
import type { PublishedContent } from '../application/section-view'

/**
 * A única rota pública de conteúdo (SDD § "Endpoints públicos").
 *
 * `@Public()` é escrito de propósito: a guarda global nega por padrão, e esta é
 * uma das três rotas do sistema que o visitante alcança sem token.
 */
@ApiTags('Conteúdo público')
@Public()
@Controller('content')
export class PublicContentController {
  constructor(private readonly getPublishedContent: GetPublishedContentUseCase) {}

  @Get()
  @ApiOperation({
    summary: 'Todo o conteúdo publicado da landing page, em uma resposta.',
    description:
      'Seções e itens de lista não publicados são omitidos. Os itens vêm na ordem definida no painel. ' +
      'Campos de imagem, vídeo e legenda vêm com a URL pública no lugar do identificador da mídia; ' +
      'mídia inexistente faz o campo ser omitido, nunca entregar o identificador.',
  })
  @ApiOkResponse({
    description: 'Conteúdo publicado e metadados da página.',
    schema: {
      type: 'object',
      properties: {
        sections: { type: 'object', additionalProperties: true },
        metadata: { type: 'object', nullable: true, additionalProperties: true },
      },
    },
  })
  async ler(): Promise<PublishedContent> {
    return this.getPublishedContent.execute()
  }
}
