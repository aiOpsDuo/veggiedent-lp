import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { AuthenticatedOperator } from '../../auth/domain/authenticated-operator'
import { CurrentOperator } from '../../auth/presentation/current-operator.decorator'
import { requireOperator } from '../../auth/presentation/require-operator'
import { InviteOperatorUseCase } from '../application/invite-operator.use-case'
import { ListOperatorsUseCase } from '../application/list-operators.use-case'
import type { OperatorView } from '../application/operator-view'
import { RemoveOperatorUseCase } from '../application/remove-operator.use-case'
import type { OperatorInvite } from '../domain/operator-directory.port'
import { InviteOperatorDto } from './invite-operator.dto'

/**
 * Operadores do painel (SDD § D-09, § C-13). Sem marcação de público: a guarda
 * global cobre tudo aqui, inclusive a listagem — não há nada neste controller
 * que um visitante sem sessão deveria ver.
 *
 * Os métodos só traduzem HTTP em chamada de caso de uso (risco R-06), como nos
 * demais controllers administrativos.
 */
@ApiTags('Administração — operadores')
@ApiBearerAuth()
@Controller('admin/operators')
export class AdminOperatorsController {
  constructor(
    private readonly listOperators: ListOperatorsUseCase,
    private readonly inviteOperator: InviteOperatorUseCase,
    private readonly removeOperator: RemoveOperatorUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lista os operadores do painel.' })
  async listar(): Promise<OperatorView[]> {
    return this.listOperators.execute()
  }

  @Post()
  @ApiOperation({
    summary: 'Convida um novo operador.',
    description:
      'Gera o link de ativação de uso único e o devolve nesta resposta — a única vez que ele existe (SDD § D-09). Nenhum e-mail é enviado pela API.',
  })
  async convidar(@Body() pedido: InviteOperatorDto): Promise<OperatorInvite> {
    return this.inviteOperator.execute(pedido.email)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Remove um operador.',
    description:
      'Responde 409 ao tentar remover a própria conta ou o último operador restante (SDD § R-10) — as duas formas de travar o próprio acesso ao painel.',
  })
  async remover(
    @Param('id') id: string,
    @CurrentOperator() operator: AuthenticatedOperator | undefined,
  ): Promise<void> {
    await this.removeOperator.execute(id, requireOperator(operator).id)
  }
}
