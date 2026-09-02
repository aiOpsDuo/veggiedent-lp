import { Module } from '@nestjs/common'
import { APP_FILTER, APP_PIPE } from '@nestjs/core'
import { EnvironmentModule } from './config/environment.module'
import { HealthModule } from './health/health.module'
import { AuthModule } from './modules/auth/auth.module'
import { ContentModule } from './modules/content/content.module'
import { LeadsModule } from './modules/leads/leads.module'
import { MediaModule } from './modules/media/media.module'
import { MetadataModule } from './modules/metadata/metadata.module'
import { AllExceptionsFilter } from './shared/presentation/all-exceptions.filter'
import { createValidationPipe } from './shared/presentation/validation.pipe'

@Module({
  imports: [
    EnvironmentModule,
    HealthModule,
    AuthModule,
    ContentModule,
    MetadataModule,
    MediaModule,
    LeadsModule,
  ],
  providers: [
    { provide: APP_PIPE, useFactory: createValidationPipe },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
