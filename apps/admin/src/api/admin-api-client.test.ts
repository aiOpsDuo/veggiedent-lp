import { AdminApiClient } from './admin-api-client'

const TOKEN = 'token-do-operador'

function respondWith(status: number): typeof fetch {
  return vi.fn().mockResolvedValue(new Response(null, { status })) as unknown as typeof fetch
}

describe('AdminApiClient', () => {
  it('chama a listagem administrativa com o token do operador', async () => {
    const fetchResource = respondWith(200)

    await new AdminApiClient('/api', fetchResource).checkAccess(TOKEN)

    expect(fetchResource).toHaveBeenCalledWith('/api/admin/sections', {
      headers: { authorization: `Bearer ${TOKEN}` },
    })
  })

  it('não duplica a barra quando a base termina com uma', async () => {
    const fetchResource = respondWith(200)

    await new AdminApiClient('https://cms.exemplo.test/api/', fetchResource).checkAccess(
      TOKEN,
    )

    expect(fetchResource).toHaveBeenCalledWith(
      'https://cms.exemplo.test/api/admin/sections',
      expect.anything(),
    )
  })

  it.each([
    [200, 'autorizado'],
    [401, 'nao-autorizado'],
    [403, 'nao-autorizado'],
    [500, 'indisponivel'],
  ])('traduz a resposta %i em %s', async (status, esperado) => {
    const client = new AdminApiClient('/api', respondWith(status))

    await expect(client.checkAccess(TOKEN)).resolves.toBe(esperado)
  })

  it('trata a API fora do ar como indisponível, não como recusa', async () => {
    const fetchResource = vi
      .fn()
      .mockRejectedValue(new TypeError('fetch failed')) as unknown as typeof fetch

    await expect(new AdminApiClient('/api', fetchResource).checkAccess(TOKEN)).resolves.toBe(
      'indisponivel',
    )
  })
})

/**
 * Regressão da verificação manual da T10: o cliente guardava `globalThis.fetch`
 * numa propriedade e o chamava dali, o que no navegador o invoca com o próprio
 * cliente como contexto — "Illegal invocation", e toda chamada à API virava
 * "indisponível". O jsdom aceita a chamada, então o defeito passou pela suíte
 * inteira. Este teste olha para o contexto da chamada, que é onde ele estava.
 */
describe('AdminApiClient sem fetch injetado', () => {
  it('chama fetch com o objeto global como contexto', async () => {
    const contextos: unknown[] = []
    vi.stubGlobal(
      'fetch',
      function (this: unknown): Promise<Response> {
        contextos.push(this)
        return Promise.resolve(new Response(null, { status: 200 }))
      },
    )

    await new AdminApiClient('/api').checkAccess(TOKEN)

    expect(contextos).toEqual([globalThis])
    vi.unstubAllGlobals()
  })
})

/**
 * O contrato com a API, verificado onde ele de fato existe: método, caminho,
 * cabeçalhos e corpo. Teste verde de tela não prova nada disto — a T6 e a T10
 * já mostraram que a divergência entre painel e API mora exatamente aqui.
 */
describe('AdminApiClient — seções', () => {
  function respondeCom(status: number, body: unknown): typeof fetch {
    return vi.fn().mockResolvedValue(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
    ) as unknown as typeof fetch
  }

  const RESUMO = {
    key: 'faq',
    label: 'Perguntas frequentes',
    isPublished: true,
    updatedAt: '2026-09-03T12:00:00.000Z',
  }

  it('lista as seções na rota administrativa, com o token', async () => {
    const fetchResource = respondeCom(200, { sections: [RESUMO] })

    const resultado = await new AdminApiClient('/api', fetchResource).listSections(TOKEN)

    expect(fetchResource).toHaveBeenCalledWith('/api/admin/sections', {
      method: 'GET',
      headers: { authorization: `Bearer ${TOKEN}` },
    })
    expect(resultado).toEqual({ status: 'ok', value: [RESUMO] })
  })

  it('lê o documento completo de uma seção', async () => {
    const fetchResource = respondeCom(200, { ...RESUMO, data: { heading: 'Olá' } })

    const resultado = await new AdminApiClient('/api', fetchResource).getSection(TOKEN, 'faq')

    expect(fetchResource).toHaveBeenCalledWith('/api/admin/sections/faq', expect.anything())
    expect(resultado).toMatchObject({ status: 'ok', value: { data: { heading: 'Olá' } } })
  })

  it('grava a seção com PUT e o documento no corpo', async () => {
    const fetchResource = respondeCom(200, { ...RESUMO, data: { heading: 'Olá' } })

    await new AdminApiClient('/api', fetchResource).saveSection(TOKEN, 'faq', {
      heading: 'Olá',
    })

    expect(fetchResource).toHaveBeenCalledWith('/api/admin/sections/faq', {
      method: 'PUT',
      headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
      body: '{"heading":"Olá"}',
    })
  })

  it('traduz o 422 da API em recusa por campo, não em falha genérica', async () => {
    const fetchResource = respondeCom(422, {
      statusCode: 422,
      error: 'Dados inválidos.',
      fields: { 'faq.heading': 'Campo obrigatório.' },
    })

    const resultado = await new AdminApiClient('/api', fetchResource).saveSection(
      TOKEN,
      'faq',
      {},
    )

    expect(resultado).toEqual({
      status: 'invalido',
      fields: { 'faq.heading': 'Campo obrigatório.' },
    })
  })

  it('usa a mensagem que a API mandou quando a recusa não é de campo', async () => {
    const fetchResource = respondeCom(404, {
      statusCode: 404,
      error: 'Recurso não encontrado.',
    })

    const resultado = await new AdminApiClient('/api', fetchResource).getSection(TOKEN, 'faq')

    expect(resultado).toEqual({ status: 'falha', message: 'Recurso não encontrado.' })
  })

  it('separa a API fora do ar de uma recusa dela', async () => {
    const fetchResource = vi
      .fn()
      .mockRejectedValue(new TypeError('fetch failed')) as unknown as typeof fetch

    const resultado = await new AdminApiClient('/api', fetchResource).listSections(TOKEN)

    expect(resultado).toEqual({
      status: 'falha',
      message: 'Não foi possível falar com a API do CMS.',
    })
  })

  it('liga e desliga a seção com PATCH na rota de visibilidade', async () => {
    const fetchResource = respondeCom(200, { ...RESUMO, isPublished: false })

    const resultado = await new AdminApiClient('/api', fetchResource).setSectionVisibility(
      TOKEN,
      'faq',
      false,
    )

    expect(fetchResource).toHaveBeenCalledWith('/api/admin/sections/faq/visibility', {
      method: 'PATCH',
      headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
      body: '{"isPublished":false}',
    })
    expect(resultado).toMatchObject({ status: 'alterada' })
  })
})
