import { Module } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static'; // <- NOVO
import { join } from 'path'; // <- NOVO
import { EnvironmentModule } from './config/environment.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { ContentModule } from './modules/content/content.module';
import { LeadsModule } from './modules/leads/leads.module';
import { MediaModule } from './modules/media/media.module';
import { MetadataModule } from './modules/metadata/metadata.module';
import { OperatorsModule } from './modules/operators/operators.module';
import { RichTextModule } from './shared/infrastructure/rich-text.module';
import { SupabaseModule } from './shared/infrastructure/supabase.module';
import { AllExceptionsFilter } from './shared/presentation/all-exceptions.filter';
import { createValidationPipe } from './shared/presentation/validation.pipe';

@Module({
  imports: [
    EnvironmentModule,
    SupabaseModule,
    RichTextModule,
    HealthModule,
    AuthModule,
    ContentModule,
    MetadataModule,
    MediaModule,
    LeadsModule,
    OperatorsModule,
    // --- CONFIGURAÇÃO PARA SERVIR OS FRONTENDS ---
    ServeStaticModule.forRoot({
      // Caminho para o build da Landing Page
      rootPath: join(__dirname, '../../lp/dist'), 
      serveRoot: '/',
      exclude: ['/api/(.*)', '/admin/(.*)'],
    }),
    ServeStaticModule.forRoot({
    // Caminho para o build do Admin
      rootPath: join(__dirname, '../../admin/dist'), 
      serveRoot: '/admin',
    }),
  ],
  providers: [
    { provide: APP_PIPE, useFactory: createValidationPipe },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}