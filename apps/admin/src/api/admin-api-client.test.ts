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
