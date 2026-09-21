import { randomUUID } from 'node:crypto'
import type { PrismaClient } from '../generated/prisma/client'
import { hashPassword } from '../modules/auth/infrastructure/password-hasher'

/**
 * O bootstrap do primeiro operador (SDD § D-09, "Bootstrap do primeiro
 * operador"; PLAN.md § `migracao-mysql/gestao-operadores`).
 *
 * Sem um provedor de autenticação de terceiro, não existe mais um painel
 * externo onde criar a primeira conta de um ambiente novo — antes disso,
 * ninguém entra no painel próprio (a "armadilha" documentada em
 * `docs/MIGRAR-PARA-NOVO-SUPABASE.md`). Este módulo é a lógica pura do
 * comando `npm run seed:operator`
 * (`seed-operator.main.ts` lê variáveis de ambiente e chama o que está aqui,
 * mesma separação de `seed-from-snapshot.ts`/`main.ts`: a lógica recebe tudo
 * por parâmetro, só o `main` lê `process.env` e escreve na saída padrão).
 */

export interface SeedOperatorInput {
  readonly email: string
  readonly password: string
  readonly name: string
}

export interface SeedOperatorResult {
  readonly id: string
  readonly email: string
}

/**
 * Rodar duas vezes com o mesmo e-mail não sobrescreve nem ignora em silêncio
 * — recusa com uma mensagem clara. Sobrescrever trocaria a senha de uma conta
 * já em uso sem quem a criou saber; ignorar faria `npm run seed:operator`
 * mentir que criou algo quando não criou nada. Recusar é o único dos três
 * comportamentos que não engana quem roda o comando.
 */
export class OperatorAlreadyExistsError extends Error {
  constructor(email: string) {
    super(`Já existe um operador com o e-mail ${email} — nada foi alterado.`)
    this.name = 'OperatorAlreadyExistsError'
  }
}

/**
 * Grava o operador direto na tabela `operators`, fora dos endpoints
 * administrativos (que exigem um operador já autenticado — inexistente num
 * ambiente novo). Mesmo hash de senha do resto do sistema (`hashPassword`,
 * argon2id, D-03), e o mesmo padrão de identificador gerado pela aplicação
 * (`randomUUID()`) que `MySqlOperatorDirectory.create` usa.
 */
export async function seedOperator(
  prisma: PrismaClient,
  input: SeedOperatorInput,
): Promise<SeedOperatorResult> {
  const existing = await prisma.operator.findUnique({ where: { email: input.email } })
  if (existing !== null) {
    throw new OperatorAlreadyExistsError(input.email)
  }

  const passwordHash = await hashPassword(input.password)
  const created = await prisma.operator.create({
    data: { id: randomUUID(), email: input.email, passwordHash, name: input.name },
  })

  return { id: created.id, email: created.email }
}
