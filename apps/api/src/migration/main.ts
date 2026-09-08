import { CmsApi } from './cms-api'
import { defaultSnapshotPath, loadContentSnapshot } from './content-snapshot'
import {
  HttpMediaSource,
  PublicStorageProbe,
  SignedUrlUploader,
} from './media-transfer'
import { signInOperator } from './operator-token'
import { loadSnapshotIntoCms, type SnapshotLoadReport } from './seed-from-snapshot'
import type { MediaOrigin } from './media-reconciliation'

/**
 * Comando da carga de conteúdo a partir do instantâneo (PLAN.md § T23).
 *
 *   npm run migrate:content -w apps/api
 *
 * Variáveis de ambiente — ver `docs/CONTEUDO-DA-LP.md`, "Popular um ambiente
 * novo":
 *
 *   CMS_API_URL           raiz da API, com prefixo (padrão: http://localhost:3000/api)
 *   SUPABASE_URL          projeto Supabase de destino, o mesmo que a API usa
 *   CMS_ACCESS_TOKEN      token de um operador; ou, no lugar dele:
 *   CMS_OPERATOR_EMAIL    e-mail e senha de um operador já criado no Supabase Auth,
 *   CMS_OPERATOR_PASSWORD junto de SUPABASE_PUBLISHABLE_KEY.
 *   CONTENT_SNAPSHOT      caminho de outro instantâneo (padrão: o do repositório)
 *
 * Este é o único arquivo da carga que lê variáveis de ambiente e escreve na
 * saída padrão. Os demais recebem tudo por parâmetro, e é o que permite ao
 * teste de ponta a ponta rodar a mesma carga contra a aplicação em memória.
 */

const DEFAULT_API_URL = 'http://localhost:3000/api'

function required(name: string): string {
  const value = process.env[name]
  if (value === undefined || value.trim() === '') {
    throw new Error(`Defina ${name}.`)
  }
  return value
}

async function resolveAccessToken(supabaseUrl: string): Promise<string> {
  const token = process.env.CMS_ACCESS_TOKEN
  if (token !== undefined && token.trim() !== '') {
    return token
  }
  return signInOperator({
    supabaseUrl,
    publishableKey: required('SUPABASE_PUBLISHABLE_KEY'),
    email: required('CMS_OPERATOR_EMAIL'),
    password: required('CMS_OPERATOR_PASSWORD'),
  })
}

function count(report: SnapshotLoadReport, origin: MediaOrigin): number {
  return report.media.filter((entry) => entry.origin === origin).length
}

function summary(report: SnapshotLoadReport): string {
  return [
    '',
    `Mídias enviadas nesta execução: ${count(report, 'enviada-nesta-execucao')}`,
    `Mídias reaproveitadas do registro existente: ${count(report, 'registro-existente')}`,
    `Mídias reaproveitadas do documento gravado: ${count(report, 'documento-gravado')}`,
    `Seções gravadas: ${report.savedSections.length}`,
    `Seções desligadas: ${report.unpublishedSections.join(', ') || 'nenhuma'}`,
    `Título da página: ${report.metadataTitle ?? 'o instantâneo não traz metadados'}`,
    '',
  ].join('\n')
}

async function run(): Promise<void> {
  const baseUrl = process.env.CMS_API_URL ?? DEFAULT_API_URL
  const supabaseUrl = required('SUPABASE_URL')
  const snapshotPath = process.env.CONTENT_SNAPSHOT ?? defaultSnapshotPath()

  process.stdout.write(`Carregando ${snapshotPath}\n`)
  process.stdout.write(`no CMS em ${baseUrl}\n`)

  const report = await loadSnapshotIntoCms({
    api: new CmsApi({ baseUrl, accessToken: await resolveAccessToken(supabaseUrl) }),
    source: new HttpMediaSource(),
    uploader: new SignedUrlUploader(),
    targetStorage: new PublicStorageProbe(supabaseUrl),
    snapshot: loadContentSnapshot(snapshotPath),
    onProgress: (message) => process.stdout.write(`  ${message}\n`),
  })

  process.stdout.write(summary(report))
}

run().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
