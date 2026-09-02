import { Module } from '@nestjs/common'
import { HealthController } from './presentation/health.controller'

/** Saúde do processo. Não é um domínio do CMS: é uma sonda de operação. */
@Module({
  controllers: [HealthController],
})
export class HealthModule {}
