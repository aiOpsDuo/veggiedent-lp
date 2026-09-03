import { env } from '../config/env'
import type { PublishedContent, PublishedSections } from './published-content'

/**
 * A leitura de `GET /api/content` (SDD § D-08).
 *
 * Uma única responsabilidade: transformar a resposta HTTP em conteúdo utilizável
 * **ou** em `null`. Nunca lança. Quem chama não precisa distinguir "a API caiu",
 * "respondeu 500" ou "respondeu um corpo ilegível" — as três têm o mesmo destino,
 * que é renderizar o instantâneo embutido. Distinguir os casos aqui só criaria
 * ramos que ninguém consome.
 */

/**
 * O `fetch` do navegador precisa ser chamado com o objeto global como contexto:
 * guardá-lo numa variável e chamá-lo dali o invocaria com outro contexto, e o
 * navegador recusa isso com "Illegal invocation" — falha que o jsdom dos testes
 * não reproduz (defeito real encontrado na T10, ver `admin-api-client.ts`).
 */
const browserFetch: typeof fetch = (input, init) => globalThis.fetch(input, init)

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Lê o corpo da resposta sem confiar nele: o que não tem a forma esperada é descartado. */
function toPublishedContent(body: unknown): PublishedContent | null {
  if (!isRecord(body) || !isRecord(body.sections)) return null

  return {
    sections: body.sections as PublishedSections,
    metadata: isRecord(body.metadata) ? (body.metadata as PublishedContent['metadata']) : null,
  }
}

export async function fetchPublishedContent(
  endpoint: string = env.contentEndpoint,
  fetchResource: typeof fetch = browserFetch,
): Promise<PublishedContent | null> {
  try {
    const response = await fetchResource(endpoint)
    if (!response.ok) return null

    return toPublishedContent(await response.json())
  } catch {
    return null
  }
}
