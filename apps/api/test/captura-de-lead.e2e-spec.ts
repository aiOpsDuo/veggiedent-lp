import { HttpStatus } from '@nestjs/common'
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
 *    nenhuma linha.
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
   * O consentimento com a Política de Privacidade não é gravado — a coluna
   * `aceite_lgpd` saiu da tabela na T18 —, mas continua sendo **condição de
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

    it('marcado, o lead é gravado sem nenhuma coluna de consentimento', async () => {
      const resposta = await enviar(ENVIO_COMPLETO)

      expect(resposta.status).toBe(HttpStatus.OK)
      expect(Object.keys(unicoLead())).not.toContain('aceite_lgpd')
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
