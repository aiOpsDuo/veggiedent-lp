import type { PrismaClient } from '../../../generated/prisma/client'
import { MySqlMediaUrlRepository } from './mysql-media-url.repository'

function fakePrisma() {
  return { mediaAsset: { findMany: jest.fn() } }
}

describe('MySqlMediaUrlRepository', () => {
  it('não consulta nada quando não há identificador', async () => {
    const prisma = fakePrisma()
    const repository = new MySqlMediaUrlRepository(prisma as unknown as PrismaClient)

    const urls = await repository.findPublicUrls([])

    expect(urls.size).toBe(0)
    expect(prisma.mediaAsset.findMany).not.toHaveBeenCalled()
  })

  /** Risco R-05: uma única consulta (`findMany` com `in`), qualquer que seja a quantidade de ids. */
  it('resolve todos os identificadores em uma única consulta', async () => {
    const prisma = fakePrisma()
    prisma.mediaAsset.findMany.mockResolvedValue([
      { id: 'a', publicUrl: 'http://x/a.png' },
      { id: 'b', publicUrl: 'http://x/b.png' },
    ])
    const repository = new MySqlMediaUrlRepository(prisma as unknown as PrismaClient)

    const urls = await repository.findPublicUrls(['a', 'b', 'c'])

    expect(prisma.mediaAsset.findMany).toHaveBeenCalledTimes(1)
    expect(prisma.mediaAsset.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['a', 'b', 'c'] } },
      select: { id: true, publicUrl: true },
    })
    expect(urls).toEqual(new Map([['a', 'http://x/a.png'], ['b', 'http://x/b.png']]))
  })
})
