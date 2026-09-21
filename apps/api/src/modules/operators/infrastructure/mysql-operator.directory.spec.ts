import { Prisma, type PrismaClient } from '../../../generated/prisma/client'
import { FieldValidationError } from '../../../shared/domain/field-validation.error'
import { verifyPassword } from '../../auth/infrastructure/password-hasher'
import { MySqlOperatorDirectory } from './mysql-operator.directory'

/**
 * Só a fatia de `PrismaClient` que `MySqlOperatorDirectory` usa
 * (`prisma.operator.*`) — mesmo atalho de `mysql-media.repository.spec.ts` e
 * `mysql-lead.repository.spec.ts`, documentado lá.
 */
function fakePrisma() {
  return {
    operator: {
      findMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
  }
}

const ROW = {
  id: 'a0000000-0000-4000-8000-000000000001',
  email: 'operadora@veggiedent.test',
  name: 'Operadora',
  createdAt: new Date('2026-09-21T12:00:00.000Z'),
}

const UUID_FORMAT = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

describe('MySqlOperatorDirectory', () => {
  it('lista os operadores traduzidos, sem expor passwordHash', async () => {
    const prisma = fakePrisma()
    prisma.operator.findMany.mockResolvedValue([ROW])
    const directory = new MySqlOperatorDirectory(prisma as unknown as PrismaClient)

    const operators = await directory.listAll()

    expect(operators).toEqual([
      { id: ROW.id, email: ROW.email, name: ROW.name, createdAt: '2026-09-21T12:00:00.000Z' },
    ])
  })

  it('cria com o id gerado pela aplicação e a senha em hash argon2id, nunca em texto puro', async () => {
    const prisma = fakePrisma()
    prisma.operator.create.mockImplementation(({ data }: { data: OperatorCreateData }) =>
      Promise.resolve({ id: data.id, email: data.email, name: data.name, createdAt: ROW.createdAt }),
    )
    const directory = new MySqlOperatorDirectory(prisma as unknown as PrismaClient)

    const account = await directory.create({
      email: 'nova.operadora@veggiedent.test',
      password: 'senha-inicial-forte',
      name: 'Nova Operadora',
    })

    expect(prisma.operator.create).toHaveBeenCalledTimes(1)
    const { data } = prisma.operator.create.mock.calls[0][0] as { data: OperatorCreateData }
    expect(data.id).toMatch(UUID_FORMAT)
    expect(data.email).toBe('nova.operadora@veggiedent.test')
    expect(data.name).toBe('Nova Operadora')
    expect(data.passwordHash).not.toBe('senha-inicial-forte')
    await expect(verifyPassword(data.passwordHash, 'senha-inicial-forte')).resolves.toBe(true)

    expect(account).toEqual({
      id: data.id,
      email: 'nova.operadora@veggiedent.test',
      name: 'Nova Operadora',
      createdAt: '2026-09-21T12:00:00.000Z',
    })
  })

  it('traduz violação de e-mail único (P2002) para FieldValidationError, em vez de deixar o erro do Prisma vazar', async () => {
    const prisma = fakePrisma()
    prisma.operator.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '0.0.0',
      }),
    )
    const directory = new MySqlOperatorDirectory(prisma as unknown as PrismaClient)

    await expect(
      directory.create({ email: ROW.email, password: 'qualquer-senha', name: 'Qualquer' }),
    ).rejects.toThrow(FieldValidationError)
    await expect(
      directory.create({ email: ROW.email, password: 'qualquer-senha', name: 'Qualquer' }),
    ).rejects.toMatchObject({ fields: { email: expect.any(String) } })
  })

  it('propaga qualquer outro erro do Prisma na criação', async () => {
    const prisma = fakePrisma()
    const outroErro = new Error('conexão perdida')
    prisma.operator.create.mockRejectedValue(outroErro)
    const directory = new MySqlOperatorDirectory(prisma as unknown as PrismaClient)

    await expect(
      directory.create({ email: ROW.email, password: 'qualquer-senha', name: 'Qualquer' }),
    ).rejects.toThrow(outroErro)
  })

  it('remove pelo identificador, sem tratamento especial — o caso de uso já garante existência antes', async () => {
    const prisma = fakePrisma()
    prisma.operator.delete.mockResolvedValue(ROW)
    const directory = new MySqlOperatorDirectory(prisma as unknown as PrismaClient)

    await directory.remove(ROW.id)

    expect(prisma.operator.delete).toHaveBeenCalledWith({ where: { id: ROW.id } })
  })
})

interface OperatorCreateData {
  id: string
  email: string
  passwordHash: string
  name: string
}
