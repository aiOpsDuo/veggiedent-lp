/**
 * O que a API respondeu a uma chamada administrativa autenticada.
 *
 * `nao-autorizado` é o `401` da guarda global da API (SDD § D-03): o token que
 * o painel tem em mãos deixou de valer. É diferente de `indisponivel`, em que a
 * API não respondeu — no primeiro caso o operador precisa entrar de novo, no
 * segundo não adianta.
 */
export type AdminAccessCheck = 'autorizado' | 'nao-autorizado' | 'indisponivel'

const UNAUTHORIZED = 401
const FORBIDDEN = 403

/**
 * Endpoint usado para conferir se a API aceita o token do operador.
 *
 * É a listagem de seções porque ela é o endpoint administrativo mais barato que
 * existe e o primeiro que o painel vai consumir de verdade (T11). A resposta é
 * descartada: aqui interessa apenas se a guarda da API deixou passar.
 */
const ACCESS_PROBE_PATH = '/admin/sections'

/**
 * Cliente da API do CMS (SDD § "Visão de tiers").
 *
 * O painel fala com a API e só com ela para conteúdo, mídia e leads — o
 * Supabase é usado exclusivamente para autenticar. O token vai em cada
 * requisição, no mesmo cabeçalho que a guarda da API já lê.
 */
export class AdminApiClient {
  private readonly baseUrl: string

  constructor(
    baseUrl: string,
    private readonly fetchResource: typeof fetch = globalThis.fetch,
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, '')
  }

  async checkAccess(accessToken: string): Promise<AdminAccessCheck> {
    try {
      const response = await this.fetchResource(`${this.baseUrl}${ACCESS_PROBE_PATH}`, {
        headers: { authorization: `Bearer ${accessToken}` },
      })
      if (response.status === UNAUTHORIZED || response.status === FORBIDDEN) {
        return 'nao-autorizado'
      }
      return response.ok ? 'autorizado' : 'indisponivel'
    } catch {
      return 'indisponivel'
    }
  }
}
