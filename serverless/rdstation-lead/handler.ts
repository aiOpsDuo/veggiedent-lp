// Handler platform-agnostic do relay de leads Veggiedent -> RD Station Marketing.
// Ver README.md e RDStation_Serverless_Especificacao_Tecnica_v1.0.md.
//
// Este arquivo nao importa nada de Vercel/Netlify/Cloudflare de proposito —
// os adapters em adapters/ fazem a ponte entre o runtime de cada plataforma
// e as funcoes puras abaixo. Nenhuma credencial real esta presente aqui: os
// valores de RDSTATION_API_TOKEN e RDSTATION_CONVERSION_IDENTIFIER sao lidos
// do ambiente do servidor em tempo de execucao e ficam vazios neste repositorio
// (ver .env.example).

import type { LeadRelayRequestBody, NormalizedRequest, NormalizedResponse } from './types'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function jsonResponse(statusCode: number, body: unknown, extraHeaders: Record<string, string> = {}): NormalizedResponse {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify(body),
  }
}

function getAllowedOrigin(requestOrigin: string | null): string | null {
  const allowList = (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

  if (!requestOrigin) return null
  return allowList.includes(requestOrigin) ? requestOrigin : null
}

function corsHeaders(requestOrigin: string | null): Record<string, string> {
  const allowedOrigin = getAllowedOrigin(requestOrigin)
  if (!allowedOrigin) return {}

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  }
}

/** Valida o corpo da requisicao. Retorna a lista de erros por campo (vazia = valido). */
function validate(body: Partial<LeadRelayRequestBody>): Record<string, string> {
  const errors: Record<string, string> = {}

  if (!body.nome || !body.nome.trim()) {
    errors.nome = 'Nome e obrigatorio.'
  }

  if (!body.email || !EMAIL_REGEX.test(body.email)) {
    errors.email = 'E-mail invalido.'
  }

  if (body.aceite_lgpd !== true) {
    errors.aceite_lgpd = 'Consentimento LGPD e obrigatorio.'
  }

  if (body.porte_cachorro && !['pequeno', 'medio', 'grande'].includes(body.porte_cachorro)) {
    errors.porte_cachorro = 'Valor invalido.'
  }

  return errors
}

/**
 * Envia o lead para a API de Conversoes do RD Station Marketing.
 *
 * O formato de payload abaixo segue a API de Conversoes (event_type CONVERSION,
 * event_family CDP) documentada pelo RD Station. CONFIRMAR com a documentacao
 * vigente do RD Station (developers.rdstation.com) antes do go-live — o metodo
 * de autenticacao (token publico vs. OAuth2 com refresh token) e os nomes dos
 * campos personalizados (cf_*) dependem de como a conta RD Station da Virbac
 * foi configurada e precisam ser validados junto ao time da Virbac/RD Station.
 */
async function sendToRDStation(body: LeadRelayRequestBody): Promise<{ ok: boolean; status: number }> {
  const token = process.env.RDSTATION_API_TOKEN
  const conversionIdentifier = process.env.RDSTATION_CONVERSION_IDENTIFIER

  if (!token || !conversionIdentifier) {
    throw new Error(
      'RDSTATION_API_TOKEN ou RDSTATION_CONVERSION_IDENTIFIER nao configurados no ambiente do servidor.',
    )
  }

  const payload = {
    event_type: 'CONVERSION',
    event_family: 'CDP',
    payload: {
      conversion_identifier: conversionIdentifier,
      email: body.email,
      name: body.nome,
      mobile_phone: body.telefone,
      cf_nome_cachorro: body.nome_cachorro,
      cf_porte_cachorro: body.porte_cachorro,
      cf_cidade_estado: body.cidade_estado,
      cf_aceite_comunicacoes: body.aceite_comunicacoes,
      traffic_source: body.origem,
    },
  }

  const response = await fetch(`https://api.rd.services/platform/conversions?api_key=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  return { ok: response.ok, status: response.status }
}

/**
 * Funcao pura: recebe uma requisicao normalizada, devolve uma resposta
 * normalizada. Os adapters de plataforma (adapters/*.ts) convertem o
 * request/response nativo de cada runtime para este formato e de volta.
 */
export async function handleLeadRelay(request: NormalizedRequest): Promise<NormalizedResponse> {
  const cors = corsHeaders(request.origin)

  if (request.method === 'OPTIONS') {
    return { statusCode: 204, headers: cors, body: '' }
  }

  if (request.method !== 'POST') {
    return jsonResponse(405, { success: false, error: 'Metodo nao permitido.' }, cors)
  }

  const body = request.body as Partial<LeadRelayRequestBody> | null | undefined

  if (!body || typeof body !== 'object') {
    return jsonResponse(400, { success: false, error: 'Corpo da requisicao invalido.' }, cors)
  }

  // Honeypot: campo invisivel no formulario real. Se vier preenchido, a
  // submissao e descartada silenciosamente como sucesso (nao revela ao bot
  // que foi bloqueado), sem chamar o RD Station.
  if (body.website && body.website.trim().length > 0) {
    return jsonResponse(200, { success: true }, cors)
  }

  const validationErrors = validate(body)
  if (Object.keys(validationErrors).length > 0) {
    return jsonResponse(422, { success: false, error: 'Dados invalidos.', fields: validationErrors }, cors)
  }

  try {
    const result = await sendToRDStation(body as LeadRelayRequestBody)

    if (!result.ok) {
      return jsonResponse(
        502,
        { success: false, error: `RD Station recusou a conversao (status ${result.status}).` },
        cors,
      )
    }

    return jsonResponse(200, { success: true }, cors)
  } catch (error) {
    // Nao repassar detalhes internos (ex.: token ausente) ao cliente.
    console.error('[rdstation-lead] erro ao encaminhar lead:', error)
    return jsonResponse(500, { success: false, error: 'Erro interno ao processar o lead.' }, cors)
  }
}
