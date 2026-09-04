import { Module } from '@nestjs/common'
import { SectionRepositoryModule } from '../content/section-repository.module'
import { MetadataModule } from '../metadata/metadata.module'
import { DeleteMediaUseCase } from './application/delete-media.use-case'
import { GetMediaUseCase } from './application/get-media.use-case'
import { IssueUploadCredentialUseCase } from './application/issue-upload-credential.use-case'
import { RegisterMediaUseCase } from './application/register-media.use-case'
import { MEDIA_REFERENCE_FINDER } from './domain/media-reference-finder.port'
import { MEDIA_REPOSITORY } from './domain/media-repository.port'
import { MEDIA_STORAGE } from './domain/media-storage.port'
import { MEDIA_URL_REPOSITORY } from './domain/media-url-repository.port'
import { ContentMediaReferenceFinder } from './infrastructure/content-media-reference.finder'
import { SupabaseMediaRepository } from './infrastructure/supabase-media.repository'
import { SupabaseMediaStorage } from './infrastructure/supabase-media-storage'
import { SupabaseMediaUrlRepository } from './infrastructure/supabase-media-url.repository'
import { AdminMediaController } from './presentation/admin-media.controller'

/**
 * Mídia: imagem e vídeo enviados pelo painel (T7).
 *
 * Camadas (SDD § "Visão de layers dentro da API"): `presentation/` traduz HTTP,
 * `application/` orquestra casos de uso, `domain/` guarda as regras e as portas,
 * `infrastructure/` implementa as portas. A dependência aponta sempre para
 * dentro: nada em `domain/` importa framework, Supabase ou camada de fora.
 *
 * São quatro portas, estreitas de propósito (ISP): a que resolve identificador
 * em URL para o conteúdo publicado, a que registra e remove, a que fala com o
 * armazenamento e a que responde quem está usando uma mídia. Cada consumidor
 * depende só da que usa, e os testes trocam qualquer uma delas sozinha.
 *
 * Os dois módulos importados são o que sustenta a recusa de remoção da mídia em
 * uso (`409`): as seções e os metadados são lidos pelas portas dos módulos
 * donos deles, nunca pelas tabelas. `SectionRepositoryModule` existe para que
 * essa leitura não crie um ciclo com `ContentModule` — a justificativa está lá.
 *
 * `MEDIA_URL_REPOSITORY` continua exportado porque `GET /api/content` entrega à
 * LP um endereço no lugar do identificador guardado (SDD § C-06 e C-07).
 */
@Module({
  imports: [SectionRepositoryModule, MetadataModule],
  controllers: [AdminMediaController],
  providers: [
    { provide: MEDIA_URL_REPOSITORY, useClass: SupabaseMediaUrlRepository },
    { provide: MEDIA_REPOSITORY, useClass: SupabaseMediaRepository },
    { provide: MEDIA_STORAGE, useClass: SupabaseMediaStorage },
    { provide: MEDIA_REFERENCE_FINDER, useClass: ContentMediaReferenceFinder },
    IssueUploadCredentialUseCase,
    RegisterMediaUseCase,
    GetMediaUseCase,
    DeleteMediaUseCase,
  ],
  exports: [MEDIA_URL_REPOSITORY],
})
export class MediaModule {}
