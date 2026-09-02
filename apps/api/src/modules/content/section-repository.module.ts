import { Module } from '@nestjs/common'
import { SECTION_REPOSITORY } from './domain/section-repository.port'
import { SupabaseSectionRepository } from './infrastructure/supabase-section.repository'

/**
 * A porta de persistência das seções, isolada em um módulo próprio.
 *
 * Existe por uma razão concreta: `ContentModule` importa `MediaModule` para
 * resolver as URLs das mídias no conteúdo publicado, e `MediaModule` precisa
 * ler as seções para saber se uma mídia está em uso antes de removê-la
 * (SDD § "Endpoints administrativos" — `409`). Importarem-se mutuamente seria
 * uma dependência circular, resolvida só com `forwardRef` — que esconde o ciclo
 * em vez de desfazê-lo.
 *
 * Publicar o repositório em um módulo sem dependência nenhuma desfaz o ciclo de
 * verdade: os dois módulos passam a depender deste, e nenhum depende do outro.
 * A mídia continua sem enxergar a tabela `content_sections`; enxerga só a porta.
 */
@Module({
  providers: [
    { provide: SECTION_REPOSITORY, useClass: SupabaseSectionRepository },
  ],
  exports: [SECTION_REPOSITORY],
})
export class SectionRepositoryModule {}
