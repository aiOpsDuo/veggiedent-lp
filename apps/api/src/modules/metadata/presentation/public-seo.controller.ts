import { Controller, Get } from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Public } from '../../auth/presentation/public.decorator'
import { GetSeoMetadataUseCase } from '../application/get-seo-metadata.use-case'
import type { SeoMetadata } from '../application/seo-metadata'

/**
 * Metadados para o injetor de SEO da borda (SDD § D-06 e § "Contrato do injetor
 * de SEO"). Público de propósito: quem chama é a função de borda, antes de
 * qualquer sessão existir.
 */
@ApiTags('Conteúdo público')
@Public()
@Controller('seo')
export class PublicSeoController {
  constructor(private readonly getSeoMetadata: GetSeoMetadataUseCase) {}

  @Get()
  @ApiOperation({
    summary: 'Metadados da página para buscadores e previews de link.',
    description:
      'Campos ausentes vêm nulos, para que o injetor use a reserva do HTML estático em vez de falhar.',
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string', nullable: true },
        description: { type: 'string', nullable: true },
        ogImageUrl: { type: 'string', nullable: true },
      },
    },
  })
  async ler(): Promise<SeoMetadata> {
    return this.getSeoMetadata.execute()
  }
}
