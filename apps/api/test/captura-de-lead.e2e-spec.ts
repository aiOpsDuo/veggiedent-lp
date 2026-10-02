import { HttpStatus } from '@nestjs/common'
import { LGPD_CONSENT_TEXT_MAX_LENGTH, PRIVACY_POLICY_URL } from '@veggiedent/content-schema'
import request from 'supertest'
import { startContentHarness, type ContentHarness } from './content-harness'
import type { Row } from './fake-supabase'

/**
 * `POST /api/leads` (SDD § C-11, § R-01 e § "Endpoints públicos").
 *
 * O que esta suíte prende, em ordem de importância:
 *
 * 1. **A gravação é a única barreira entre o envio e a perda do dado.** Desde
 *    que o repasse a sistema externo foi descontinuado (2026-09-03), o banco do
 *    CMS é o único lugar onde o lead existe. Se a gravação falha, o visitante
 *    **precisa** ver erro: responder sucesso ali perderia o lead em silêncio,
 *    sem nenhum segundo sistema de onde recuperá-lo.
 * 2. **O honeypot não grava e responde sucesso.**
 * 3. **O consentimento continua sendo condição de envio** — sem ele, `422` e
 *    nenhuma linha — e, desde 2026-10-02, é gravado com o instante do servidor,
 *    o texto exibido e o endereço da política.
 * 4. **Os três campos que o relay antigo descartava** chegam à tabela (R-01).
 *
 * Nenhum caso fala com a rede: o banco é o dublê em memória do harness.
 */

const ENVIO_COMPLETO = {
  nome: 'Ana Conceição',
  email: 'ana@exemplo.com',
  telefone: '11999999999',
  nome_cachorro: 'Bidu',
  porte_cachorro: 'medio',
  cidade_estado: 'São Paulo/SP',
  conhece_virbac: 'sim',
  usa_produto_virbac: 'sim',
  qual_produto_virbac: 'Veggiedent Fresh',
  aceite_lgpd: true,
  aceite_lgpd_texto:
    'Li e aceito a Política de Privacidade e autorizo o uso dos meus dados para receber o guia e comunicações relacionadas.',
  aceite_comunicacoes: true,
  origem: 'lp-veggiedent',
}

describe('captura de lead', () => {
  let harness: ContentHarness

  beforeEach(async () => {
    harness = await startContentHarness()
  })

  afterEach(async () => {
    await harness.close()
  })

  const enviar = (corpo: Record<string, unknown>): request.Test =>
    request(harness.app.getHttpServer()).post('/api/leads').send(corpo)

  const leadsGravados = (): Row[] => harness.database.rows('leads')
  const unicoLead = (): Row => {
    expect(leadsGravados()).toHaveLength(1)
    return leadsGravados()[0] as Row
  }

  describe('caminho feliz', () => {
    it('responde sucesso e grava o lead', async () => {
      const resposta = await enviar(ENVIO_COMPLETO)

      expect(resposta.status).toBe(HttpStatus.OK)
      expect(resposta.body).toEqual({ success: true })
      expect(unicoLead()).toMatchObject({ nome: 'Ana Conceição', email: 'ana@exemplo.com' })
    })

    it('grava os três campos que o relay antigo descartava (R-01)', async () => {
      await enviar(ENVIO_COMPLETO)

      expect(unicoLead()).toMatchObject({
        conhece_virbac: 'sim',
        usa_produto_virbac: 'sim',
        qual_produto_virbac: 'Veggiedent Fresh',
      })
    })

    it('preserva a acentuação do que o visitante digitou', async () => {
      await enviar(ENVIO_COMPLETO)

      expect(unicoLead()).toMatchObject({ cidade_estado: 'São Paulo/SP' })
    })

    it('grava uma única vez, e não repassa o lead a lugar nenhum', async () => {
      await enviar(ENVIO_COMPLETO)

      expect(harness.database.callsTo('leads').map((call) => call.operation)).toEqual(['insert'])
    })
  })

  /**
   * A regra que a saída do destino externo tornou crítica: não há mais uma
   * segunda cópia do lead, então a falha de gravação **tem** que chegar ao
   * visitante. Um `catch` silencioso aqui devolveria `{ success: true }` para um
   * lead que não existe em lugar nenhum.
   */
  describe('quando o banco falha, o visitante vê erro', () => {
    beforeEach(() => {
      harness.database.failOn('leads')
    })

    it('responde 500, e não sucesso', async () => {
      const resposta = await enviar(ENVIO_COMPLETO)

      expect(resposta.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR)
      expect(resposta.body).not.toEqual({ success: true })
    })

    it('não deixa lead nenhum gravado', async () => {
      await enviar(ENVIO_COMPLETO)

      expect(leadsGravados()).toHaveLength(0)
    })
  })

  describe('honeypot', () => {
    it('preenchido: responde sucesso e não grava', async () => {
      const resposta = await enviar({ ...ENVIO_COMPLETO, website: 'http://spam.exemplo' })

      expect(resposta.status).toBe(HttpStatus.OK)
      expect(resposta.body).toEqual({ success: true })
      expect(leadsGravados()).toHaveLength(0)
    })

    it('preenchido, o banco nem chega a ser tocado', async () => {
      await enviar({ ...ENVIO_COMPLETO, website: 'http://spam.exemplo' })

      expect(harness.database.callsTo('leads')).toHaveLength(0)
    })

    it('preenchido junto de dados inválidos, ainda responde sucesso', async () => {
      const resposta = await enviar({ website: 'x', nome: '', email: 'nao-e-email' })

      expect(resposta.status).toBe(HttpStatus.OK)
      expect(leadsGravados()).toHaveLength(0)
    })
  })

  /**
   * O consentimento com a Política de Privacidade continua sendo **condição de
   * envio** (SDD § "Modelo de dados"; PLAN.md § T18).
   */
  describe('o consentimento continua sendo condição de envio', () => {
    const semOConsentimento = (): Record<string, unknown> => {
      const envio: Record<string, unknown> = { ...ENVIO_COMPLETO }
      delete envio.aceite_lgpd
      return envio
    }

    it('ausente, responde 422 mesmo com todo o resto preenchido', async () => {
      const resposta = await enviar(semOConsentimento())

      expect(resposta.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
      expect(resposta.body.fields).toHaveProperty('aceite_lgpd')
    })

    it('ausente, não grava lead nenhum', async () => {
      await enviar(semOConsentimento())

      expect(leadsGravados()).toHaveLength(0)
    })

    it('recusado explicitamente, responde 422', async () => {
      const resposta = await enviar({ ...ENVIO_COMPLETO, aceite_lgpd: false })

      expect(resposta.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
      expect(resposta.body.fields).toHaveProperty('aceite_lgpd')
    })
  })

  /**
   * Pedido do cliente de 2026-10-02: o aceite passa a ser **registrado**, para
   * o Marketing gerir a base e remover o lead quando o titular revogar o
   * consentimento. O instante e o endereço da política são do servidor; só o
   * texto exibido vem do formulário.
   */
  describe('o consentimento é registrado junto do lead', () => {
    it('grava o aceite, o instante do servidor, o texto exibido e a política', async () => {
      const antes = new Date().toISOString()
      const resposta = await enviar(ENVIO_COMPLETO)
      const depois = new Date().toISOString()

      expect(resposta.status).toBe(HttpStatus.OK)
      const lead = unicoLead()
      expect(lead).toMatchObject({
        aceite_lgpd: true,
        aceite_lgpd_texto: ENVIO_COMPLETO.aceite_lgpd_texto,
        aceite_lgpd_politica_url: PRIVACY_POLICY_URL,
      })
      const instante = lead.aceite_lgpd_em as string
      expect(instante >= antes && instante <= depois).toBe(true)
    })

    it('sem o texto, grava o aceite mesmo assim, com o texto nulo', async () => {
      const envio: Record<string, unknown> = { ...ENVIO_COMPLETO }
      delete envio.aceite_lgpd_texto

      const resposta = await enviar(envio)

      expect(resposta.status).toBe(HttpStatus.OK)
      expect(unicoLead()).toMatchObject({ aceite_lgpd: true, aceite_lgpd_texto: null })
    })

    it('apara as bordas do texto antes de gravar', async () => {
      await enviar({ ...ENVIO_COMPLETO, aceite_lgpd_texto: '  Li e aceito.  ' })

      expect(unicoLead()).toMatchObject({ aceite_lgpd_texto: 'Li e aceito.' })
    })

    it('texto que não é texto responde 422 no formato único de erro, sem gravar', async () => {
      const resposta = await enviar({ ...ENVIO_COMPLETO, aceite_lgpd_texto: 42 })

      expect(resposta.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
      expect(resposta.body.error).toBe('Dados inválidos.')
      expect(resposta.body.fields).toHaveProperty('aceite_lgpd_texto')
      expect(leadsGravados()).toHaveLength(0)
    })

    it(`texto com mais de ${LGPD_CONSENT_TEXT_MAX_LENGTH} caracteres responde 422, sem gravar`, async () => {
      const resposta = await enviar({
        ...ENVIO_COMPLETO,
        aceite_lgpd_texto: 'a'.repeat(LGPD_CONSENT_TEXT_MAX_LENGTH + 1),
      })

      expect(resposta.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
      expect(resposta.body.fields).toHaveProperty('aceite_lgpd_texto')
      expect(leadsGravados()).toHaveLength(0)
    })

    /**
     * O instante e o endereço da política provam quando e a que o visitante
     * consentiu — o navegador não tem voz sobre nenhum dos dois.
     */
    it.each([
      ['o instante do aceite', { aceite_lgpd_em: '2020-01-01T00:00:00.000Z' }],
      ['o endereço da política', { aceite_lgpd_politica_url: 'https://mau.exemplo/politica' }],
    ])('recusa com 422 o corpo que tenta definir %s', async (_campo, extra) => {
      const resposta = await enviar({ ...ENVIO_COMPLETO, ...extra })

      expect(resposta.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
      expect(leadsGravados()).toHaveLength(0)
    })
  })

  describe('validação, a mesma do relay que esta tarefa aposentou', () => {
    it('sem nome, e-mail e consentimento responde 422 com os erros por campo', async () => {
      const resposta = await enviar({ nome: '  ', email: 'ana', aceite_lgpd: false })

      expect(resposta.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
      expect(resposta.body.error).toBe('Dados inválidos.')
      expect(Object.keys(resposta.body.fields).sort()).toEqual(['aceite_lgpd', 'email', 'nome'])
    })

    it('porte fora da lista responde 422', async () => {
      const resposta = await enviar({ ...ENVIO_COMPLETO, porte_cachorro: 'gigante' })

      expect(resposta.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
      expect(resposta.body.fields).toHaveProperty('porte_cachorro')
    })

    it('recusa não grava nada', async () => {
      await enviar({ nome: '', email: '', aceite_lgpd: false })

      expect(leadsGravados()).toHaveLength(0)
    })
  })

  /**
   * A suíte não fala com a rede, e o código de produção também não deve: com o
   * destino externo fora, um envio não pode gerar nenhuma chamada de saída.
   */
  it('um envio completo não faz nenhuma chamada de rede', async () => {
    const fetchOriginal = global.fetch
    const fetchEspiao = jest.fn()
    global.fetch = fetchEspiao as unknown as typeof fetch

    try {
      const resposta = await enviar(ENVIO_COMPLETO)

      expect(resposta.status).toBe(HttpStatus.OK)
      expect(fetchEspiao).not.toHaveBeenCalled()
    } finally {
      global.fetch = fetchOriginal
    }
  })

  it('é rota pública: envia sem token nenhum', async () => {
    const resposta = await enviar(ENVIO_COMPLETO)

    expect(resposta.status).toBe(HttpStatus.OK)
  })
})
