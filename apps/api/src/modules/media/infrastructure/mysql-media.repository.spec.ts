import type { PrismaClient } from '../../../generated/prisma/client'
import { MySqlMediaRepository } from './mysql-media.repository'

/**
 * Só a fatia de `PrismaClient` que `MySqlMediaRepository` usa
 * (`prisma.mediaAsset.*`) — replicar o cliente inteiro gerado não se paga
 * para um dublê de unidade. `as unknown as PrismaClient` no ponto de uso é o
 * mesmo tipo de atalho que `fake-media-repository.ts` evita para os testes de
 * ponta a ponta (documentado lá); aqui, num teste que só olha para este
 * repositório, o custo do atalho é local e claro.
 */
function fakePrisma() {
  return {
    mediaAsset: {
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
  }
}

const ROW = {
  id: 'a0000000-0000-4000-8000-000000000001',
  kind: 'image',
  storagePath: 'veggiedent-images/abc/foto.png',
  publicUrl: 'http://localhost:9000/veggiedent-images/abc/foto.png',
  mimeType: 'image/png',
  sizeBytes: 2048n,
  originalFilename: 'foto.png',
  width: 800,
  height: 600,
  durationSeconds: null,
  createdAt: new Date('2026-09-21T12:00:00.000Z'),
}

describe('MySqlMediaRepository', () => {
  it('insere convertendo sizeBytes para bigint e devolve o registro traduzido de volta', async () => {
    const prisma = fakePrisma()
    prisma.mediaAsset.create.mockResolvedValue(ROW)
    const repository = new MySqlMediaRepository(prisma as unknown as PrismaClient)

    const asset = await repository.insert(
      {
        id: ROW.id,
        kind: 'image',
        storagePath: ROW.storagePath,
        publicUrl: ROW.publicUrl,
        mimeType: ROW.mimeType,
        sizeBytes: 2048,
        originalFilename: ROW.originalFilename,
        width: 800,
        height: 600,
        durationSeconds: null,
      },
      'operador-1',
    )

    expect(prisma.mediaAsset.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ sizeBytes: 2048n, createdById: 'operador-1' }),
    })
    expect(asset.sizeBytes).toBe(2048)
    expect(asset.createdAt).toBe('2026-09-21T12:00:00.000Z')
  })

  it('traduz duração de Decimal (aqui, um number vindo do banco) para number', async () => {
    const prisma = fakePrisma()
    prisma.mediaAsset.findUnique.mockResolvedValue({ ...ROW, kind: 'video', durationSeconds: 42.5 })
    const repository = new MySqlMediaRepository(prisma as unknown as PrismaClient)

    const asset = await repository.findById(ROW.id)

    expect(asset?.durationSeconds).toBe(42.5)
  })

  it('devolve null quando o identificador não existe', async () => {
    const prisma = fakePrisma()
    prisma.mediaAsset.findUnique.mockResolvedValue(null)
    const repository = new MySqlMediaRepository(prisma as unknown as PrismaClient)

    expect(await repository.findByStoragePath('nao-existe')).toBeNull()
  })

  it('some com uma linha de kind fora do conjunto conhecido, em vez de expor um valor sem sentido', async () => {
    const prisma = fakePrisma()
    prisma.mediaAsset.findUnique.mockResolvedValue({ ...ROW, kind: 'planilha' })
    const repository = new MySqlMediaRepository(prisma as unknown as PrismaClient)

    expect(await repository.findById(ROW.id)).toBeNull()
  })

  it('apaga pelo identificador', async () => {
    const prisma = fakePrisma()
    prisma.mediaAsset.delete.mockResolvedValue(ROW)
    const repository = new MySqlMediaRepository(prisma as unknown as PrismaClient)

    await repository.delete(ROW.id)

    expect(prisma.mediaAsset.delete).toHaveBeenCalledWith({ where: { id: ROW.id } })
  })
})
