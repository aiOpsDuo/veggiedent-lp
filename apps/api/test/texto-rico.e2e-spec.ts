import { HttpStatus } from '@nestjs/common'
import request from 'supertest'
import { exampleDocument } from './documento-de-exemplo'
import { startContentHarness, type ContentHarness } from './content-harness'

/**
 * Gravação de campo de texto rico, com tentativa real de injeção.
 *
 * A barreira que protege o visitante é a da LP, que sanitiza ao renderizar.
 * Esta suíte cobre a segunda barreira, a da escrita: nada perigoso chega a ser
 * **guardado**, então nem o banco nem o instantâneo versionado da LP carregam
 * uma carga de injeção esperando por um consumidor distraído.
 *
 * A seção usada é a Prova de Autoridade, cujo título é o primeiro campo
 * `texto-rico` do esquema.
 */

const SECAO = 'prova_autoridade'

const CARGAS = [
  ['script direto', '<script>alert(document.cookie)</script>Título'],
  ['manipulador de evento em atributo', '<img src=x onerror="alert(1)">Título'],
  ['manipulador em tag permitida', '<strong onclick="alert(1)">Título</strong>'],
  ['javascript: em href', '<a href="javascript:alert(1)">Título</a>'],
  ['tag não permitida', '<iframe src="https://mal.invalid"></iframe>Título'],
] as const

describe('campo de texto rico na gravação', () => {
  let harness: ContentHarness

  beforeEach(async () => {
    harness = await startContentHarness()
  })

  afterEach(async () => {
    await harness.close()
  })

  const comToken = (req: request.Test): request.Test =>
    req.set('authorization', `Bearer ${harness.token}`)

  const gravar = (heading: string): request.Test =>
    comToken(
      request
        .agent(harness.app.getHttpServer())
        .put(`/api/admin/sections/${SECAO}`)
        .send({ ...exampleDocument(SECAO), heading }),
    )

  const headingGravado = (): string =>
    (harness.database.rows('content_sections')[0] as { data: { heading: string } }).data.heading

  it('guarda a marcação de título que o operador pode usar', async () => {
    const titulo = 'A recomendação dos <br><strong>médicos-veterinários,</strong> em números'

    const response = await gravar(titulo)

    expect(response.status).toBe(HttpStatus.OK)
    expect(headingGravado()).toBe(titulo)
  })

  it.each(CARGAS)('não guarda %s', async (_nome, carga) => {
    const response = await gravar(`${carga} em números`)

    expect(response.status).toBe(HttpStatus.OK)

    const guardado = headingGravado()
    expect(guardado).not.toMatch(/<\s*(script|iframe|img|a|div|svg|style)\b/i)
    expect(guardado).not.toMatch(/\son\w+\s*=/i)
    expect(guardado.toLowerCase()).not.toContain('javascript:')
    expect(guardado).toContain('Título')
  })

  it('devolve ao painel exatamente o que guardou', async () => {
    const response = await gravar('<b><strong onclick="alert(1)">Destaque</strong></b> normal')

    expect(response.body.data.heading).toBe('<strong>Destaque</strong> normal')
    expect(response.body.data.heading).toBe(headingGravado())
  })

  it('entrega à página pública o título já sanitizado', async () => {
    await gravar('<img src=x onerror="alert(1)">A recomendação<br><strong>dos veterinários</strong>')

    const response = await request.agent(harness.app.getHttpServer()).get('/api/content')

    expect(response.status).toBe(HttpStatus.OK)
    expect(response.body.sections[SECAO].heading).toBe(
      'A recomendação<br><strong>dos veterinários</strong>',
    )
  })

  it('recusa um título que só tinha marcação proibida, em vez de gravar vazio', async () => {
    const response = await gravar('<script>alert(1)</script>')

    expect(response.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
    expect(response.body.fields).toEqual({ 'prova_autoridade.heading': 'Campo obrigatório.' })
    expect(harness.database.rows('content_sections')).toHaveLength(0)
  })
})
