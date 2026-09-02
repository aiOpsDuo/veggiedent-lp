import { Module } from '@nestjs/common'
import { MediaModule } from '../media/media.module'
import { MetadataModule } from '../metadata/metadata.module'
import { GetPublishedContentUseCase } from './application/get-published-content.use-case'
import { GetSectionUseCase } from './application/get-section.use-case'
import { ListSectionsUseCase } from './application/list-sections.use-case'
import { SaveSectionUseCase } from './application/save-section.use-case'
import { SetSectionVisibilityUseCase } from './application/set-section-visibility.use-case'
import { AdminSectionsController } from './presentation/admin-sections.controller'
import { PublicContentController } from './presentation/public-content.controller'
import { SectionRepositoryModule } from './section-repository.module'

/**
 * Conteúdo das seções da LP (T6).
 *
 * Camadas (SDD § "Visão de layers dentro da API"): `presentation/` traduz HTTP,
 * `application/` orquestra casos de uso, `domain/` guarda as regras e as portas,
 * `infrastructure/` implementa as portas. A dependência aponta sempre para
 * dentro: nada em `domain/` importa framework, Supabase ou camada de fora.
 *
 * O repositório entra pelo token da porta, e não pela classe: trocar Supabase
 * por outra coisa é trocar uma linha em `SectionRepositoryModule`, e os testes
 * trocam por um dublê sem tocar em nenhum caso de uso. Ele vive em módulo
 * próprio para que a mídia possa consultá-lo sem ciclo — a razão está lá.
 *
 * Os outros dois módulos importados entram pelo mesmo motivo: `GET /api/content`
 * é uma resposta agregada. Os metadados vão na mesma resposta (SDD § "Contratos de
 * dados/API") e as referências de mídia saem resolvidas em URL pública
 * (SDD § C-06 e C-07) — sempre pelas portas dos módulos donos desses dados,
 * nunca lendo as tabelas deles.
 */
@Module({
  imports: [SectionRepositoryModule, MetadataModule, MediaModule],
  controllers: [PublicContentController, AdminSectionsController],
  providers: [
    GetPublishedContentUseCase,
    ListSectionsUseCase,
    GetSectionUseCase,
    SaveSectionUseCase,
    SetSectionVisibilityUseCase,
  ],
})
export class ContentModule {}
