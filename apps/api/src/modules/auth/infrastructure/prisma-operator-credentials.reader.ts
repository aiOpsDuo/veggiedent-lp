import { Inject, Injectable } from '@nestjs/common'
import { PRISMA_CLIENT } from '../../../shared/infrastructure/prisma-client'
import type { PrismaClient } from '../../../generated/prisma/client'
import type {
  OperatorCredentials,
  OperatorCredentialsReader,
} from '../domain/operator-credentials-reader.port'

/**
 * Implementação de `OperatorCredentialsReader` sobre a tabela `operators`
 * (Prisma/MySQL, SDD § D-10). Adaptador estreito, de propósito: só lê por
 * e-mail, só o que o login precisa. Não é `OperatorDirectory` (listar, criar,
 * remover) — essa porta pertence ao módulo `operators`, tarefa futura
 * `migracao-mysql/gestao-operadores`; as duas convivem sobre a mesma tabela.
 */
@Injectable()
export class PrismaOperatorCredentialsReader implements OperatorCredentialsReader {
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  async findByEmail(email: string): Promise<OperatorCredentials | null> {
    const operator = await this.prisma.operator.findUnique({ where: { email } })
    if (operator === null) {
      return null
    }
    return { id: operator.id, email: operator.email, passwordHash: operator.passwordHash }
  }
}
