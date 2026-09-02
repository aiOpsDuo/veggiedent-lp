import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common'
import { Public } from '../../modules/auth/presentation/public.decorator'

export interface HealthStatus {
  status: 'ok'
}

/**
 * Sonda de operação: precisa responder a quem monitora a API, que não tem
 * sessão de operador. Por isso a liberação é explícita — a guarda global nega
 * por padrão (SDD § D-03).
 */
@Public()
@Controller('health')
export class HealthController {
  @Get()
  @HttpCode(HttpStatus.OK)
  check(): HealthStatus {
    return { status: 'ok' }
  }
}
