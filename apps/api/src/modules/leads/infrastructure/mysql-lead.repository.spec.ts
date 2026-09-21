import { Prisma, type PrismaClient } from '../../../generated/prisma/client'
import type { NewLead } from '../domain/lead'
import { toLeadPeriod } from '../domain/lead-period'
import { MySqlLeadRepository } from './mysql-lead.repository'

/**
 * O adaptador Prisma/MySQL de leads (substitui o teste que
 * `SupabaseLeadRepository` nunca teve isoladamente — a suíte anterior cobria o
 * repositório só por dentro dos testes e2e administrativos, que dependiam de
 * rede/dublê do Supabase). Aqui o `PrismaClient` é um dublê mínimo: o que
 * importa não é exercitar o MySQL de verdade, e sim confirmar que este
 * adaptador monta exatamente a consulta que a porta promete, sem duplicar (e
 * arriscar divergir de) a lógica de `brasilia-time.ts`/`lead-period.ts`.
 */

const ROW = {
  id: '11111111-1111-4111-8111-111111111111',
  nome: 'Ana Conceição',
  email: 'ana@exemplo.com',
  telefone: '11999999999',
  nomeCachorro: 'Bidu',
  porteCachorro: 'medio',
  cidadeEstado: 'São Paulo/SP',
  conheceVirbac: 'sim',
  usaProdutoVirbac: 'sim',
  qualProdutoVirbac: 'Veggiedent Fresh',
  aceiteComunicacoes: true,
  origem: 'lp-veggiedent',
  createdAt: new Date('2026-09-02T13:00:00.000Z'),
}

function fakePrisma() {
  const lead = {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
  }
  const prisma = {
    lead,
    $transaction: jest.fn((operations: readonly Promise<unknown>[]) => Promise.all(operations)),
  }
  return { prisma: prisma as unknown as PrismaClient, lead, $transaction: prisma.$transaction }
}

describe('MySqlLeadRepository', () => {
  describe('record', () => {
    it('grava o lead exatamente como recebido, sem gerar id', async () => {
      const { prisma, lead } = fakePrisma()
      lead.create.mockResolvedValue(undefined)
      const repository = new MySqlLeadRepository(prisma)

      const novo: NewLead = {
        id: ROW.id,
        nome: ROW.nome,
        email: ROW.email,
        telefone: ROW.telefone,
        nomeCachorro: ROW.nomeCachorro,
        porteCachorro: 'medio',
        cidadeEstado: ROW.cidadeEstado,
        conheceVirbac: ROW.conheceVirbac,
        usaProdutoVirbac: ROW.usaProdutoVirbac,
        qualProdutoVirbac: ROW.qualProdutoVirbac,
        aceiteComunicacoes: true,
        origem: ROW.origem,
      }

      await repository.record(novo)

      expect(lead.create).toHaveBeenCalledWith({ data: novo })
    })
  })

  describe('findById', () => {
    it('traduz a linha do Prisma para o lead do domínio', async () => {
      const { prisma, lead } = fakePrisma()
      lead.findUnique.mockResolvedValue(ROW)
      const repository = new MySqlLeadRepository(prisma)

      const encontrado = await repository.findById(ROW.id)

      expect(lead.findUnique).toHaveBeenCalledWith({ where: { id: ROW.id } })
      expect(encontrado).toEqual({
        id: ROW.id,
        nome: ROW.nome,
        email: ROW.email,
        telefone: ROW.telefone,
        nomeCachorro: ROW.nomeCachorro,
        porteCachorro: ROW.porteCachorro,
        cidadeEstado: ROW.cidadeEstado,
        conheceVirbac: ROW.conheceVirbac,
        usaProdutoVirbac: ROW.usaProdutoVirbac,
        qualProdutoVirbac: ROW.qualProdutoVirbac,
        aceiteComunicacoes: ROW.aceiteComunicacoes,
        origem: ROW.origem,
        createdAt: '2026-09-02T13:00:00.000Z',
      })
    })

    it('devolve null quando o Prisma não encontra a linha', async () => {
      const { prisma, lead } = fakePrisma()
      lead.findUnique.mockResolvedValue(null)
      const repository = new MySqlLeadRepository(prisma)

      expect(await repository.findById('inexistente')).toBeNull()
    })
  })

  describe('list', () => {
    it('sem período, não filtra por createdAt', async () => {
      const { prisma, lead } = fakePrisma()
      lead.findMany.mockResolvedValue([])
      lead.count.mockResolvedValue(0)
      const repository = new MySqlLeadRepository(prisma)

      await repository.list({ period: { from: null, to: null }, page: 1, pageSize: 50 })

      expect(lead.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 50,
      })
      expect(lead.count).toHaveBeenCalledWith({ where: {} })
    })

    it('pagina com skip/take a partir da página e do tamanho pedidos', async () => {
      const { prisma, lead } = fakePrisma()
      lead.findMany.mockResolvedValue([])
      lead.count.mockResolvedValue(0)
      const repository = new MySqlLeadRepository(prisma)

      await repository.list({ period: { from: null, to: null }, page: 3, pageSize: 20 })

      expect(lead.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 40, take: 20 }),
      )
    })

    it('devolve a página traduzida e o total, numa única transação', async () => {
      const { prisma, lead, $transaction } = fakePrisma()
      lead.findMany.mockResolvedValue([ROW])
      lead.count.mockResolvedValue(1)
      const repository = new MySqlLeadRepository(prisma)

      const pagina = await repository.list({ period: { from: null, to: null }, page: 1, pageSize: 50 })

      expect($transaction).toHaveBeenCalledTimes(1)
      expect(pagina.total).toBe(1)
      expect(pagina.leads).toEqual([expect.objectContaining({ id: ROW.id })])
    })

    /**
     * A borda que este adaptador não pode reintroduzir (SDD § C-12): o
     * período já vem em UTC, calculado por `brasilia-time.ts` a partir do dia
     * de Brasília. O adaptador só repassa `from`/`to` como `gte`/`lte` sobre
     * `createdAt` — recalculá-los aqui seria uma segunda cópia da conversão de
     * fuso, e é essa duplicação que a T18 original (SDD) já identificou como o
     * jeito mais fácil de o filtro divergir em silêncio.
     */
    it('repassa o período de Brasília para created_at sem recalcular o fuso', async () => {
      const { prisma, lead } = fakePrisma()
      lead.findMany.mockResolvedValue([])
      lead.count.mockResolvedValue(0)
      const repository = new MySqlLeadRepository(prisma)
      const period = toLeadPeriod('2026-09-02', '2026-09-02')

      await repository.list({ period, page: 1, pageSize: 50 })

      expect(lead.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            createdAt: {
              gte: '2026-09-02T03:00:00.000Z',
              lte: '2026-09-03T02:59:59.999Z',
            },
          },
        }),
      )
      expect(lead.count).toHaveBeenCalledWith({
        where: {
          createdAt: {
            gte: '2026-09-02T03:00:00.000Z',
            lte: '2026-09-03T02:59:59.999Z',
          },
        },
      })
    })

    it('filtro só com início usa apenas gte', async () => {
      const { prisma, lead } = fakePrisma()
      lead.findMany.mockResolvedValue([])
      lead.count.mockResolvedValue(0)
      const repository = new MySqlLeadRepository(prisma)
      const period = toLeadPeriod('2026-09-02')

      await repository.list({ period, page: 1, pageSize: 50 })

      const { where } = lead.findMany.mock.calls[0][0] as { where: Prisma.LeadWhereInput }
      expect(where).toEqual({ createdAt: { gte: '2026-09-02T03:00:00.000Z' } })
    })
  })

  describe('listForExport', () => {
    it('usa o mesmo filtro de período, ordenado e limitado, sem paginar', async () => {
      const { prisma, lead } = fakePrisma()
      lead.findMany.mockResolvedValue([ROW])
      const repository = new MySqlLeadRepository(prisma)
      const period = toLeadPeriod('2026-09-02', '2026-09-02')

      const exportados = await repository.listForExport(period, 10000)

      expect(lead.findMany).toHaveBeenCalledWith({
        where: {
          createdAt: {
            gte: '2026-09-02T03:00:00.000Z',
            lte: '2026-09-03T02:59:59.999Z',
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10000,
      })
      expect(exportados).toEqual([expect.objectContaining({ id: ROW.id })])
    })
  })

  describe('delete', () => {
    it('apaga a linha pelo id', async () => {
      const { prisma, lead } = fakePrisma()
      lead.delete.mockResolvedValue(ROW)
      const repository = new MySqlLeadRepository(prisma)

      await repository.delete(ROW.id)

      expect(lead.delete).toHaveBeenCalledWith({ where: { id: ROW.id } })
    })

    /**
     * O mesmo comportamento que o adaptador Supabase tinha: apagar um id que
     * já não existe não é erro (`DeleteLeadUseCase` já garantiu 404 antes de
     * chegar aqui; isto só cobre a corrida entre a checagem e o `delete`).
     */
    it('não lança quando o Prisma reporta P2025 (linha já não existe)', async () => {
      const { prisma, lead } = fakePrisma()
      lead.delete.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('registro não encontrado', {
          code: 'P2025',
          clientVersion: '0.0.0',
        }),
      )
      const repository = new MySqlLeadRepository(prisma)

      await expect(repository.delete('inexistente')).resolves.toBeUndefined()
    })

    it('propaga qualquer outro erro do Prisma', async () => {
      const { prisma, lead } = fakePrisma()
      const falhaDeConexao = new Error('conexão perdida')
      lead.delete.mockRejectedValue(falhaDeConexao)
      const repository = new MySqlLeadRepository(prisma)

      await expect(repository.delete(ROW.id)).rejects.toThrow(falhaDeConexao)
    })
  })
})
