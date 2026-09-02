import { HttpStatus } from '@nestjs/common'
import { SECTION_KEYS } from '@veggiedent/content-schema'
import request from 'supertest'
import { exampleDocument } from './documento-de-exemplo'
import { OPERATOR_ID, startContentHarness, type ContentHarness } from './content-harness'

const AGORA = '2026-09-01T09:30:00.000Z'

describe('rotas administrativas de seção', () => {
  let harness: ContentHarness

  beforeEach(async () => {
    harness = await startContentHarness()
  })

  afterEach(async () => {
    await harness.close()
  })

  const autenticado = (): request.Agent => request.agent(harness.app.getHttpServer())
  const comToken = (req: request.Test): request.Test =>
    req.set('authorization', `Bearer ${harness.token}`)

  describe('sem token', () => {
    const rotas: [string, () => request.Test][] = [
      ['GET /api/admin/sections', () => autenticado().get('/api/admin/sections')],
      ['GET /api/admin/sections/:key', () => autenticado().get('/api/admin/sections/faq')],
      ['PUT /api/admin/sections/:key', () => autenticado().put('/api/admin/sections/faq').send({})],
      [
        'PATCH /api/admin/sections/:key/visibility',
        () => autenticado().patch('/api/admin/sections/faq/visibility').send({ isPublished: false }),
      ],
    ]

    it.each(rotas)('%s responde 401', async (_nome, chamar) => {
      const response = await chamar()

      expect(response.status).toBe(HttpStatus.UNAUTHORIZED)
      expect(response.body).toEqual({
        statusCode: HttpStatus.UNAUTHORIZED,
        error: 'Autenticação necessária.',
      })
    })

    it('não grava nada ao recusar', async () => {
      await autenticado().put('/api/admin/sections/faq').send(exampleDocument('faq'))

      expect(harness.database.rows('content_sections')).toHaveLength(0)
    })
  })

  describe('GET /api/admin/sections', () => {
    it('lista as 12 seções na ordem da página, mesmo com o banco vazio', async () => {
      const response = await comToken(autenticado().get('/api/admin/sections'))

      expect(response.status).toBe(HttpStatus.OK)
      expect(response.body.sections.map((s: { key: string }) => s.key)).toEqual([...SECTION_KEYS])
      expect(response.body.sections[0]).toEqual({
        key: 'header',
        label: expect.any(String),
        isPublished: false,
        updatedAt: null,
      })
    })

    it('traz o estado de publicação e a data da última edição', async () => {
      harness.database.seed('content_sections', [
        { key: 'faq', data: {}, is_published: true, updated_at: AGORA, updated_by: null },
      ])

      const response = await comToken(autenticado().get('/api/admin/sections'))
      const faq = response.body.sections.find((s: { key: string }) => s.key === 'faq')

      expect(faq).toMatchObject({ isPublished: true, updatedAt: AGORA })
    })

    it('lê as 12 seções em uma única consulta', async () => {
      harness.database.reset()

      await comToken(autenticado().get('/api/admin/sections'))

      expect(harness.database.callsTo('content_sections')).toHaveLength(1)
    })
  })

  describe('GET /api/admin/sections/:key', () => {
    it('devolve o documento completo mesmo despublicado', async () => {
      const documento = exampleDocument('hero')
      harness.database.seed('content_sections', [
        { key: 'hero', data: documento, is_published: false, updated_at: AGORA, updated_by: null },
      ])

      const response = await comToken(autenticado().get('/api/admin/sections/hero'))

      expect(response.status).toBe(HttpStatus.OK)
      expect(response.body).toEqual({
        key: 'hero',
        label: expect.any(String),
        isPublished: false,
        updatedAt: AGORA,
        data: documento,
      })
    })

    it('devolve documento vazio para seção conhecida ainda não salva', async () => {
      const response = await comToken(autenticado().get('/api/admin/sections/produto'))

      expect(response.status).toBe(HttpStatus.OK)
      expect(response.body).toMatchObject({ key: 'produto', data: {}, updatedAt: null })
    })

    it('responde 404 para chave fora das 12 conhecidas', async () => {
      const response = await comToken(autenticado().get('/api/admin/sections/promocao'))

      expect(response.status).toBe(HttpStatus.NOT_FOUND)
      expect(response.body).toEqual({
        statusCode: HttpStatus.NOT_FOUND,
        error: 'Recurso não encontrado.',
      })
    })
  })

  describe('PUT /api/admin/sections/:key', () => {
    it('grava, publica e registra quem salvou', async () => {
      const documento = exampleDocument('faq')

      const response = await comToken(
        autenticado().put('/api/admin/sections/faq').send(documento),
      )

      expect(response.status).toBe(HttpStatus.OK)
      expect(response.body).toMatchObject({ key: 'faq', isPublished: true, data: documento })
      expect(harness.database.rows('content_sections')[0]).toMatchObject({
        key: 'faq',
        is_published: true,
        updated_by: OPERATOR_ID,
      })
    })

    it('o que foi gravado aparece em GET /api/content', async () => {
      const documento = exampleDocument('faq')
      await comToken(autenticado().put('/api/admin/sections/faq').send(documento))

      const publico = await autenticado().get('/api/content')

      expect(publico.body.sections.faq).toEqual(documento)
    })

    it('recusa documento inválido com 422 e erros por campo', async () => {
      const response = await comToken(autenticado().put('/api/admin/sections/faq').send({}))

      expect(response.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
      expect(response.body.error).toBe('Dados inválidos.')
      expect(response.body.fields).toMatchObject({
        'faq.heading': 'Campo obrigatório.',
        'faq.items': expect.any(String),
      })
    })

    it('nomeia o campo exato dentro de um item de lista', async () => {
      const response = await comToken(
        autenticado()
          .put('/api/admin/sections/faq')
          .send({
            heading: 'Perguntas frequentes',
            items: [{ visivel: true, ordem: 0, question: '', answer: 'Resposta' }],
          }),
      )

      expect(response.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
      expect(response.body.fields['faq.items.0.question']).toBe('Campo obrigatório.')
    })

    it('recusa campo desconhecido em vez de gravá-lo em silêncio', async () => {
      const response = await comToken(
        autenticado()
          .put('/api/admin/sections/faq')
          .send({ ...exampleDocument('faq'), campoInventado: 'x' }),
      )

      expect(response.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
      expect(response.body.fields['faq.campoInventado']).toBe('Campo desconhecido nesta seção.')
    })

    it('documento inválido não chega ao banco', async () => {
      await comToken(autenticado().put('/api/admin/sections/faq').send({ heading: 'só isso' }))

      expect(harness.database.rows('content_sections')).toHaveLength(0)
      expect(harness.database.callsTo('content_sections')).toHaveLength(0)
    })

    it('chave desconhecida responde 404 e não cria registro', async () => {
      const response = await comToken(
        autenticado().put('/api/admin/sections/promocao').send({ heading: 'x' }),
      )

      expect(response.status).toBe(HttpStatus.NOT_FOUND)
      expect(harness.database.rows('content_sections')).toHaveLength(0)
      expect(harness.database.calls).toHaveLength(0)
    })
  })

  describe('PATCH /api/admin/sections/:key/visibility', () => {
    beforeEach(() => {
      harness.database.seed('content_sections', [
        {
          key: 'faq',
          data: exampleDocument('faq'),
          is_published: true,
          updated_at: AGORA,
          updated_by: null,
        },
      ])
    })

    it('desliga a seção sem apagar o conteúdo', async () => {
      const response = await comToken(
        autenticado().patch('/api/admin/sections/faq/visibility').send({ isPublished: false }),
      )

      expect(response.status).toBe(HttpStatus.OK)
      expect(response.body).toMatchObject({ key: 'faq', isPublished: false })
      expect(harness.database.rows('content_sections')[0]?.data).toEqual(exampleDocument('faq'))

      const publico = await autenticado().get('/api/content')
      expect(publico.body.sections.faq).toBeUndefined()
    })

    it('religa a seção e a traz de volta idêntica', async () => {
      await comToken(
        autenticado().patch('/api/admin/sections/faq/visibility').send({ isPublished: false }),
      )
      await comToken(
        autenticado().patch('/api/admin/sections/faq/visibility').send({ isPublished: true }),
      )

      const publico = await autenticado().get('/api/content')
      expect(publico.body.sections.faq).toEqual(exampleDocument('faq'))
    })

    it('responde 404 para seção que nunca foi salva', async () => {
      const response = await comToken(
        autenticado().patch('/api/admin/sections/produto/visibility').send({ isPublished: true }),
      )

      expect(response.status).toBe(HttpStatus.NOT_FOUND)
      expect(harness.database.rows('content_sections')).toHaveLength(1)
    })

    it('responde 404 para chave desconhecida sem tocar no banco', async () => {
      harness.database.reset()

      const response = await comToken(
        autenticado().patch('/api/admin/sections/promocao/visibility').send({ isPublished: true }),
      )

      expect(response.status).toBe(HttpStatus.NOT_FOUND)
      expect(harness.database.calls).toHaveLength(0)
    })
  })
})
