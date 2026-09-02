import type { Environment } from '../../../config/environment.schema'
import type { LeadSubmission } from '../domain/lead-submission'
import { RdStationLeadRelay } from './rdstation-lead.relay'

/**
 * O adaptador do RD Station, sem nenhuma chamada de rede: `fetch` é substituído
 * e o teste inspeciona o que teria sido enviado.
 *
 * Dois pontos importam aqui. O primeiro é o estado real de hoje: as duas
 * variáveis do RD Station estão vazias, porque a conta da Virbac ainda não foi
 * confirmada (SDD § R-08) — e isso precisa virar `nao_enviado`, não uma
 * exceção. O segundo é o risco R-01: os três campos descartados pelo relay
 * antigo precisam estar no corpo enviado.
 */

const AMBIENTE_BASE = {
  NODE_ENV: 'test',
  PORT: 3000,
  SUPABASE_URL: 'https://projeto-de-teste.supabase.co',
  SUPABASE_SECRET_KEY: 'chave-secreta-ficticia',
  SUPABASE_JWKS_URL: 'https://projeto-de-teste.supabase.co/auth/v1/.well-known/jwks.json',
  ALLOWED_ORIGINS: 'http://localhost:5173',
} as const

const LEAD: LeadSubmission = {
  nome: 'Ana Souza',
  email: 'ana@exemplo.com',
  telefone: '11999999999',
  nomeCachorro: 'Bidu',
  porteCachorro: 'medio',
  cidadeEstado: 'São Paulo/SP',
  conheceVirbac: 'sim',
  usaProdutoVirbac: 'sim',
  qualProdutoVirbac: 'Veggiedent Fresh',
  aceiteLgpd: true,
  aceiteComunicacoes: true,
  origem: 'lp-veggiedent',
}

function ambiente(overrides: Partial<Environment> = {}): Environment {
  return { ...AMBIENTE_BASE, ...overrides } as Environment
}

interface EnvioCapturado {
  url: string
  payload: Record<string, unknown>
}

function capturarEnvio(status = 200): { fetch: jest.Mock; envios: EnvioCapturado[] } {
  const envios: EnvioCapturado[] = []
  const fetchFalso = jest.fn(async (url: string, init: { body: string }) => {
    envios.push({ url, payload: JSON.parse(init.body) as Record<string, unknown> })
    return { ok: status >= 200 && status < 300, status }
  })
  return { fetch: fetchFalso as unknown as jest.Mock, envios }
}

describe('repasse ao RD Station', () => {
  const fetchOriginal = global.fetch

  afterEach(() => {
    global.fetch = fetchOriginal
  })

  it('sem credencial, não tenta e devolve nao_enviado', async () => {
    const { fetch: fetchFalso } = capturarEnvio()
    global.fetch = fetchFalso as unknown as typeof fetch

    const outcome = await new RdStationLeadRelay(ambiente()).forward(LEAD)

    expect(outcome.status).toBe('nao_enviado')
    expect(outcome.error).toContain('RDSTATION_API_TOKEN')
    expect(fetchFalso).not.toHaveBeenCalled()
  })

  it('com só uma das duas variáveis, também não tenta', async () => {
    const { fetch: fetchFalso } = capturarEnvio()
    global.fetch = fetchFalso as unknown as typeof fetch

    const outcome = await new RdStationLeadRelay(
      ambiente({ RDSTATION_API_TOKEN: 'token-ficticio' }),
    ).forward(LEAD)

    expect(outcome.status).toBe('nao_enviado')
    expect(fetchFalso).not.toHaveBeenCalled()
  })

  it('com credencial e aceite do RD Station, devolve ok sem mensagem de erro', async () => {
    const { fetch: fetchFalso } = capturarEnvio(200)
    global.fetch = fetchFalso as unknown as typeof fetch

    const outcome = await new RdStationLeadRelay(
      ambiente({
        RDSTATION_API_TOKEN: 'token-ficticio',
        RDSTATION_CONVERSION_IDENTIFIER: 'ebook-veggiedent',
      }),
    ).forward(LEAD)

    expect(outcome).toEqual({ status: 'ok', error: null })
  })

  it('com recusa do RD Station, devolve falhou com o status na mensagem', async () => {
    const { fetch: fetchFalso } = capturarEnvio(422)
    global.fetch = fetchFalso as unknown as typeof fetch

    const outcome = await new RdStationLeadRelay(
      ambiente({
        RDSTATION_API_TOKEN: 'token-ficticio',
        RDSTATION_CONVERSION_IDENTIFIER: 'ebook-veggiedent',
      }),
    ).forward(LEAD)

    expect(outcome.status).toBe('falhou')
    expect(outcome.error).toContain('422')
  })

  it('envia os três campos que o relay antigo descartava (R-01)', async () => {
    const { fetch: fetchFalso, envios } = capturarEnvio()
    global.fetch = fetchFalso as unknown as typeof fetch

    await new RdStationLeadRelay(
      ambiente({
        RDSTATION_API_TOKEN: 'token-ficticio',
        RDSTATION_CONVERSION_IDENTIFIER: 'ebook-veggiedent',
      }),
    ).forward(LEAD)

    const payload = (envios[0] as EnvioCapturado).payload.payload as Record<string, unknown>
    expect(payload.cf_conhece_virbac).toBe('sim')
    expect(payload.cf_usa_produto_virbac).toBe('sim')
    expect(payload.cf_qual_produto_virbac).toBe('Veggiedent Fresh')
  })

  it('mantém o formato do relay antigo, que a Virbac ainda vai confirmar (R-08)', async () => {
    const { fetch: fetchFalso, envios } = capturarEnvio()
    global.fetch = fetchFalso as unknown as typeof fetch

    await new RdStationLeadRelay(
      ambiente({
        RDSTATION_API_TOKEN: 'token-ficticio',
        RDSTATION_CONVERSION_IDENTIFIER: 'ebook-veggiedent',
      }),
    ).forward(LEAD)

    const envio = envios[0] as EnvioCapturado
    expect(envio.url).toBe(
      'https://api.rd.services/platform/conversions?api_key=token-ficticio',
    )
    expect(envio.payload).toMatchObject({ event_type: 'CONVERSION', event_family: 'CDP' })
    expect(envio.payload.payload).toMatchObject({
      conversion_identifier: 'ebook-veggiedent',
      email: 'ana@exemplo.com',
      name: 'Ana Souza',
      mobile_phone: '11999999999',
      cf_nome_cachorro: 'Bidu',
      cf_porte_cachorro: 'medio',
      cf_cidade_estado: 'São Paulo/SP',
      cf_aceite_comunicacoes: true,
      traffic_source: 'lp-veggiedent',
    })
  })
})
