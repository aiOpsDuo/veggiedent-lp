import { Global, Module } from '@nestjs/common'
import { ENVIRONMENT } from '../../config/environment'
import { SUPABASE_CLIENT, createSupabaseClient } from './supabase-client'

/**
 * Um único cliente Supabase para o processo inteiro.
 *
 * Global porque os módulos de conteúdo, metadados, mídia e leads precisam do
 * mesmo cliente; declará-lo em um só lugar mantém a leitura da chave secreta
 * em um só lugar. O que é global é o *cliente*, não o acesso: continuam sendo
 * apenas os adaptadores de infraestrutura que o injetam.
 */
@Global()
@Module({
  providers: [
    {
      provide: SUPABASE_CLIENT,
      inject: [ENVIRONMENT],
      useFactory: createSupabaseClient,
    },
  ],
  exports: [SUPABASE_CLIENT],
})
export class SupabaseModule {}
