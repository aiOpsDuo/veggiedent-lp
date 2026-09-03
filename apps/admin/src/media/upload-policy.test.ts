import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { MEDIA_FIELD_TYPES } from '@veggiedent/content-schema'
import {
  PROJECT_UPLOAD_CEILING_BYTES,
  UPLOAD_POLICIES,
  maxBytesOf,
  refusalFor,
} from './upload-policy'

/**
 * O painel recusa arquivo antes de qualquer chamada, e para isso repete no
 * navegador o que os buckets declaram. Duas cópias da mesma regra divergem com
 * o tempo — a menos que algo compare as duas com a fonte que o armazenamento
 * obedece, que são as migrações.
 *
 * O parser é o mesmo raciocínio de `apps/api/src/modules/media/domain/media-kind.spec.ts`,
 * escrito de novo porque testes de workspaces diferentes não compartilham
 * arquivo. Ele é deliberadamente ingênuo: se deixar de reconhecer uma migração,
 * o teste falha em vez de aprovar por não ter encontrado nada.
 */

/**
 * As migrações ficam na raiz do repositório, e o diretório de trabalho do teste
 * é o do workspace. Subir até encontrá-las mantém o teste válido rodado da raiz
 * ou de dentro de `apps/admin`, sem contar níveis de diretório à mão.
 */
function migrationsDirectory(): string {
  let directory = process.cwd()
  for (;;) {
    const candidate = join(directory, 'supabase', 'migrations')
    if (existsSync(candidate)) {
      return candidate
    }
    const parent = dirname(directory)
    if (parent === directory) {
      throw new Error('Não encontrei supabase/migrations acima do diretório de trabalho.')
    }
    directory = parent
  }
}

const MIGRATIONS_DIRECTORY = migrationsDirectory()

const BUCKET_INSERT = /\(\s*'([a-z-]+)',\s*'[a-z-]+',\s*true,\s*(\d+),[^[]*array\[([^\]]*)\]/g
const MIME_TYPES_UPDATE =
  /update\s+storage\.buckets\s+set\s+allowed_mime_types\s*=\s*array\[([^\]]*)\][^;]*?where\s+id\s*=\s*'([a-z-]+)'/gis

interface DeclaredBucket {
  fileSizeLimit: number
  allowedMimeTypes: readonly string[]
}

function toMimeTypeList(declared: string): string[] {
  return declared
    .split(',')
    .map((type) => type.trim().replace(/^'|'$/g, ''))
    .filter((type) => type.length > 0)
}

/** O estado dos buckets depois de todas as migrações, na ordem do nome. */
function declaredBuckets(): Map<string, DeclaredBucket> {
  const buckets = new Map<string, DeclaredBucket>()

  for (const file of readdirSync(MIGRATIONS_DIRECTORY).sort()) {
    const sql = readFileSync(join(MIGRATIONS_DIRECTORY, file), 'utf8')
    for (const [, id, limit, types] of sql.matchAll(BUCKET_INSERT)) {
      buckets.set(id, { fileSizeLimit: Number(limit), allowedMimeTypes: toMimeTypeList(types) })
    }
    for (const [, types, id] of sql.matchAll(MIME_TYPES_UPDATE)) {
      const bucket = buckets.get(id)
      if (bucket === undefined) {
        throw new Error(`Migração altera um bucket que nenhuma migração anterior criou: ${id}`)
      }
      bucket.allowedMimeTypes = toMimeTypeList(types)
    }
  }

  return buckets
}

describe('o catálogo do painel repete o que as migrações declaram', () => {
  const buckets = declaredBuckets()

  it('encontra os três buckets — o teste não pode passar por não achar nada', () => {
    expect([...buckets.keys()].sort()).toEqual([
      'veggiedent-captions',
      'veggiedent-images',
      'veggiedent-videos',
    ])
  })

  it.each(MEDIA_FIELD_TYPES)('o campo %s aponta para o bucket declarado', (fieldType) => {
    const policy = UPLOAD_POLICIES[fieldType]
    const declared = buckets.get(policy.bucket)

    expect(declared).toBeDefined()
    expect(policy.bucketMaxBytes).toBe(declared?.fileSizeLimit)
    expect([...policy.acceptedMimeTypes].sort()).toEqual(
      [...(declared?.allowedMimeTypes ?? [])].sort(),
    )
  })
})

describe('o teto de 50 MB do projeto prevalece sobre o limite do bucket', () => {
  it('recorta o limite de vídeo, que o bucket declara em 500 MB', () => {
    expect(UPLOAD_POLICIES.video.bucketMaxBytes).toBeGreaterThan(PROJECT_UPLOAD_CEILING_BYTES)
    expect(maxBytesOf('video')).toBe(PROJECT_UPLOAD_CEILING_BYTES)
  })

  it('não mexe no limite de imagem, que já é menor que o teto', () => {
    expect(maxBytesOf('imagem')).toBe(UPLOAD_POLICIES.imagem.bucketMaxBytes)
  })
})

describe('recusa antes de qualquer chamada (SDD § C-06, C-07)', () => {
  it('recusa tipo não suportado dizendo o que é aceito', () => {
    expect(refusalFor('video', { type: 'application/pdf', size: 1000 })).toBe(
      'Tipo de arquivo não suportado para vídeo. Envie MP4 ou WebM.',
    )
  })

  it('recusa arquivo sem tipo reconhecido pelo navegador', () => {
    expect(refusalFor('imagem', { type: '', size: 1000 })).toContain('não suportado')
  })

  it('recusa vídeo acima do teto do projeto com o tamanho e o limite na mensagem', () => {
    expect(refusalFor('video', { type: 'video/mp4', size: 60 * 1024 * 1024 })).toBe(
      'O arquivo tem 60 MB e o limite para vídeo é 50 MB.',
    )
  })

  it('recusa imagem acima do limite do bucket de imagens', () => {
    expect(refusalFor('imagem', { type: 'image/png', size: 11 * 1024 * 1024 })).toBe(
      'O arquivo tem 11 MB e o limite para imagem é 10 MB.',
    )
  })

  it('deixa passar o arquivo que cabe', () => {
    expect(refusalFor('video', { type: 'video/mp4', size: 4 * 1024 * 1024 })).toBeNull()
  })

  it('aceita o tipo escrito em maiúsculas, como alguns navegadores o informam', () => {
    expect(refusalFor('imagem', { type: 'IMAGE/PNG', size: 1000 })).toBeNull()
  })
})
