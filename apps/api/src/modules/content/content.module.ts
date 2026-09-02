import { Module } from '@nestjs/common'

/**
 * Conteúdo das seções da LP (T6).
 *
 * Camadas (SDD § "Visão de layers dentro da API"): `presentation/` traduz HTTP,
 * `application/` orquestra casos de uso, `domain/` guarda as regras e as portas,
 * `infrastructure/` implementa as portas. A dependência aponta sempre para
 * dentro: nada em `domain/` importa framework, Supabase ou camada de fora.
 */
@Module({})
export class ContentModule {}
