import { Prisma, type PrismaClient } from '../../../generated/prisma/client'
import type { ValidatedSectionDocument } from '../domain/validated-section-document'
import { MySqlSectionRepository } from './mysql-section.repository'

interface Row {
  key: string
  data: unknown
  isPublished: boolean
  updatedAt: Date
  updatedById: string | null
}

function notFoundError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(
    'An operation failed because it depends on one or more records that were required but not found.',
    { code: 'P2025', clientVersion: 'test' },
  )
}

/**
 * Dublê do delegate `prisma.contentSection` — não do cliente inteiro.
 *
 * Mesma razão de `test/fake-supabase.ts` (que este módulo não pode tocar,
 * ver PR): a suíte não depende de rede nem de um MySQL de verdade, e o
 * repositório sob teste é código de produção de ponta a ponta. Reproduz só a
 * fatia da API do Prisma que `MySqlSectionRepository` usa (`findMany`,
 * `findUnique`, `upsert`, `update`), inclusive o erro `P2025` que o MySQL real
 * lança quando um `update` não encontra linha — sem reproduzi-lo aqui, o teste
 * do caminho "seção nunca salva" não exerceria o `catch` de verdade.
 */
class FakeContentSectionDelegate {
  private readonly rows = new Map<string, Row>()

  async findMany(): Promise<Row[]> {
    return [...this.rows.values()]
  }

  async findUnique({ where: { key } }: { where: { key: string } }): Promise<Row | null> {
    return this.rows.get(key) ?? null
  }

  async upsert({
    where: { key },
    create,
    update,
  }: {
    where: { key: string }
    create: Omit<Row, 'key'> & { key: string }
    update: Partial<Row>
  }): Promise<Row> {
    const existing = this.rows.get(key)
    const row: Row = existing ? { ...existing, ...update } : { ...create }
    this.rows.set(key, row)
    return row
  }

  async update({
    where: { key },
    data,
  }: {
    where: { key: string }
    data: Partial<Row>
  }): Promise<Row> {
    const existing = this.rows.get(key)
    if (!existing) {
      throw notFoundError()
    }
    const row: Row = { ...existing, ...data }
    this.rows.set(key, row)
    return row
  }
}

function asValidatedDocument(data: Record<string, unknown>): ValidatedSectionDocument {
  return data as unknown as ValidatedSectionDocument
}

describe('MySqlSectionRepository', () => {
  const operatorId = '9f1c2f3e-4a5b-4c6d-8e9f-0a1b2c3d4e5f'
  let contentSection: FakeContentSectionDelegate
  let repository: MySqlSectionRepository

  beforeEach(() => {
    contentSection = new FakeContentSectionDelegate()
    const prisma = { contentSection } as unknown as PrismaClient
    repository = new MySqlSectionRepository(prisma)
  })

  it('findAll devolve nenhuma seção quando nada foi salvo', async () => {
    expect(await repository.findAll()).toEqual([])
  })

  it('save grava uma seção nova e findByKey lê de volta um documento idêntico', async () => {
    const document = asValidatedDocument({ titulo: 'Escove todo dia', ordem: 1 })

    const saved = await repository.save('hero', document, operatorId)

    expect(saved).toEqual({
      key: 'hero',
      data: { titulo: 'Escove todo dia', ordem: 1 },
      isPublished: true,
      updatedAt: saved.updatedAt,
    })
    expect(await repository.findByKey('hero')).toEqual(saved)
  })

  it('save substitui o documento em uma segunda gravação (upsert, não duplica)', async () => {
    await repository.save('hero', asValidatedDocument({ titulo: 'v1' }), operatorId)
    const updated = await repository.save('hero', asValidatedDocument({ titulo: 'v2' }), operatorId)

    expect(updated.data).toEqual({ titulo: 'v2' })
    expect(await repository.findAll()).toHaveLength(1)
  })

  it('findAll devolve todas as seções gravadas, sem N+1 (uma chamada ao delegate)', async () => {
    const findMany = jest.spyOn(contentSection, 'findMany')
    await repository.save('hero', asValidatedDocument({ a: 1 }), operatorId)
    await repository.save('faq', asValidatedDocument({ b: 2 }), operatorId)

    const all = await repository.findAll()

    expect(all.map((section) => section.key).sort()).toEqual(['faq', 'hero'])
    expect(findMany).toHaveBeenCalledTimes(1)
  })

  it('findByKey devolve null para uma seção nunca gravada', async () => {
    expect(await repository.findByKey('faq')).toBeNull()
  })

  it('descarta uma linha com data fora de forma, sem quebrar a leitura (SDD § D-01)', async () => {
    await contentSection.upsert({
      where: { key: 'hero' },
      create: {
        key: 'hero',
        data: 'não é um objeto',
        isPublished: true,
        updatedAt: new Date(),
        updatedById: operatorId,
      },
      update: {},
    })

    const found = await repository.findByKey('hero')

    expect(found?.data).toEqual({})
  })

  it('setVisibility altera a visibilidade sem apagar o documento', async () => {
    await repository.save('hero', asValidatedDocument({ titulo: 'x' }), operatorId)

    const updated = await repository.setVisibility('hero', false, operatorId)

    expect(updated).not.toBeNull()
    expect(updated?.isPublished).toBe(false)
    expect(updated?.data).toEqual({ titulo: 'x' })
  })

  it('setVisibility devolve null quando a seção nunca foi salva, sem criar linha', async () => {
    const result = await repository.setVisibility('faq', true, operatorId)

    expect(result).toBeNull()
    expect(await repository.findByKey('faq')).toBeNull()
  })
})
