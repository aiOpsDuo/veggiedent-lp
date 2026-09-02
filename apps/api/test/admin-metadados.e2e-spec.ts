import { HttpStatus } from '@nestjs/common'
import request from 'supertest'
import { exampleMetadata } from './documento-de-exemplo'
import { OPERATOR_ID, startContentHarness, type ContentHarness } from './content-harness'

const MEDIA_ID = '00000000-0000-4000-8000-0000000000aa'

describe('rotas administrativas de metadados', () => {
  let harness: ContentHarness

  beforeEach(async () => {
    harness = await startContentHarness()
  })

  afterEach(async () => {
    await harness.close()
  })

  const agente = (): request.Agent => request.agent(harness.app.getHttpServer())
  const comToken = (req: request.Test): request.Test =>
    req.set('authorization', `Bearer ${harness.token}`)

  it('GET /api/admin/metadata responde 401 sem token', async () => {
    const response = await agente().get('/api/admin/metadata')

    expect(response.status).toBe(HttpStatus.UNAUTHORIZED)
  })

  it('PUT /api/admin/metadata responde 401 sem token e não grava', async () => {
    const response = await agente().put('/api/admin/metadata').send(exampleMetadata())

    expect(response.status).toBe(HttpStatus.UNAUTHORIZED)
    expect(harness.database.rows('site_metadata')).toHaveLength(0)
  })

  it('devolve metadados vazios enquanto nada foi salvo', async () => {
    const response = await comToken(agente().get('/api/admin/metadata'))

    expect(response.status).toBe(HttpStatus.OK)
    expect(response.body).toEqual({ metadata: {}, updatedAt: null })
  })

  it('grava e lê de volta, preservando acentuação', async () => {
    const metadados = exampleMetadata()

    const gravado = await comToken(agente().put('/api/admin/metadata').send(metadados))
    const lido = await comToken(agente().get('/api/admin/metadata'))

    expect(gravado.status).toBe(HttpStatus.OK)
    expect(lido.body.metadata).toEqual(metadados)
    expect(harness.database.rows('site_metadata')[0]).toMatchObject({
      id: 'default',
      updated_by: OPERATOR_ID,
    })
  })

  it('grava no registro único, sem criar um segundo', async () => {
    await comToken(agente().put('/api/admin/metadata').send(exampleMetadata()))
    await comToken(
      agente()
        .put('/api/admin/metadata')
        .send({ ...exampleMetadata(), title: 'Outro título' }),
    )

    expect(harness.database.rows('site_metadata')).toHaveLength(1)
    expect(harness.database.rows('site_metadata')[0]?.title).toBe('Outro título')
  })

  it('recusa metadados inválidos com 422 e erros por campo', async () => {
    const response = await comToken(agente().put('/api/admin/metadata').send({}))

    expect(response.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
    expect(response.body.error).toBe('Dados inválidos.')
    expect(response.body.fields).toMatchObject({
      'metadata.title': 'Campo obrigatório.',
      'metadata.description': 'Campo obrigatório.',
      'metadata.canonicalUrl': 'Campo obrigatório.',
    })
  })

  it('exige o texto alternativo quando há imagem de compartilhamento', async () => {
    const response = await comToken(
      agente()
        .put('/api/admin/metadata')
        .send({ ...exampleMetadata(), ogImage: MEDIA_ID }),
    )

    expect(response.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
    expect(response.body.fields['metadata.ogImageAlt']).toBe(
      'O texto alternativo é obrigatório quando há imagem.',
    )
  })

  it('metadados inválidos não chegam ao banco', async () => {
    await comToken(agente().put('/api/admin/metadata').send({ title: 'só o título' }))

    expect(harness.database.calls).toHaveLength(0)
  })

  /**
   * LACUNA DECLARADA, não comportamento desejado.
   *
   * `site_metadata` não tem coluna para o texto alternativo da imagem de
   * compartilhamento: o SDD § "Modelo de dados" não a previu e a T3 seguiu o
   * SDD. Guardá-lo exige uma migração, e migração exige a senha do banco, que
   * não estava disponível para a T6. Este teste existe para que a lacuna fique
   * visível na suíte e falhe no dia em que a coluna aparecer — momento de
   * apagar o teste e passar a persistir o campo.
   */
  it('LACUNA: ogImageAlt é validado mas ainda não persiste', async () => {
    await comToken(
      agente()
        .put('/api/admin/metadata')
        .send({ ...exampleMetadata(), ogImage: MEDIA_ID, ogImageAlt: 'Cão sorrindo' }),
    )

    const linha = harness.database.rows('site_metadata')[0] ?? {}
    expect(Object.keys(linha)).not.toContain('og_image_alt')

    const lido = await comToken(agente().get('/api/admin/metadata'))
    expect(lido.body.metadata.ogImage).toBe(MEDIA_ID)
    expect(lido.body.metadata.ogImageAlt).toBeUndefined()
  })
})
