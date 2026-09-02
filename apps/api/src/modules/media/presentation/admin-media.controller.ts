import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { AuthenticatedOperator } from '../../auth/domain/authenticated-operator'
import { CurrentOperator } from '../../auth/presentation/current-operator.decorator'
import { requireOperator } from '../../auth/presentation/require-operator'
import { DeleteMediaUseCase } from '../application/delete-media.use-case'
import { GetMediaUseCase } from '../application/get-media.use-case'
import { IssueUploadCredentialUseCase } from '../application/issue-upload-credential.use-case'
import type { MediaView, UploadCredentialView } from '../application/media-view'
import { RegisterMediaUseCase } from '../application/register-media.use-case'
import { RegisterMediaDto } from './register-media.dto'
import { UploadUrlDto } from './upload-url.dto'

/**
 * Mídia enviada pelo painel. Sem marcação de público: a guarda global exige
 * token em todas as rotas daqui (SDD § C-01) — inclusive na emissão da
 * credencial, que é o ponto onde um esquecimento daria a qualquer visitante o
 * direito de escrever no armazenamento do produto.
 *
 * **Nenhuma rota deste controller recebe ou devolve bytes de arquivo**
 * (SDD § D-05): os bytes vão do navegador direto ao armazenamento. O que passa
 * por aqui é sempre metadado — nome, tipo, tamanho, caminho.
 *
 * Os métodos só traduzem HTTP em chamada de caso de uso (risco R-06).
 */
@ApiTags('Administração — mídia')
@ApiBearerAuth()
@Controller('admin/media')
export class AdminMediaController {
  constructor(
    private readonly issueUploadCredential: IssueUploadCredentialUseCase,
    private readonly registerMedia: RegisterMediaUseCase,
    private readonly getMedia: GetMediaUseCase,
    private readonly deleteMedia: DeleteMediaUseCase,
  ) {}

  @Post('upload-url')
  @ApiOperation({
    summary: 'Emite a credencial temporária de upload e o caminho de destino.',
    description:
      'Passo 1 de 3. Tipo não suportado ou arquivo acima do limite do bucket são recusados com 422, antes de qualquer credencial ser emitida. Nenhum registro de mídia é criado aqui.',
  })
  async emitirCredencial(@Body() pedido: UploadUrlDto): Promise<UploadCredentialView> {
    return this.issueUploadCredential.execute(pedido)
  }

  @Post()
  @ApiOperation({
    summary: 'Confirma o upload e registra a mídia.',
    description:
      'Passo 3 de 3. O registro só é criado depois que o armazenamento confirma que o arquivo está lá; tamanho e tipo são lidos do arquivo, não do corpo da requisição.',
  })
  async registrar(
    @Body() confirmacao: RegisterMediaDto,
    @CurrentOperator() operator: AuthenticatedOperator | undefined,
  ): Promise<MediaView> {
    return this.registerMedia.execute(confirmacao, requireOperator(operator).id)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Registro de uma mídia, com a URL pública.' })
  async ler(@Param('id') id: string): Promise<MediaView> {
    return this.getMedia.execute(id)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Remove a mídia e o arquivo do armazenamento.',
    description:
      'Responde 409 quando a mídia está referenciada por alguma seção — publicada ou não — ou pelos metadados da página. Nesse caso nada é apagado.',
  })
  async remover(@Param('id') id: string): Promise<void> {
    await this.deleteMedia.execute(id)
  }
}
