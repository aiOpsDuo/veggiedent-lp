import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchPublishedContent } from './fetch-published-content'

const CONTEUDO = { sections: { hero: { headline: 'Um título' } }, metadata: { title: 'Veggiedent' } }

function respondeCom(body: unknown, status = 200): typeof fetch {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  ) as unknown as typeof fetch
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchPublishedContent', () => {
  it('devolve as seções e os metadados que a API entregou', async () => {
    await expect(fetchPublishedContent('/api/content', respondeCom(CONTEUDO))).resolves.toEqual(
      CONTEUDO,
    )
  })

  it('busca no endereço que recebeu', async () => {
    const buscar = respondeCom(CONTEUDO)

    await fetchPublishedContent('/api/content', buscar)

    expect(buscar).toHaveBeenCalledWith('/api/content')
  })

  it.each([500, 404, 502])('devolve null quando a API responde %i', async (status) => {
    await expect(
      fetchPublishedContent('/api/content', respondeCom(CONTEUDO, status)),
    ).resolves.toBeNull()
  })

  it('devolve null quando a API não responde', async () => {
    const buscar = vi.fn().mockRejectedValue(new TypeError('fetch failed')) as unknown as typeof fetch

    await expect(fetchPublishedContent('/api/content', buscar)).resolves.toBeNull()
  })

  it('devolve null quando o corpo não é JSON', async () => {
    const buscar = vi
      .fn()
      .mockResolvedValue(new Response('<html>erro</html>', { status: 200 })) as unknown as typeof fetch

    await expect(fetchPublishedContent('/api/content', buscar)).resolves.toBeNull()
  })

  it('devolve null quando o corpo não traz seções', async () => {
    await expect(
      fetchPublishedContent('/api/content', respondeCom({ metadata: null })),
    ).resolves.toBeNull()
  })

  it('trata metadados ausentes como null, sem descartar as seções', async () => {
    const semMetadados = await fetchPublishedContent(
      '/api/content',
      respondeCom({ sections: CONTEUDO.sections }),
    )

    expect(semMetadados).toEqual({ sections: CONTEUDO.sections, metadata: null })
  })

  /**
   * Regressão do defeito real da T10: guardar `fetch` numa variável e chamá-lo
   * dali o invoca com outro contexto, e o navegador recusa com "Illegal
   * invocation" — o jsdom aceita, então só um teste que olha o contexto pega.
   */
  it('chama o fetch global com o objeto global como contexto', async () => {
    const contextos: unknown[] = []
    vi.stubGlobal('fetch', function (this: unknown): Promise<Response> {
      contextos.push(this)
      return Promise.resolve(new Response(JSON.stringify(CONTEUDO), { status: 200 }))
    })

    await fetchPublishedContent('/api/content')

    expect(contextos).toEqual([globalThis])
  })
})
