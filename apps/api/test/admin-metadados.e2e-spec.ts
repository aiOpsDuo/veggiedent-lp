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
   * A lacuna que a T6 declarou: `ogImageAlt` era validado e descartado, por
   * falta de coluna. A migração `20260902130000_add_og_image_alt_to_site_metadata`
   * a criou, e este teste guarda a ida e a volta do campo — inclusive a coluna
   * que a gravação usa, para que a persistência não passe a depender de um
   * caminho que só existe no dublê.
   */
  it('guarda e devolve o texto alternativo da imagem de compartilhamento', async () => {
    const comImagem = { ...exampleMetadata(), ogImage: MEDIA_ID, ogImageAlt: 'Cão sorrindo' }

    const gravado = await comToken(agente().put('/api/admin/metadata').send(comImagem))
    const lido = await comToken(agente().get('/api/admin/metadata'))

    expect(gravado.status).toBe(HttpStatus.OK)
    expect(harness.database.rows('site_metadata')[0]).toMatchObject({
      og_image_media_id: MEDIA_ID,
      og_image_alt: 'Cão sorrindo',
    })
    expect(lido.body.metadata).toEqual(comImagem)
  })
})
