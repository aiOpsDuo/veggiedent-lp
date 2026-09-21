import { parseEnvironment } from '../config/environment'
import { MIN_OPERATOR_PASSWORD_LENGTH } from '../modules/operators/presentation/create-operator.dto'
import { createPrismaClient } from '../shared/infrastructure/prisma-client'
import { seedOperator } from './seed-operator'

/**
 * Comando do bootstrap do primeiro operador (SDD § D-09; PLAN.md
 * § `migracao-mysql/gestao-operadores`):
 *
 *   npm run seed:operator -w apps/api
 *
 * Variáveis de ambiente (junto das que a API já exige, ver
 * `config/environment.schema.ts` — este comando abre o mesmo `DATABASE_URL`):
 *
 *   SEED_OPERATOR_EMAIL     e-mail do operador novo
 *   SEED_OPERATOR_PASSWORD  senha inicial (mínimo de caracteres igual ao do
 *                           painel — `CreateOperatorDto.MIN_OPERATOR_PASSWORD_LENGTH`)
 *   SEED_OPERATOR_NAME      nome exibido no painel
 *
 * Por que variável de ambiente, não argumento de linha de comando: é o jeito
 * mais simples de passar um segredo (a senha) a um `docker compose exec` sem
 * ele ficar visível no histórico do shell nem na lista de processos (`ps`) do
 * host — um argumento posicional apareceria nos dois. O mesmo padrão que
 * `CMS_OPERATOR_EMAIL`/`CMS_OPERATOR_PASSWORD` já usam em `main.ts`.
 *
 * Seguro rodar mais de uma vez: um e-mail já cadastrado é recusado com uma
 * mensagem clara (`OperatorAlreadyExistsError`), sem sobrescrever a conta
 * existente nem fingir que criou uma nova.
 *
 * Este é o único arquivo do comando que lê variável de ambiente e escreve na
 * saída padrão — `seed-operator.ts` recebe tudo por parâmetro, mesma
 * separação de `seed-from-snapshot.ts`/`main.ts`.
 */

function required(name: string): string {
  const value = process.env[name]
  if (value === undefined || value.trim() === '') {
    throw new Error(`Defina ${name}.`)
  }
  return value
}

function readInput(): { email: string; password: string; name: string } {
  const email = required('SEED_OPERATOR_EMAIL')
  const password = required('SEED_OPERATOR_PASSWORD')
  const name = required('SEED_OPERATOR_NAME')

  if (password.length < MIN_OPERATOR_PASSWORD_LENGTH) {
    throw new Error(
      `SEED_OPERATOR_PASSWORD precisa ter pelo menos ${MIN_OPERATOR_PASSWORD_LENGTH} caracteres.`,
    )
  }

  return { email, password, name }
}

async function run(): Promise<void> {
  const input = readInput()
  const environment = parseEnvironment(process.env)
  const prisma = createPrismaClient(environment)

  try {
    const created = await seedOperator(prisma, input)
    process.stdout.write(`Operador criado: ${created.email} (${created.id})\n`)
  } finally {
    await prisma.$disconnect()
  }
}

run().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
