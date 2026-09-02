import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { MEDIA_KIND_POLICIES, MEDIA_KINDS, policyForMimeType } from './media-kind'

/**
 * A política de cada bucket é declarada em dois lugares: na migração, que é
 * quem o armazenamento obedece, e neste módulo, que recusa o arquivo antes de
 * emitir credencial. Duas cópias da mesma regra divergem com o tempo — a menos
 * que algo compare as duas.
 *
 * Este teste lê a migração de verdade. Um limite mudado lá sem ser mudado aqui
 * faria a API emitir credencial para um arquivo que o armazenamento recusaria
 * no meio do envio; mudado aqui sem ser lá, faria a API recusar um arquivo que
 * caberia.
 */

const MIGRATION = join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  '..',
  '..',
  'supabase',
  'migrations',
  '20260902120500_create_storage_buckets.sql',
)

interface DeclaredBucket {
  readonly fileSizeLimit: number
  readonly allowedMimeTypes: readonly string[]
}

/**
 * Lê os `values (...)` do `insert into storage.buckets` da migração. O parser é
 * deliberadamente ingênuo — se ele deixar de reconhecer a migração, o teste
 * falha em vez de aprovar por não ter encontrado nada.
 */
function declaredBuckets(): Map<string, DeclaredBucket> {
  const sql = readFileSync(MIGRATION, 'utf8')
  const entries = new Map<string, DeclaredBucket>()

  const bucketBlock =
    /\(\s*'([a-z-]+)',\s*'[a-z-]+',\s*true,\s*(\d+),[^[]*array\[([^\]]*)\]/g
  for (const [, id, limit, types] of sql.matchAll(bucketBlock)) {
    entries.set(id as string, {
      fileSizeLimit: Number(limit),
      allowedMimeTypes: (types as string)
        .split(',')
        .map((type) => type.trim().replace(/^'|'$/g, ''))
        .filter((type) => type.length > 0),
    })
  }

  return entries
}

describe('política de bucket por natureza de mídia', () => {
  const buckets = declaredBuckets()

  it('encontra os três buckets na migração — o teste não pode passar por não achar nada', () => {
    expect([...buckets.keys()].sort()).toEqual([
      'veggiedent-captions',
      'veggiedent-images',
      'veggiedent-videos',
    ])
  })

  it.each(MEDIA_KINDS)('a política de %s repete o que a migração declara', (kind) => {
    const policy = MEDIA_KIND_POLICIES[kind]
    const declared = buckets.get(policy.bucket)

    expect(declared).toBeDefined()
    expect(policy.maxBytes).toBe(declared?.fileSizeLimit)
    expect([...policy.acceptedMimeTypes].sort()).toEqual([...(declared?.allowedMimeTypes ?? [])].sort())
  })

  it('deduz a natureza a partir do tipo do arquivo', () => {
    expect(policyForMimeType('video/webm')?.kind).toBe('video')
    expect(policyForMimeType('IMAGE/PNG')?.kind).toBe('image')
    expect(policyForMimeType('text/vtt')?.kind).toBe('caption')
  })

  /** SVG está fora da lista de propósito: é documento executável (ver migração). */
  it('não reconhece tipo fora das listas declaradas', () => {
    expect(policyForMimeType('image/svg+xml')).toBeUndefined()
    expect(policyForMimeType('application/pdf')).toBeUndefined()
  })
})
