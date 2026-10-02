import { afterEach, describe, expect, it, vi } from 'vitest'
import { LGPD_CONSENT_TEXT_MAX_LENGTH } from '@veggiedent/content-schema'
import { submitLead } from './submitLead'
import type { LeadFormValues } from '../CapturaLead.types'

/**
 * Regressão do risco R-01 (T27) — o formulário coleta `conheceVirbac`,
 * `usaProdutoVirbac` e `qualProdutoVirbac` do visitante, e o payload que
 * `submitLead` monta os descartava silenciosamente: a API aceita e grava os
 * três campos (`submit-lead.dto.ts`), mas ninguém os enviava.
 *
 * Este teste prova o contrato do **produtor** (o que a LP envia), não do
 * consumidor — que já era coberto pelos testes da API. É exatamente a
 * distinção que deixou o risco vivo por dez tarefas (ver CHANGELOG de
 * 2026-09-04): testar que a API aceita os campos nunca provou que a LP os
 * enviava.
 */

const VALORES_COMPLETOS: LeadFormValues = {
  nome: '  Ana Souza  ',
  email: '  ana@exemplo.com.br  ',
  telefone: '11999999999',
  nomeCachorro: 'Bidu',
  porteCachorro: 'medio',
  cidadeEstado: 'São Paulo, SP',
  conheceVirbac: 'sim',
  usaProdutoVirbac: 'sim',
  qualProdutoVirbac: '  Veggiedent  ',
  aceiteLgpd: true,
  aceiteComunicacoes: false,
}

const TEXTO_DO_ACEITE =
  'Li e aceito a Política de Privacidade e autorizo o uso dos meus dados para receber o guia e comunicações relacionadas.'

function fetchOk() {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ success: true }), { status: 201 }),
  ) as unknown as typeof fetch
}

function corpoEnviado(mockFetch: ReturnType<typeof fetchOk>): Record<string, unknown> {
  const chamada = vi.mocked(mockFetch).mock.calls[0]
  const init = chamada?.[1] as RequestInit
  return JSON.parse(init.body as string)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('submitLead', () => {
  it('inclui os três campos sobre a Virbac no payload enviado à API (R-01)', async () => {
    const mockFetch = fetchOk()
    vi.stubGlobal('fetch', mockFetch)

    await submitLead(VALORES_COMPLETOS, TEXTO_DO_ACEITE)

    const corpo = corpoEnviado(mockFetch)
    expect(corpo).toMatchObject({
      conhece_virbac: 'sim',
      usa_produto_virbac: 'sim',
      qual_produto_virbac: 'Veggiedent',
    })
  })

  it('omite os três campos da Virbac quando o visitante não os respondeu', async () => {
    const mockFetch = fetchOk()
    vi.stubGlobal('fetch', mockFetch)

    await submitLead(
      {
        ...VALORES_COMPLETOS,
        conheceVirbac: '',
        usaProdutoVirbac: '',
        qualProdutoVirbac: '',
      },
      TEXTO_DO_ACEITE,
    )

    const corpo = corpoEnviado(mockFetch)
    expect(corpo.conhece_virbac).toBeUndefined()
    expect(corpo.usa_produto_virbac).toBeUndefined()
    expect(corpo.qual_produto_virbac).toBeUndefined()
  })

  it('envia todos os campos que o DTO da API aceita, com os nomes exatos do contrato', async () => {
    const mockFetch = fetchOk()
    vi.stubGlobal('fetch', mockFetch)

    await submitLead(VALORES_COMPLETOS, TEXTO_DO_ACEITE)

    const corpo = corpoEnviado(mockFetch)
    expect(corpo).toEqual({
      nome: 'Ana Souza',
      email: 'ana@exemplo.com.br',
      telefone: '11999999999',
      nome_cachorro: 'Bidu',
      porte_cachorro: 'medio',
      cidade_estado: 'São Paulo, SP',
      conhece_virbac: 'sim',
      usa_produto_virbac: 'sim',
      qual_produto_virbac: 'Veggiedent',
      aceite_lgpd: true,
      aceite_lgpd_texto: TEXTO_DO_ACEITE,
      aceite_comunicacoes: false,
      origem: 'lp-veggiedent',
    })
  })

  /**
   * Pedido do cliente de 2026-10-02: o aceite é gravado com o texto que o
   * visitante viu. O instante e o endereço da política são da API — a LP não
   * os envia, e a API recusaria o corpo que os trouxesse.
   */
  describe('registro do consentimento LGPD', () => {
    it('não envia o instante do aceite nem o endereço da política', async () => {
      const mockFetch = fetchOk()
      vi.stubGlobal('fetch', mockFetch)

      await submitLead(VALORES_COMPLETOS, TEXTO_DO_ACEITE)

      const corpo = corpoEnviado(mockFetch)
      expect(corpo).not.toHaveProperty('aceite_lgpd_em')
      expect(corpo).not.toHaveProperty('aceite_lgpd_politica_url')
    })

    it(`corta o texto em ${LGPD_CONSENT_TEXT_MAX_LENGTH} caracteres, para a API não recusar o lead`, async () => {
      const mockFetch = fetchOk()
      vi.stubGlobal('fetch', mockFetch)

      await submitLead(VALORES_COMPLETOS, 'a'.repeat(LGPD_CONSENT_TEXT_MAX_LENGTH + 50))

      expect(corpoEnviado(mockFetch).aceite_lgpd_texto).toBe(
        'a'.repeat(LGPD_CONSENT_TEXT_MAX_LENGTH),
      )
    })
  })
})
