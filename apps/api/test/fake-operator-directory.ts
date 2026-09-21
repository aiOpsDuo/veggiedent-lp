import { randomUUID } from 'node:crypto'
import { FieldValidationError } from '../src/shared/domain/field-validation.error'
import type { OperatorAccount } from '../src/modules/operators/domain/operator-account'
import type {
  CreateOperatorInput,
  OperatorDirectory,
} from '../src/modules/operators/domain/operator-directory.port'

/**
 * `OperatorDirectory` de teste — substitui `FakeSupabaseAuthAdmin` (SDD § D-09,
 * § D-10). Implementa a porta diretamente, no lugar de fingir ser o
 * `PrismaClient` inteiro só para `operators` funcionar — mesmo atalho de
 * `FakeMediaRepository` (`fake-media-repository.ts`), documentado lá: a
 * superfície gerada do Prisma é grande demais para replicar por inteiro num
 * dublê de nível de porta.
 *
 * Ao contrário da mídia (que ainda compartilha `FakeSupabaseDatabase` com os
 * módulos irmãos por causa de uma relação embutida), operadores não têm
 * nenhuma relação com outra tabela — por isso este dublê é standalone, sem
 * depender de `fake-supabase.ts`.
 */
export class FakeOperatorDirectory implements OperatorDirectory {
  private readonly operators = new Map<string, OperatorAccount>()

  /** Para o `beforeEach` de cada teste popular quem já é operador. */
  seed(operator: { id: string; email: string; name?: string; createdAt?: string }): OperatorAccount {
    const account: OperatorAccount = {
      id: operator.id,
      email: operator.email,
      name: operator.name ?? 'Operadora',
      createdAt: operator.createdAt ?? new Date().toISOString(),
    }
    this.operators.set(account.id, account)
    return account
  }

  count(): number {
    return this.operators.size
  }

  has(id: string): boolean {
    return this.operators.has(id)
  }

  async listAll(): Promise<OperatorAccount[]> {
    return [...this.operators.values()]
  }

  /** Mesma tradução de e-mail duplicado que `MySqlOperatorDirectory.create` faz para `P2002`. */
  async create(input: CreateOperatorInput): Promise<OperatorAccount> {
    if ([...this.operators.values()].some((operator) => operator.email === input.email)) {
      throw new FieldValidationError({ email: 'Este e-mail já está em uso por outro operador.' })
    }
    const account: OperatorAccount = {
      id: randomUUID(),
      email: input.email,
      name: input.name,
      createdAt: new Date().toISOString(),
    }
    this.operators.set(account.id, account)
    return account
  }

  async remove(id: string): Promise<void> {
    this.operators.delete(id)
  }
}
