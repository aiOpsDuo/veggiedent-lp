import type { PrismaClient } from '../generated/prisma/client'
import { verifyPassword } from '../modules/auth/infrastructure/password-hasher'
import { OperatorAlreadyExistsError, seedOperator } from './seed-operator'

/**
 * O bootstrap do primeiro operador (SDD § D-09, "Bootstrap do primeiro
 * operador"). Só a lógica pura — `seed-operator.main.ts` (leitura de
 * `process.env` e `PrismaClient` real) não é testada aqui, mesmo padrão de
 * `main.ts`/`seed-from-snapshot.spec.ts` não existir para o comando de
 * conteúdo.
 */

function fakePrisma() {
  return {
    operator: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  }
}

const INPUT = {
  email: 'primeira.operadora@veggiedent.test',
  password: 'senha-inicial-forte',
  name: 'Primeira Operadora',
}

const UUID_FORMAT = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

describe('seedOperator', () => {
  it('grava o operador com o id gerado pela aplicação e a senha em hash, quando o e-mail ainda não existe', async () => {
    const prisma = fakePrisma()
    prisma.operator.findUnique.mockResolvedValue(null)
    prisma.operator.create.mockImplementation(({ data }: { data: { id: string; email: string; passwordHash: string; name: string } }) =>
      Promise.resolve({ ...data, createdAt: new Date('2026-09-21T00:00:00.000Z') }),
    )

    const result = await seedOperator(prisma as unknown as PrismaClient, INPUT)

    expect(prisma.operator.findUnique).toHaveBeenCalledWith({ where: { email: INPUT.email } })
    expect(result).toEqual({ id: expect.stringMatching(UUID_FORMAT), email: INPUT.email })

    const { data } = prisma.operator.create.mock.calls[0][0] as {
      data: { id: string; email: string; passwordHash: string; name: string }
    }
    expect(data.name).toBe(INPUT.name)
    expect(data.passwordHash).not.toBe(INPUT.password)
    await expect(verifyPassword(data.passwordHash, INPUT.password)).resolves.toBe(true)
  })

  it('recusa com OperatorAlreadyExistsError quando o e-mail já está cadastrado, sem chamar create', async () => {
    const prisma = fakePrisma()
    prisma.operator.findUnique.mockResolvedValue({
      id: 'ja-existe',
      email: INPUT.email,
      passwordHash: 'hash-antigo',
      name: 'Já Existe',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    })

    await expect(seedOperator(prisma as unknown as PrismaClient, INPUT)).rejects.toThrow(
      OperatorAlreadyExistsError,
    )
    expect(prisma.operator.create).not.toHaveBeenCalled()
  })
})
