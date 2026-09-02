import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Public } from '../../auth/presentation/public.decorator'
import { SubmitLeadUseCase } from '../application/submit-lead.use-case'
import type { LeadSubmissionResult } from '../application/lead-view'
import { SubmitLeadDto } from './submit-lead.dto'

/**
 * O envio do formulário da LP (SDD § "Endpoints públicos").
 *
 * `@Public()` é escrito de propósito: a guarda global nega por padrão, e esta é
 * uma das três rotas que o visitante alcança sem token. As rotas de consulta de
 * lead ficam no controller administrativo, atrás da guarda — nenhum lead é
 * acessível sem autenticação (SDD § C-12).
 */
@ApiTags('Captura de lead')
@Public()
@Controller('leads')
export class PublicLeadsController {
  constructor(private readonly submitLead: SubmitLeadUseCase) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Recebe o formulário: valida, grava o lead e repassa ao RD Station.',
    description:
      'O lead é gravado antes de o RD Station ser tentado. Uma falha do repasse não muda esta resposta: ' +
      'o resultado fica em rdstation_status. O honeypot preenchido responde sucesso sem gravar nem repassar. ' +
      'Dados inválidos respondem 422 com os erros por campo.',
  })
  @ApiOkResponse({
    description: 'Lead recebido.',
    schema: { type: 'object', properties: { success: { type: 'boolean', example: true } } },
  })
  async enviar(@Body() lead: SubmitLeadDto): Promise<LeadSubmissionResult> {
    return this.submitLead.execute(lead)
  }
}
