// Adapter de referencia para um Cloudflare Worker.
// Uso: copiar para o entrypoint do Worker (ex.: src/index.ts do projeto do
// Worker), ajustando o caminho do import abaixo.
//
// NAO TESTADO EM PRODUCAO — apenas ilustra a integracao. Variaveis de
// ambiente em Workers sao lidas via `env` no binding, nao via `process.env`
// (handler.ts usa `process.env` assumindo um runtime Node-like; adaptar
// conforme necessario ao portar para o runtime do Workers).
import { handleLeadRelay } from '../handler'
import type { NormalizedRequest } from '../types'

export default {
  async fetch(request: Request): Promise<Response> {
    const body = request.method === 'POST' ? await request.json().catch(() => null) : null

    const normalized: NormalizedRequest = {
      method: request.method,
      origin: request.headers.get('origin'),
      body,
    }

    const result = await handleLeadRelay(normalized)

    return new Response(result.body, {
      status: result.statusCode,
      headers: result.headers,
    })
  },
}
