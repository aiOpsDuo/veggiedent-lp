import { Global, Inject, Module, type OnModuleDestroy } from '@nestjs/common'
import { ENVIRONMENT } from '../../config/environment'
import type { PrismaClient } from '../../generated/prisma/client'
import { PRISMA_CLIENT, createPrismaClient } from './prisma-client'

/**
 * Um único cliente Prisma para o processo inteiro — substitui `SupabaseModule`
 * (SDD § D-10).
 *
 * Global pelo mesmo motivo de `SupabaseModule`: os módulos de conteúdo,
 * metadados, mídia, leads e operadores precisam do mesmo cliente: declará-lo
 * em um só lugar mantém a leitura de `DATABASE_URL` em um só lugar. O que é
 * global é o *cliente*, não o acesso: continuam sendo apenas os adaptadores de
 * infraestrutura que o injetam.
 *
 * Desligamento gracioso: o módulo fecha o pool de conexões em
 * `onModuleDestroy`, para não deixar conexões penduradas no MySQL quando o
 * processo termina. Isso só é exercitado quando `app.enableShutdownHooks()`
 * está ligado em `main.ts` — o Nest não escuta sinais do sistema operacional
 * por padrão (custo de performance para quem não precisa) — por isso esta
 * tarefa também liga o hook lá.
 */
@Global()
@Module({
  providers: [
    {
      provide: PRISMA_CLIENT,
      inject: [ENVIRONMENT],
      useFactory: createPrismaClient,
    },
  ],
  exports: [PRISMA_CLIENT],
})
export class PrismaModule implements OnModuleDestroy {
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  async onModuleDestroy(): Promise<void> {
    await this.prisma.$disconnect()
  }
}
