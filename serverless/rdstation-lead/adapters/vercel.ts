// Adapter de referencia para Vercel Functions.
// Uso: copiar para api/rdstation-lead.ts na raiz do projeto de hospedagem
// escolhido (convencao de rotas do Vercel), ajustando o caminho do import
// abaixo para onde handler.ts/types.ts forem efetivamente copiados.
//
// NAO TESTADO EM PRODUCAO — apenas ilustra a integracao. Ajustar tipos de
// request/response para a versao do @vercel/node instalada no projeto real.
import { handleLeadRelay } from '../handler'
import type { NormalizedRequest } from '../types'

export default async function handler(req: any, res: any) {
  const normalized: NormalizedRequest = {
    method: req.method ?? 'GET',
    origin: (req.headers?.origin as string) ?? null,
    body: req.body,
  }

  const result = await handleLeadRelay(normalized)

  res.status(result.statusCode)
  for (const [key, value] of Object.entries(result.headers)) {
    res.setHeader(key, value)
  }
  res.send(result.body)
}
