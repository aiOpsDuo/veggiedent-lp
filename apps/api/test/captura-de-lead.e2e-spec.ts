import { HttpStatus } from '@nestjs/common'
import request from 'supertest'
import { LEAD_RELAY } from '../src/modules/leads/domain/lead-relay.port'
import {
  relayFailed,
  relayNotAttempted,
} from '../src/modules/leads/domain/rdstation-outcome'
import { startContentHarness, type ContentHarness } from './content-harness'
import { FakeLeadRelay } from './fake-lead-relay'
import type { Row } from './fake-supabase'

/**
 * `POST /api/leads` (T8; SDD § D-07, § C-11, § R-01 e § R-08).
 *
 * O que esta suíte prende, em ordem de importância:
 *
 * 1. **O lead sobrevive ao RD Station.** Recusa, exceção ou credencial ausente:
 *    a linha está gravada e o visitante vê sucesso. É a razão de a tarefa
 *    existir — hoje, em produção, uma falha do relay perde o lead.
 * 2. **Os três campos que hoje são descartados** chegam à tabela (risco R-01).
 * 3. **A ordem é gravar e só então repassar**, não o contrário.
 * 4. **O honeypot não grava nem repassa**, e responde sucesso.
 * 5. **A validação é a mesma do relay** que esta tarefa aposenta.
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
  aceite_comunicacoes: true,
  origem: 'lp-veggiedent',
}

describe('captura de lead', () => {
  let harness: ContentHarness
  let relay: FakeLeadRelay

  beforeEach(async () => {
    relay = new FakeLeadRelay()
    harness = await startContentHarness([{ provide: LEAD_RELAY, useValue: relay }])
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

    it('repassa os três campos ao RD Station', async () => {
      await enviar(ENVIO_COMPLETO)

      expect(relay.forwarded[0]).toMatchObject({
        conheceVirbac: 'sim',
        usaProdutoVirbac: 'sim',
        qualProdutoVirbac: 'Veggiedent Fresh',
      })
    })

    it('marca o repasse como ok, sem mensagem de erro', async () => {
      await enviar(ENVIO_COMPLETO)

      expect(unicoLead()).toMatchObject({ rdstation_status: 'ok', rdstation_error: null })
    })

    it('preserva a acentuação do que o visitante digitou', async () => {
      await enviar(ENVIO_COMPLETO)

      expect(unicoLead()).toMatchObject({ cidade_estado: 'São Paulo/SP' })
    })

    it('grava o lead antes de tentar o RD Station', async () => {
      const gravadosNoInstanteDoRepasse: number[] = []
      relay.observe(() => gravadosNoInstanteDoRepasse.push(leadsGravados().length))

      await enviar(ENVIO_COMPLETO)

      expect(gravadosNoInstanteDoRepasse).toEqual([1])
      expect(harness.database.callsTo('leads').map((call) => call.operation)).toEqual([
        'insert',
        'update',
      ])
    })
  })

  describe('quando o RD Station não aceita', () => {
    it('recusa do RD Station: lead gravado, visitante vê sucesso, falha registrada', async () => {
      relay.respondWith(relayFailed('RD Station recusou a conversão (status 401).'))

      const resposta = await enviar(ENVIO_COMPLETO)

      expect(resposta.status).toBe(HttpStatus.OK)
      expect(resposta.body).toEqual({ success: true })
      expect(unicoLead()).toMatchObject({
        email: 'ana@exemplo.com',
        rdstation_status: 'falhou',
        rdstation_error: 'RD Station recusou a conversão (status 401).',
      })
    })

    it('exceção no repasse não vaza para o visitante nem perde o lead', async () => {
      relay.throwOnForward(new Error('getaddrinfo ENOTFOUND api.rd.services'))

      const resposta = await enviar(ENVIO_COMPLETO)

      expect(resposta.status).toBe(HttpStatus.OK)
      expect(leadsGravados()).toHaveLength(1)
      expect(unicoLead()).toMatchObject({ rdstation_status: 'falhou' })
    })

    it('a mensagem guardada não repete o detalhe interno da exceção', async () => {
      relay.throwOnForward(new Error('api_key=segredo-que-nao-pode-vazar'))

      await enviar(ENVIO_COMPLETO)

      expect(String(unicoLead().rdstation_error)).not.toContain('segredo-que-nao-pode-vazar')
    })

    it('credencial ausente vira nao_enviado, sem derrubar a gravação', async () => {
      relay.respondWith(relayNotAttempted('RDSTATION_API_TOKEN não configurado.'))

      const resposta = await enviar(ENVIO_COMPLETO)

      expect(resposta.status).toBe(HttpStatus.OK)
      expect(unicoLead()).toMatchObject({ rdstation_status: 'nao_enviado' })
    })
  })

  describe('honeypot', () => {
    it('preenchido: responde sucesso, não grava e não repassa', async () => {
      const resposta = await enviar({ ...ENVIO_COMPLETO, website: 'http://spam.exemplo' })

      expect(resposta.status).toBe(HttpStatus.OK)
      expect(resposta.body).toEqual({ success: true })
      expect(leadsGravados()).toHaveLength(0)
      expect(relay.forwarded).toHaveLength(0)
    })

    it('preenchido junto de dados inválidos, ainda responde sucesso', async () => {
      const resposta = await enviar({ website: 'x', nome: '', email: 'nao-e-email' })

      expect(resposta.status).toBe(HttpStatus.OK)
      expect(leadsGravados()).toHaveLength(0)
    })
  })

  /**
   * O consentimento com a Política de Privacidade não é mais gravado — a coluna
   * `aceite_lgpd` saiu da tabela na T18 —, mas continua sendo **condição de
   * envio**. Estes dois casos são a guarda de que remover a persistência não
   * afrouxou a regra: sem o consentimento nenhum lead nasce e nada é repassado
   * (SDD § "Modelo de dados"; PLAN.md § T18).
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

    it('ausente, não grava lead nenhum nem chama o RD Station', async () => {
      await enviar(semOConsentimento())

      expect(leadsGravados()).toHaveLength(0)
      expect(relay.forwarded).toHaveLength(0)
    })

    it('recusado explicitamente, responde 422', async () => {
      const resposta = await enviar({ ...ENVIO_COMPLETO, aceite_lgpd: false })

      expect(resposta.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
      expect(resposta.body.fields).toHaveProperty('aceite_lgpd')
    })

    it('marcado, o lead é gravado sem nenhuma coluna de consentimento', async () => {
      const resposta = await enviar(ENVIO_COMPLETO)

      expect(resposta.status).toBe(HttpStatus.OK)
      expect(Object.keys(unicoLead())).not.toContain('aceite_lgpd')
    })
  })

  describe('validação, a mesma do relay que esta tarefa aposenta', () => {
    it('sem nome, e-mail e consentimento responde 422 com os erros por campo', async () => {
      const resposta = await enviar({ nome: '  ', email: 'ana', aceite_lgpd: false })

      expect(resposta.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
      expect(resposta.body.error).toBe('Dados inválidos.')
      expect(Object.keys(resposta.body.fields).sort()).toEqual([
        'aceite_lgpd',
        'email',
        'nome',
      ])
    })

    it('porte fora da lista responde 422', async () => {
      const resposta = await enviar({ ...ENVIO_COMPLETO, porte_cachorro: 'gigante' })

      expect(resposta.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
      expect(resposta.body.fields).toHaveProperty('porte_cachorro')
    })

    it('recusa não grava nem repassa nada', async () => {
      await enviar({ nome: '', email: '', aceite_lgpd: false })

      expect(leadsGravados()).toHaveLength(0)
      expect(relay.forwarded).toHaveLength(0)
    })
  })

  describe('quando o banco falha', () => {
    it('aí sim o visitante vê erro, porque o lead se perderia', async () => {
      harness.database.failOn('leads')

      const resposta = await enviar(ENVIO_COMPLETO)

      expect(resposta.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR)
      expect(relay.forwarded).toHaveLength(0)
    })
  })

  it('é rota pública: envia sem token nenhum', async () => {
    const resposta = await enviar(ENVIO_COMPLETO)

    expect(resposta.status).toBe(HttpStatus.OK)
  })
})

/**
 * O estado real de hoje: `RDSTATION_API_TOKEN` e `RDSTATION_CONVERSION_IDENTIFIER`
 * estão vazios em `apps/api/.env`, porque a conta da Virbac ainda não foi
 * confirmada (SDD § R-08). Aqui o adaptador **verdadeiro** entra em cena — não
 * há dublê de repasse — e o teste exige que isso não custe um lead, não derrube
 * a resposta e não gere nenhuma chamada de rede.
 */
describe('captura de lead com o RD Station de verdade e sem credencial', () => {
  let harness: ContentHarness
  let fetchOriginal: typeof fetch
  let fetchEspiao: jest.Mock

  beforeEach(async () => {
    fetchOriginal = global.fetch
    fetchEspiao = jest.fn()
    harness = await startContentHarness()
    global.fetch = fetchEspiao as unknown as typeof fetch
  })

  afterEach(async () => {
    global.fetch = fetchOriginal
    await harness.close()
  })

  it('grava o lead, responde sucesso e marca nao_enviado, sem tocar na rede', async () => {
    const resposta = await request(harness.app.getHttpServer())
      .post('/api/leads')
      .send(ENVIO_COMPLETO)

    expect(resposta.status).toBe(HttpStatus.OK)
    expect(resposta.body).toEqual({ success: true })

    const lead = harness.database.rows('leads')[0] as Row
    expect(lead).toMatchObject({
      email: 'ana@exemplo.com',
      conhece_virbac: 'sim',
      rdstation_status: 'nao_enviado',
    })
    expect(String(lead.rdstation_error)).toContain('RDSTATION_API_TOKEN')
    expect(fetchEspiao).not.toHaveBeenCalled()
  })
})
