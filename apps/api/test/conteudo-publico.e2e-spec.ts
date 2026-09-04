import { HttpStatus } from '@nestjs/common'
import { SECTION_KEYS } from '@veggiedent/content-schema'
import request from 'supertest'
import { exampleDocument } from './documento-de-exemplo'
import { startContentHarness, type ContentHarness } from './content-harness'

const AGORA = '2026-09-02T12:00:00.000Z'
const MEDIA_ID = '00000000-0000-4000-8000-0000000000aa'

function storedSection(key: string, data: unknown, isPublished: boolean) {
  return { key, data, is_published: isPublished, updated_at: AGORA, updated_by: null }
}

describe('GET /api/content — conteúdo publicado', () => {
  let harness: ContentHarness

  beforeEach(async () => {
    harness = await startContentHarness()
  })

  afterEach(async () => {
    await harness.close()
  })

  it('é público: responde sem token', async () => {
    const response = await request(harness.app.getHttpServer()).get('/api/content')

    expect(response.status).toBe(HttpStatus.OK)
    expect(response.body).toEqual({ sections: {}, metadata: null })
  })

  it('omite a seção despublicada e entrega a publicada', async () => {
    const faq = exampleDocument('faq')
    const hero = exampleDocument('hero')
    harness.database.seed('content_sections', [
      storedSection('faq', faq, true),
      storedSection('hero', hero, false),
    ])

    const response = await request(harness.app.getHttpServer()).get('/api/content')

    expect(response.status).toBe(HttpStatus.OK)
    expect(Object.keys(response.body.sections)).toEqual(['faq'])
    expect(response.body.sections.hero).toBeUndefined()
    expect(response.body.sections.faq.heading).toBe(faq.heading)
  })

  it('omite o item de lista despublicado', async () => {
    harness.database.seed('content_sections', [
      storedSection(
        'faq',
        {
          heading: 'Perguntas frequentes',
          items: [
            { visivel: true, ordem: 0, question: 'Aparece?', answer: 'Sim.' },
            { visivel: false, ordem: 1, question: 'Espaço reservado', answer: 'A confirmar.' },
          ],
        },
        true,
      ),
    ])

    const response = await request(harness.app.getHttpServer()).get('/api/content')

    expect(response.body.sections.faq.items).toHaveLength(1)
    expect(response.body.sections.faq.items[0].question).toBe('Aparece?')
    expect(JSON.stringify(response.body)).not.toContain('Espaço reservado')
  })

  it('preserva a ordem definida no painel, não a ordem de gravação', async () => {
    harness.database.seed('content_sections', [
      storedSection(
        'faq',
        {
          heading: 'Perguntas frequentes',
          items: [
            { visivel: true, ordem: 2, question: 'Terceira', answer: 'C' },
            { visivel: true, ordem: 0, question: 'Primeira', answer: 'A' },
            { visivel: true, ordem: 1, question: 'Segunda', answer: 'B' },
          ],
        },
        true,
      ),
    ])

    const response = await request(harness.app.getHttpServer()).get('/api/content')

    expect(
      response.body.sections.faq.items.map((item: { question: string }) => item.question),
    ).toEqual(['Primeira', 'Segunda', 'Terceira'])
  })

  it('entrega os metadados junto do conteúdo', async () => {
    harness.database.seed('site_metadata', [
      {
        id: 'default',
        title: 'Veggiedent',
        description: 'Saúde oral canina',
        canonical_url: 'https://veggiedent.com.br/',
        og_image_media_id: null,
        updated_at: AGORA,
      },
    ])

    const response = await request(harness.app.getHttpServer()).get('/api/content')

    expect(response.body.metadata).toEqual({
      title: 'Veggiedent',
      description: 'Saúde oral canina',
      canonicalUrl: 'https://veggiedent.com.br/',
    })
  })

  it('preserva acentuação na ida e na volta', async () => {
    harness.database.seed('content_sections', [
      storedSection('hero', { headline: 'Cuidado diário, hálito fresco — açaí' }, true),
    ])

    const response = await request(harness.app.getHttpServer()).get('/api/content')

    expect(response.body.sections.hero.headline).toBe('Cuidado diário, hálito fresco — açaí')
  })

  /**
   * RISCO R-05, o teste que a T6 existe para não deixar regredir.
   *
   * Ele conta as idas ao cliente Supabase com as 9 seções gravadas. Se alguém
   * trocar a leitura agregada por uma consulta por seção, a contagem vira 10 e
   * este teste falha. Contar no nível do cliente — e não no da porta de
   * repositório — é o que faz a contagem valer para o adaptador de verdade.
   */
  it('faz uma única consulta às seções, não uma por seção', async () => {
    harness.database.seed(
      'content_sections',
      SECTION_KEYS.map((key) => storedSection(key, exampleDocument(key), true)),
    )
    harness.database.reset()

    const response = await request(harness.app.getHttpServer()).get('/api/content')

    expect(response.status).toBe(HttpStatus.OK)
    expect(Object.keys(response.body.sections)).toHaveLength(SECTION_KEYS.length)
    expect(harness.database.callsTo('content_sections')).toEqual([
      { table: 'content_sections', operation: 'select' },
    ])
    // Três no total, e o número não cresce com a quantidade de seções: uma por
    // tabela envolvida — `site_metadata`, que é registro único, e `media_assets`,
    // que resolve todas as referências de mídia de uma vez
    // (`midia-no-conteudo.e2e-spec.ts` prende esse lado).
    expect(harness.database.calls).toHaveLength(3)
  })

  it('não deixa detalhe do banco vazar quando a consulta falha', async () => {
    harness.database.failOn('content_sections', 'permission denied for table content_sections')

    const response = await request(harness.app.getHttpServer()).get('/api/content')

    expect(response.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR)
    expect(response.body).toEqual({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Erro interno no servidor.',
    })
    expect(JSON.stringify(response.body)).not.toContain('permission denied')
  })
})

describe('GET /api/seo — metadados para o injetor de borda', () => {
  let harness: ContentHarness

  beforeEach(async () => {
    harness = await startContentHarness()
  })

  afterEach(async () => {
    await harness.close()
  })

  it('é público e responde nulos quando ainda não há metadados', async () => {
    const response = await request(harness.app.getHttpServer()).get('/api/seo')

    expect(response.status).toBe(HttpStatus.OK)
    expect(response.body).toEqual({
      title: null,
      description: null,
      ogImageUrl: null,
      canonicalUrl: null,
    })
  })

  it('resolve a URL pública da imagem de compartilhamento em uma consulta', async () => {
    harness.database.seed('media_assets', [
      { id: MEDIA_ID, public_url: 'https://cdn.exemplo/og.png' },
    ])
    harness.database.seed('site_metadata', [
      {
        id: 'default',
        title: 'Veggiedent',
        description: 'Saúde oral canina',
        canonical_url: 'https://veggiedent.com.br/',
        og_image_media_id: MEDIA_ID,
        updated_at: AGORA,
      },
    ])
    harness.database.reset()

    const response = await request(harness.app.getHttpServer()).get('/api/seo')

    expect(response.body).toEqual({
      title: 'Veggiedent',
      description: 'Saúde oral canina',
      ogImageUrl: 'https://cdn.exemplo/og.png',
      canonicalUrl: 'https://veggiedent.com.br/',
    })
    expect(harness.database.calls).toHaveLength(1)
  })
})
