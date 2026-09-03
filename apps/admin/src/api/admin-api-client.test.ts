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
