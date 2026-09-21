import { Module } from '@nestjs/common'
import { APP_FILTER, APP_PIPE } from '@nestjs/core'
import { EnvironmentModule } from './config/environment.module'
import { HealthModule } from './health/health.module'
import { AuthModule } from './modules/auth/auth.module'
import { ContentModule } from './modules/content/content.module'
import { LeadsModule } from './modules/leads/leads.module'
import { MediaModule } from './modules/media/media.module'
import { MetadataModule } from './modules/metadata/metadata.module'
import { OperatorsModule } from './modules/operators/operators.module'
import { PrismaModule } from './shared/infrastructure/prisma.module'
import { RichTextModule } from './shared/infrastructure/rich-text.module'
import { SupabaseModule } from './shared/infrastructure/supabase.module'
import { AllExceptionsFilter } from './shared/presentation/all-exceptions.filter'
import { createValidationPipe } from './shared/presentation/validation.pipe'

@Module({
  imports: [
    EnvironmentModule,
    // SupabaseModule ainda coexiste com o PrismaModule: os repositórios
    // `supabase-*.ts` só são substituídos pelas tarefas seguintes desta fase
    // (`modulo-conteudo`, `modulo-metadados`, `modulo-leads`, `modulo-midia`,
    // `autenticacao-propria`, `gestao-operadores` — ver PLAN.md). Remover
    // SupabaseModule agora quebraria o app inteiro, não só o typecheck já
    // vermelho por outro motivo (ver PLAN.md § migracao-mysql/infraestrutura).
    SupabaseModule,
    PrismaModule,
    RichTextModule,
    HealthModule,
    AuthModule,
    ContentModule,
    MetadataModule,
    MediaModule,
    LeadsModule,
    OperatorsModule,
  ],
  providers: [
    { provide: APP_PIPE, useFactory: createValidationPipe },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
