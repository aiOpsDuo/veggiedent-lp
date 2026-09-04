import { HttpStatus } from '@nestjs/common'
import { SECTION_KEYS } from '@veggiedent/content-schema'
import request from 'supertest'
import { startContentHarness, type ContentHarness } from './content-harness'
import { exampleDocument } from './documento-de-exemplo'

/**
 * Referências de mídia em `GET /api/content` (SDD § C-06, C-07 e C-10).
 *
 * O documento guarda o **identificador** da mídia — é o que o SDD manda e é o
 * que o painel edita. Quem consome o conteúdo publicado é a LP, que precisa de
 * um endereço: um UUID não vira `<img src>` nem `<video src>`. Esta suíte
 * verifica os dois lados do contrato — a saída pública traz URL, a saída
 * administrativa continua trazendo o identificador — e prende o custo da
 * resolução em uma consulta (risco R-05).
 */

const AGORA = '2026-09-02T12:00:00.000Z'

function mediaId(indice: number): string {
  return `00000000-0000-4000-8000-${String(indice).padStart(12, '0')}`
}

/** URL sem nenhum pedaço do identificador: é o que deixa o teste provar que a
 *  resposta traz o endereço, e não o UUID guardado. */
function mediaUrl(indice: number): string {
  return `https://cdn.exemplo/midia-${indice}.png`
}

function storedSection(key: string, data: unknown, isPublished = true) {
  return { key, data, is_published: isPublished, updated_at: AGORA, updated_by: null }
}

function mediaRow(indice: number) {
  return { id: mediaId(indice), kind: 'image', public_url: mediaUrl(indice) }
}

/**
 * Um documento de `demonstracao` com N vídeos, cada um com **sua própria**
 * mídia. Identificadores distintos por item são o que dá sentido à contagem de
 * consultas: com um identificador repetido, um adaptador que consultasse por
 * item passaria despercebido.
 */
function demonstracaoComVideos(quantidade: number): {
  documento: Record<string, unknown>
  midias: number[]
} {
  const documento = exampleDocument('demonstracao', { itemsPerList: quantidade })
  const midias: number[] = []

  const videos = (documento.videos as Record<string, unknown>[]).map((item, indice) => {
    midias.push(indice * 2, indice * 2 + 1)
    return { ...item, video: mediaId(indice * 2), captions: mediaId(indice * 2 + 1) }
  })

  return { documento: { ...documento, videos }, midias }
}

describe('GET /api/content — referências de mídia', () => {
  let harness: ContentHarness

  beforeEach(async () => {
    harness = await startContentHarness()
  })

  afterEach(async () => {
    await harness.close()
  })

  it('entrega a URL pública no campo de topo, não o identificador', async () => {
    harness.database.seed('media_assets', [mediaRow(1)])
    harness.database.seed('content_sections', [
      storedSection('hero', {
        headline: 'Hálito fresco todo dia',
        image: mediaId(1),
        imageAlt: 'Cão recebendo o petisco',
      }),
    ])

    const response = await request(harness.app.getHttpServer()).get('/api/content')

    expect(response.status).toBe(HttpStatus.OK)
    expect(response.body.sections.hero.image).toBe(mediaUrl(1))
    expect(response.body.sections.hero.imageAlt).toBe('Cão recebendo o petisco')
    expect(JSON.stringify(response.body)).not.toContain(mediaId(1))
  })

  it('resolve também a mídia de cada item de lista', async () => {
    const { documento, midias } = demonstracaoComVideos(3)
    harness.database.seed('media_assets', midias.map(mediaRow))
    harness.database.seed('content_sections', [storedSection('demonstracao', documento)])

    const response = await request(harness.app.getHttpServer()).get('/api/content')

    const videos = response.body.sections.demonstracao.videos as {
      video: string
      captions: string
    }[]
    expect(videos).toHaveLength(3)
    videos.forEach((item, indice) => {
      expect(item.video).toBe(mediaUrl(indice * 2))
      expect(item.captions).toBe(mediaUrl(indice * 2 + 1))
    })
  })

  it('resolve a imagem de compartilhamento dos metadados, como `GET /api/seo` faz', async () => {
    harness.database.seed('media_assets', [mediaRow(7)])
    harness.database.seed('site_metadata', [
      {
        id: 'default',
        title: 'Veggiedent',
        description: 'Saúde oral canina',
        canonical_url: 'https://veggiedent.com.br/',
        og_image_media_id: mediaId(7),
        updated_at: AGORA,
      },
    ])

    const response = await request(harness.app.getHttpServer()).get('/api/content')

    expect(response.body.metadata.ogImage).toBe(mediaUrl(7))
  })

  it('omite o campo quando a mídia não existe mais, sem quebrar a resposta', async () => {
    harness.database.seed('content_sections', [
      storedSection('hero', {
        headline: 'Hálito fresco todo dia',
        image: mediaId(99),
        imageAlt: 'Cão recebendo o petisco',
      }),
    ])

    const response = await request(harness.app.getHttpServer()).get('/api/content')

    expect(response.status).toBe(HttpStatus.OK)
    expect(response.body.sections.hero.image).toBeUndefined()
    expect(response.body.sections.hero.headline).toBe('Hálito fresco todo dia')
    expect(JSON.stringify(response.body)).not.toContain(mediaId(99))
  })

  it('mantém o identificador na resposta administrativa, que é o que o painel edita', async () => {
    harness.database.seed('media_assets', [mediaRow(1)])
    harness.database.seed('content_sections', [
      storedSection('hero', {
        headline: 'Hálito fresco todo dia',
        image: mediaId(1),
        imageAlt: 'Cão recebendo o petisco',
      }),
    ])

    const response = await request(harness.app.getHttpServer())
      .get('/api/admin/sections/hero')
      .set('Authorization', `Bearer ${harness.token}`)

    expect(response.status).toBe(HttpStatus.OK)
    expect(response.body.data.image).toBe(mediaId(1))
  })

  it('não consulta mídia nenhuma quando o conteúdo não referencia mídia', async () => {
    harness.database.seed('content_sections', [
      storedSection('faq', {
        heading: 'Perguntas frequentes',
        items: [{ visivel: true, ordem: 0, question: 'Pergunta?', answer: 'Resposta.' }],
      }),
    ])
    harness.database.reset()

    await request(harness.app.getHttpServer()).get('/api/content')

    expect(harness.database.callsTo('media_assets')).toEqual([])
  })

  /**
   * RISCO R-05, aplicado à resolução de mídia.
   *
   * O mesmo conteúdo com 3 e com 30 vídeos — 6 e 60 mídias distintas, uma por
   * campo de cada item. Se a resolução consultasse por item, a contagem
   * cresceria junto; ela não cresce, porque os identificadores vão todos em uma
   * consulta só. As URLs conferidas item a item mostram que a consulta única de
   * fato resolve cada mídia, e não uma só repetida.
   */
  it('não acrescenta uma consulta por item de mídia', async () => {
    const consultasCom = async (quantidadeDeVideos: number): Promise<number> => {
      const { documento, midias } = demonstracaoComVideos(quantidadeDeVideos)
      harness.database.seed('media_assets', midias.map(mediaRow))
      harness.database.seed('content_sections', [storedSection('demonstracao', documento)])
      harness.database.reset()

      const response = await request(harness.app.getHttpServer()).get('/api/content')

      const videos = response.body.sections.demonstracao.videos as { video: string }[]
      expect(videos).toHaveLength(quantidadeDeVideos)
      videos.forEach((item, indice) => {
        expect(item.video).toBe(mediaUrl(indice * 2))
      })
      return harness.database.calls.length
    }

    const comPoucos = await consultasCom(3)
    const comMuitos = await consultasCom(30)

    expect(comMuitos).toBe(comPoucos)
    expect(harness.database.callsTo('media_assets')).toEqual([
      { table: 'media_assets', operation: 'select' },
    ])
  })

  /**
   * O mesmo limite, agora com a página inteira: as 12 seções gravadas, cada uma
   * com o documento que o esquema pede. Três consultas no total — uma por
   * tabela —, não uma por seção nem uma por mídia.
   */
  it('resolve a mídia das 12 seções em três consultas', async () => {
    harness.database.seed('media_assets', [mediaRow(1)])
    harness.database.seed(
      'content_sections',
      SECTION_KEYS.map((key) => storedSection(key, exampleDocument(key))),
    )
    harness.database.reset()

    const response = await request(harness.app.getHttpServer()).get('/api/content')

    expect(response.status).toBe(HttpStatus.OK)
    expect(Object.keys(response.body.sections)).toHaveLength(SECTION_KEYS.length)
    expect(harness.database.calls).toEqual([
      { table: 'content_sections', operation: 'select' },
      { table: 'site_metadata', operation: 'select' },
      { table: 'media_assets', operation: 'select' },
    ])
  })
})
