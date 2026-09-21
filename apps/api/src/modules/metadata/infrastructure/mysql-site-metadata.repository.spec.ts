import type { PrismaClient } from '../../../generated/prisma/client'
import { validateMetadata } from '../domain/validated-site-metadata'
import { MySqlSiteMetadataRepository } from './mysql-site-metadata.repository'

const OPERATOR_ID = '9f1c2f3e-4a5b-4c6d-8e9f-0a1b2c3d4e5f'
const MEDIA_ID = '00000000-0000-4000-8000-0000000000aa'

/**
 * Dublê do cliente Prisma, no nível da porta de repositório — não do banco.
 * Unitário e rápido (T9/F.I.R.S.T. de `references/clean-code.md`): só prova a
 * tradução entre `SiteMetadataRepository` e as chamadas de `siteMetadata.*`
 * que este adaptador faz. O caminho contra um MySQL real é coberto pela
 * suíte e2e (`test/admin-metadados.e2e-spec.ts`), que sobe a aplicação
 * inteira.
 */
function fakePrisma(): {
  prisma: PrismaClient
  findUnique: jest.Mock
  upsert: jest.Mock
} {
  const findUnique = jest.fn()
  const upsert = jest.fn()
  const prisma = { siteMetadata: { findUnique, upsert } } as unknown as PrismaClient
  return { prisma, findUnique, upsert }
}

describe('MySqlSiteMetadataRepository.find', () => {
  it('devolve null quando não há registro', async () => {
    const { prisma, findUnique } = fakePrisma()
    findUnique.mockResolvedValue(null)

    const result = await new MySqlSiteMetadataRepository(prisma).find()

    expect(result).toBeNull()
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'default' } }),
    )
  })

  it('resolve a URL pública da imagem na mesma consulta', async () => {
    const { prisma, findUnique } = fakePrisma()
    findUnique.mockResolvedValue({
      title: 'Título',
      description: 'Descrição',
      ogImageMediaId: MEDIA_ID,
      ogImageAlt: 'Cão sorrindo',
      updatedAt: new Date('2026-09-21T12:00:00.000Z'),
      ogImage: { publicUrl: 'https://midia.exemplo/og.png' },
    })

    const result = await new MySqlSiteMetadataRepository(prisma).find()

    expect(result).toEqual({
      document: {
        title: 'Título',
        description: 'Descrição',
        ogImage: MEDIA_ID,
        ogImageAlt: 'Cão sorrindo',
      },
      ogImageUrl: 'https://midia.exemplo/og.png',
      updatedAt: '2026-09-21T12:00:00.000Z',
    })
  })

  it('trata campos ausentes como ausentes do documento, não como texto vazio', async () => {
    const { prisma, findUnique } = fakePrisma()
    findUnique.mockResolvedValue({
      title: null,
      description: null,
      ogImageMediaId: null,
      ogImageAlt: null,
      updatedAt: new Date('2026-09-21T12:00:00.000Z'),
      ogImage: null,
    })

    const result = await new MySqlSiteMetadataRepository(prisma).find()

    expect(result?.document).toEqual({})
    expect(result?.ogImageUrl).toBeNull()
  })
})

describe('MySqlSiteMetadataRepository.save', () => {
  it('grava no registro único, gravando texto vazio como null', async () => {
    const { prisma, upsert } = fakePrisma()
    upsert.mockResolvedValue({
      title: 'Título',
      description: 'Descrição',
      ogImageMediaId: null,
      ogImageAlt: null,
      updatedAt: new Date('2026-09-21T12:00:00.000Z'),
      ogImage: null,
    })
    const documento = validateMetadata({ title: 'Título', description: 'Descrição' })

    await new MySqlSiteMetadataRepository(prisma).save(documento, OPERATOR_ID)

    expect(upsert).toHaveBeenCalledWith({
      where: { id: 'default' },
      create: expect.objectContaining({
        id: 'default',
        title: 'Título',
        description: 'Descrição',
        ogImageMediaId: null,
        ogImageAlt: null,
        updatedById: OPERATOR_ID,
      }),
      update: expect.objectContaining({
        title: 'Título',
        description: 'Descrição',
        ogImageMediaId: null,
        ogImageAlt: null,
        updatedById: OPERATOR_ID,
      }),
      select: expect.anything(),
    })
  })

  it('guarda e devolve o texto alternativo e a URL da imagem de compartilhamento', async () => {
    const { prisma, upsert } = fakePrisma()
    upsert.mockResolvedValue({
      title: 'Título',
      description: 'Descrição',
      ogImageMediaId: MEDIA_ID,
      ogImageAlt: 'Cão sorrindo',
      updatedAt: new Date('2026-09-21T12:00:00.000Z'),
      ogImage: { publicUrl: 'https://midia.exemplo/og.png' },
    })
    const documento = validateMetadata({
      title: 'Título',
      description: 'Descrição',
      ogImage: MEDIA_ID,
      ogImageAlt: 'Cão sorrindo',
    })

    const result = await new MySqlSiteMetadataRepository(prisma).save(documento, OPERATOR_ID)

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ ogImageMediaId: MEDIA_ID, ogImageAlt: 'Cão sorrindo' }),
        update: expect.objectContaining({ ogImageMediaId: MEDIA_ID, ogImageAlt: 'Cão sorrindo' }),
      }),
    )
    expect(result.document).toEqual({
      title: 'Título',
      description: 'Descrição',
      ogImage: MEDIA_ID,
      ogImageAlt: 'Cão sorrindo',
    })
    expect(result.ogImageUrl).toBe('https://midia.exemplo/og.png')
  })
})
