import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common'

export interface HealthStatus {
  status: 'ok'
}

@Controller('health')
export class HealthController {
  @Get()
  @HttpCode(HttpStatus.OK)
  check(): HealthStatus {
    return { status: 'ok' }
  }
}
