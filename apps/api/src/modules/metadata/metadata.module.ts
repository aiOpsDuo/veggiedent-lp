import { Module } from '@nestjs/common'
import { GetSeoMetadataUseCase } from './application/get-seo-metadata.use-case'
import { GetSiteMetadataUseCase } from './application/get-site-metadata.use-case'
import { SaveSiteMetadataUseCase } from './application/save-site-metadata.use-case'
import { SITE_METADATA_REPOSITORY } from './domain/site-metadata-repository.port'
import { SupabaseSiteMetadataRepository } from './infrastructure/supabase-site-metadata.repository'
import { AdminMetadataController } from './presentation/admin-metadata.controller'
import { PublicSeoController } from './presentation/public-seo.controller'

/**
 * Metadados da página usados por buscadores e previews (T6).
 *
 * Camadas (SDD § "Visão de layers dentro da API"): `presentation/` traduz HTTP,
 * `application/` orquestra casos de uso, `domain/` guarda as regras e as portas,
 * `infrastructure/` implementa as portas. A dependência aponta sempre para
 * dentro: nada em `domain/` importa framework, Supabase ou camada de fora.
 *
 * A porta é exportada porque `GET /api/content` entrega conteúdo e metadados na
 * mesma resposta (SDD § "Contratos de dados/API"); o módulo de conteúdo lê os
 * metadados pela porta, nunca pela tabela.
 */
@Module({
  controllers: [PublicSeoController, AdminMetadataController],
  providers: [
    {
      provide: SITE_METADATA_REPOSITORY,
      useClass: SupabaseSiteMetadataRepository,
    },
    GetSeoMetadataUseCase,
    GetSiteMetadataUseCase,
    SaveSiteMetadataUseCase,
  ],
  exports: [SITE_METADATA_REPOSITORY],
})
export class MetadataModule {}
