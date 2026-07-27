// Adapter de referencia para Netlify Functions.
// Uso: copiar para netlify/functions/rdstation-lead.ts, ajustando o caminho
// do import abaixo para onde handler.ts/types.ts forem efetivamente copiados.
//
// NAO TESTADO EM PRODUCAO — apenas ilustra a integracao.
import { handleLeadRelay } from '../handler'
import type { NormalizedRequest } from '../types'

export async function handler(event: any) {
  const normalized: NormalizedRequest = {
    method: event.httpMethod ?? 'GET',
    origin: event.headers?.origin ?? event.headers?.Origin ?? null,
    body: event.body ? JSON.parse(event.body) : null,
  }

  const result = await handleLeadRelay(normalized)

  return {
    statusCode: result.statusCode,
    headers: result.headers,
    body: result.body,
  }
}
