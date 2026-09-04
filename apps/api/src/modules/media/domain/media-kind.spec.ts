import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { MEDIA_KIND_POLICIES, MEDIA_KINDS, policyForMimeType } from './media-kind'

/**
 * A política de cada bucket é declarada em dois lugares: nas migrações, que são
 * quem o armazenamento obedece, e neste módulo, que recusa o arquivo antes de
 * emitir credencial. Duas cópias da mesma regra divergem com o tempo — a menos
 * que algo compare as duas.
 *
 * Este teste lê as migrações de verdade e as aplica na mesma ordem que o banco
 * aplicaria, porque a política de um bucket não vive num arquivo só: ela é
 * criada em uma migração e alterada em outra. Um limite mudado lá sem ser mudado
 * aqui faria a API emitir credencial para um arquivo que o armazenamento
 * recusaria no meio do envio; mudado aqui sem ser lá, faria a API recusar um
 * arquivo que caberia.
 */

const MIGRATIONS_DIRECTORY = join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  '..',
  '..',
  'supabase',
  'migrations',
)

interface DeclaredBucket {
  fileSizeLimit: number
  allowedMimeTypes: readonly string[]
}

/**
 * Os parsers são deliberadamente ingênuos — se deixarem de reconhecer uma
 * migração, o teste falha em vez de aprovar por não ter encontrado nada.
 */
const BUCKET_INSERT = /\(\s*'([a-z-]+)',\s*'[a-z-]+',\s*true,\s*(\d+),[^[]*array\[([^\]]*)\]/g
const MIME_TYPES_UPDATE =
  /update\s+storage\.buckets\s+set\s+allowed_mime_types\s*=\s*array\[([^\]]*)\][^;]*?where\s+id\s*=\s*'([a-z-]+)'/gis

function toMimeTypeList(declared: string): string[] {
  return declared
    .split(',')
    .map((type) => type.trim().replace(/^'|'$/g, ''))
    .filter((type) => type.length > 0)
}

function applyInserts(sql: string, buckets: Map<string, DeclaredBucket>): void {
  for (const [, id, limit, types] of sql.matchAll(BUCKET_INSERT)) {
    buckets.set(id as string, {
      fileSizeLimit: Number(limit),
      allowedMimeTypes: toMimeTypeList(types as string),
    })
  }
}

function applyMimeTypeUpdates(sql: string, buckets: Map<string, DeclaredBucket>): void {
  for (const [, types, id] of sql.matchAll(MIME_TYPES_UPDATE)) {
    const bucket = buckets.get(id as string)
    if (bucket === undefined) {
      throw new Error(`Migração altera um bucket que nenhuma migração anterior criou: ${id}`)
    }
    bucket.allowedMimeTypes = toMimeTypeList(types as string)
  }
}

/** O estado dos buckets depois de todas as migrações, na ordem do nome. */
function declaredBuckets(): Map<string, DeclaredBucket> {
  const buckets = new Map<string, DeclaredBucket>()

  for (const file of readdirSync(MIGRATIONS_DIRECTORY).sort()) {
    const sql = readFileSync(join(MIGRATIONS_DIRECTORY, file), 'utf8')
    applyInserts(sql, buckets)
    applyMimeTypeUpdates(sql, buckets)
  }

  return buckets
}

/**
 * `veggiedent-captions` continua aparecendo aqui mesmo depois da T31: o
 * projeto hospedado recusa `delete` direto em `storage.buckets` ("Direct
 * deletion from storage tables is not allowed. Use the Storage API instead.",
 * SQLSTATE 42501), então a remoção do bucket foi feita pela Storage API
 * (`.../bucket/veggiedent-captions`), fora de qualquer migração — nenhuma
 * migração SQL apaga a linha que a criou. `MEDIA_KINDS` já não referencia mais
 * `caption`, então nenhuma política aponta para este bucket órfão.
 */
describe('política de bucket por natureza de mídia', () => {
  const buckets = declaredBuckets()

  it('encontra os três buckets nas migrações — o teste não pode passar por não achar nada', () => {
    expect([...buckets.keys()].sort()).toEqual([
      'veggiedent-captions',
      'veggiedent-images',
      'veggiedent-videos',
    ])
  })

  it.each(MEDIA_KINDS)('a política de %s repete o que as migrações declaram', (kind) => {
    const policy = MEDIA_KIND_POLICIES[kind]
    const declared = buckets.get(policy.bucket)

    expect(declared).toBeDefined()
    expect(policy.maxBytes).toBe(declared?.fileSizeLimit)
    expect([...policy.acceptedMimeTypes].sort()).toEqual([...(declared?.allowedMimeTypes ?? [])].sort())
  })

  it('deduz a natureza a partir do tipo do arquivo', () => {
    expect(policyForMimeType('video/webm')?.kind).toBe('video')
    expect(policyForMimeType('IMAGE/PNG')?.kind).toBe('image')
  })

  /**
   * SVG entrou na lista por decisão registrada no CHANGELOG de 2026-09-02: a LP
   * usa quatro SVGs reais e só operador autenticado envia arquivo.
   */
  it('reconhece SVG como imagem', () => {
    expect(policyForMimeType('image/svg+xml')?.kind).toBe('image')
  })

  it('não reconhece tipo fora das listas declaradas', () => {
    expect(policyForMimeType('application/pdf')).toBeUndefined()
  })
})
