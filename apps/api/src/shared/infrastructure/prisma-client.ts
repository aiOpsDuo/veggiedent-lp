import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import { PrismaClient } from '../../generated/prisma/client'
import type { Environment } from '../../config/environment.schema'

/** Token de injeção do cliente Prisma. Só a infraestrutura o injeta. */
export const PRISMA_CLIENT = Symbol('PrismaClient')

/**
 * Cliente Prisma do servidor (SDD § D-10). Todo acesso ao MySQL passa por
 * aqui, através dos repositórios de
 * infraestrutura de cada módulo (`content`, `metadata`, `media`, `leads`,
 * `operators`); nenhuma outra camada importa `PrismaClient` diretamente.
 *
 * A partir do Prisma ORM 7 o `PrismaClient` não aceita mais uma URL de
 * conexão direta (`datasourceUrl`): ele exige um *driver adapter*. Para
 * MySQL, o adapter oficial é `@prisma/adapter-mariadb` (o driver `mariadb` é
 * compatível com MySQL — não há um `@prisma/adapter-mysql` separado). O
 * adapter aceita a própria connection string de `DATABASE_URL` (formato
 * `mysql://usuario:senha@host:porta/banco`, já validado por
 * `environment.schema.ts`), sem precisar quebrá-la em host/porta/usuário.
 */
export function createPrismaClient(environment: Environment): PrismaClient {
  const adapter = new PrismaMariaDb(environment.DATABASE_URL)
  return new PrismaClient({ adapter })
}
