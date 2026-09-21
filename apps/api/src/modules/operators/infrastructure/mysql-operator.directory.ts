import { randomUUID } from 'node:crypto'
import { Inject, Injectable } from '@nestjs/common'
import { Prisma, type PrismaClient } from '../../../generated/prisma/client'
import { FieldValidationError } from '../../../shared/domain/field-validation.error'
import { PRISMA_CLIENT } from '../../../shared/infrastructure/prisma-client'
import { hashPassword } from '../../auth/infrastructure/password-hasher'
import type { OperatorAccount } from '../domain/operator-account'
import type { CreateOperatorInput, OperatorDirectory } from '../domain/operator-directory.port'

/** Código do Prisma para "violação de restrição única" (aqui, `operators.email`). */
const UNIQUE_CONSTRAINT_VIOLATION = 'P2002'

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === UNIQUE_CONSTRAINT_VIOLATION
  )
}

/** A forma como o Prisma devolve a linha de `operators` — sem `passwordHash`, nunca lido fora do hashing/verificação de senha. */
interface OperatorRow {
  id: string
  email: string
  name: string
  createdAt: Date
}

function toOperatorAccount(row: OperatorRow): OperatorAccount {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
  }
}

/**
 * Os operadores sobre o Prisma/MySQL — substitui `SupabaseOperatorDirectory`
 * (SDD § D-09, § D-10). Diferente do adaptador que substitui, fala direto com
 * a tabela `operators` (`prisma.operator.*`), não com um provedor de
 * identidade externo — a aplicação passa a ser dona do hash de senha, feito
 * aqui com `hashPassword` (mesmo algoritmo argon2id de D-03/`auth`).
 *
 * `create` gera o identificador (`randomUUID()`) e faz o hash antes de
 * inserir: ao contrário de `leads`/`media` (onde o caso de uso já gera o `id`
 * e o repositório só grava o que recebe), aqui é o adaptador quem gera,
 * porque `CreateOperatorInput` — a porta que `CreateOperatorUseCase` já usa e
 * que esta tarefa não altera — não carrega um campo `id`; inventar um agora
 * mudaria a porta para um único consumidor (o teste), sem necessidade real.
 */
@Injectable()
export class MySqlOperatorDirectory implements OperatorDirectory {
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  async listAll(): Promise<OperatorAccount[]> {
    const rows = await this.prisma.operator.findMany()
    return rows.map(toOperatorAccount)
  }

  /**
   * Um e-mail já cadastrado esbarra na unicidade de `operators.email`
   * (`@unique` em `schema.prisma`) — traduzido aqui para `FieldValidationError`
   * (`422`, o mesmo formato de erro por campo que o resto da API já usa),
   * porque é exatamente isso: um dado inválido pelo motivo "já existe", não
   * uma falha de infraestrutura. Não é preciso inventar um erro de domínio
   * novo para isso (proporcionalidade) — `FieldValidationError` já cobre a
   * forma exata da resposta que este caso pede.
   */
  async create(input: CreateOperatorInput): Promise<OperatorAccount> {
    const passwordHash = await hashPassword(input.password)
    try {
      const row = await this.prisma.operator.create({
        data: { id: randomUUID(), email: input.email, passwordHash, name: input.name },
      })
      return toOperatorAccount(row)
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new FieldValidationError({ email: 'Este e-mail já está em uso por outro operador.' })
      }
      throw error
    }
  }

  /**
   * Sem tratamento especial de "id já não existe" (`P2025`): diferente de
   * `MySqlLeadRepository.delete`, `RemoveOperatorUseCase.execute` já confere
   * `listAll()` e recusa com `ResourceNotFoundError` **antes** de chamar este
   * método (ver o caso de uso) — o único jeito de este `delete` ver um id
   * inexistente é uma corrida entre duas remoções concorrentes do mesmo
   * operador, janela rara demais para justificar engolir a exceção aqui.
   */
  async remove(id: string): Promise<void> {
    await this.prisma.operator.delete({ where: { id } })
  }
}
