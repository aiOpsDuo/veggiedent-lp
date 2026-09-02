import { Module } from '@nestjs/common'
import { MEDIA_URL_REPOSITORY } from './domain/media-url-repository.port'
import { SupabaseMediaUrlRepository } from './infrastructure/supabase-media-url.repository'

/**
 * Mídia: imagem, vídeo e legenda enviados pelo painel (T7).
 *
 * Camadas (SDD § "Visão de layers dentro da API"): `presentation/` traduz HTTP,
 * `application/` orquestra casos de uso, `domain/` guarda as regras e as portas,
 * `infrastructure/` implementa as portas. A dependência aponta sempre para
 * dentro: nada em `domain/` importa framework, Supabase ou camada de fora.
 *
 * O envio e o registro das mídias chegam na T7. O que já existe aqui é a leitura
 * das URLs públicas, exportada porque `GET /api/content` precisa entregar à LP
 * um endereço no lugar do identificador guardado (SDD § C-06 e C-07); o módulo
 * de conteúdo a lê pela porta, nunca pela tabela.
 */
@Module({
  providers: [
    { provide: MEDIA_URL_REPOSITORY, useClass: SupabaseMediaUrlRepository },
  ],
  exports: [MEDIA_URL_REPOSITORY],
})
export class MediaModule {}
