import { CmsApi } from './cms-api'
import { loadLandingPageContent } from './content-source'
import { SignedUrlUploader } from './media-uploader'
import { migrateContent } from './migrate-content'
import { signInOperator } from './operator-token'

/**
 * Comando da carga inicial de conteúdo (PLAN.md § T9).
 *
 *   npm run migrate:content -w apps/api
 *
 * Variáveis de ambiente — ver README § "Migração inicial do conteúdo":
 *
 *   CMS_API_URL           raiz da API, com prefixo (padrão: http://localhost:3000/api)
 *   CMS_ACCESS_TOKEN      token de um operador; ou, no lugar dele:
 *   CMS_OPERATOR_EMAIL    e-mail e senha de um operador já criado no Supabase Auth,
 *   CMS_OPERATOR_PASSWORD junto de SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY.
 *
 * Este é o único arquivo da migração que lê variáveis de ambiente e escreve na
 * saída padrão. Os demais recebem tudo por parâmetro, e é o que permite ao teste
 * de ponta a ponta rodar a mesma migração contra a aplicação em memória.
 */

const DEFAULT_API_URL = 'http://localhost:3000/api'

function required(name: string): string {
  const value = process.env[name]
  if (value === undefined || value.trim() === '') {
    throw new Error(`Defina ${name}.`)
  }
  return value
}

async function resolveAccessToken(): Promise<string> {
  const token = process.env.CMS_ACCESS_TOKEN
  if (token !== undefined && token.trim() !== '') {
    return token
  }
  return signInOperator({
    supabaseUrl: required('SUPABASE_URL'),
    publishableKey: required('SUPABASE_PUBLISHABLE_KEY'),
    email: required('CMS_OPERATOR_EMAIL'),
    password: required('CMS_OPERATOR_PASSWORD'),
  })
}

async function run(): Promise<void> {
  const baseUrl = process.env.CMS_API_URL ?? DEFAULT_API_URL
  const api = new CmsApi({ baseUrl, accessToken: await resolveAccessToken() })

  process.stdout.write(`Migrando o conteúdo atual para ${baseUrl}\n`)

  const report = await migrateContent({
    api,
    uploader: new SignedUrlUploader(),
    content: loadLandingPageContent(),
    onProgress: (message) => process.stdout.write(`  ${message}\n`),
  })

  process.stdout.write(
    [
      '',
      `Mídias enviadas nesta execução: ${report.uploadedMedia.length}`,
      `Mídias reaproveitadas: ${report.reusedMedia.length}`,
      `Seções gravadas: ${report.savedSections.length}`,
      `Seções não publicadas: ${report.unpublishedSections.join(', ') || 'nenhuma'}`,
      `Título da página: ${report.metadataTitle}`,
      '',
    ].join('\n'),
  )
}

run().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
