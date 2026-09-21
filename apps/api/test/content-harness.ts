import type { INestApplication } from '@nestjs/common'
import { OPERATOR_DIRECTORY } from '../src/modules/operators/domain/operator-directory.port'
import { SECTION_REPOSITORY } from '../src/modules/content/domain/section-repository.port'
import { SITE_METADATA_REPOSITORY } from '../src/modules/metadata/domain/site-metadata-repository.port'
import { LEAD_INTAKE } from '../src/modules/leads/domain/lead-intake.port'
import { LEAD_REPOSITORY } from '../src/modules/leads/domain/lead-repository.port'
import { MEDIA_REPOSITORY } from '../src/modules/media/domain/media-repository.port'
import { MEDIA_URL_REPOSITORY } from '../src/modules/media/domain/media-url-repository.port'
import { MINIO_CLIENT } from '../src/modules/media/infrastructure/minio-client'
import { createTestApp } from './create-test-app'
import { FakeLeadRepository } from './fake-lead-repository'
import { FakeMediaRepository, FakeMediaUrlRepository } from './fake-media-repository'
import { FakeOperatorDirectory } from './fake-operator-directory'
import { FakeSectionRepository } from './fake-section-repository'
import { FakeSiteMetadataRepository } from './fake-site-metadata-repository'
import { FakeSupabaseDatabase } from './fake-supabase'
import { signOperatorToken } from './operator-tokens'

export const OPERATOR_ID = '9f1c2f3e-4a5b-4c6d-8e9f-0a1b2c3d4e5f'

/**
 * A aplicação inteira no ar, sem rede: o token é assinado localmente com o
 * mesmo segredo simétrico da aplicação (`AUTH_JWT_SECRET`, SDD § D-03) e o
 * banco é o dublê em memória. Tudo entre a requisição e esse dublê é código de
 * produção.
 */
export interface ContentHarness {
  readonly app: INestApplication
  readonly database: FakeSupabaseDatabase
  /** Operadores (migrados para MySQL/Prisma — SDD § D-09/D-10): porta própria, sem passar pela tabela genérica. */
  readonly operators: FakeOperatorDirectory
  /** Token de operador válido, para as rotas administrativas. */
  readonly token: string
  close(): Promise<void>
}

export async function startContentHarness(): Promise<ContentHarness> {
  const database = new FakeSupabaseDatabase()
  const operators = new FakeOperatorDirectory()
  const leads = new FakeLeadRepository(database)

  const app = await createTestApp({}, {}, [
    // Mídia (migrada para MySQL/MinIO — SDD § D-05/D-10): três fronteiras
    // próprias. `MINIO_CLIENT` troca de lugar (não `MEDIA_STORAGE`) para que o
    // adaptador real, `MinioMediaStorage`, continue sendo o que a suíte
    // exercita — só o cliente MinIO por trás dele é o dublê (`database.storage`,
    // um `FakeMinioClient`). Os dois repositórios
    // (`MEDIA_REPOSITORY`/`MEDIA_URL_REPOSITORY`) trocam de lugar na porta
    // mesmo: replicar a superfície inteira do `PrismaClient` gerado só para
    // isso não se paga — ver o comentário de `fake-media-repository.ts`.
    { provide: MINIO_CLIENT, useValue: database.storage },
    { provide: MEDIA_REPOSITORY, useValue: new FakeMediaRepository(database) },
    { provide: MEDIA_URL_REPOSITORY, useValue: new FakeMediaUrlRepository(database) },
    // Conteúdo, metadados e leads (migrados para MySQL/Prisma — SDD § D-10):
    // mesma ideia, porta própria em vez de um cliente genérico — cada uma fala
    // com a tabela correspondente de `FakeSupabaseDatabase`
    // (`content_sections`, `site_metadata`, `leads`), sem fingir ser o
    // `PrismaClient` inteiro (ver os comentários de `fake-section-repository.ts`,
    // `fake-site-metadata-repository.ts` e `fake-lead-repository.ts`).
    { provide: SECTION_REPOSITORY, useValue: new FakeSectionRepository(database) },
    { provide: SITE_METADATA_REPOSITORY, useValue: new FakeSiteMetadataRepository(database) },
    { provide: LEAD_INTAKE, useValue: leads },
    { provide: LEAD_REPOSITORY, useValue: leads },
    // Operadores (SDD § D-09/D-10): mesma ideia, porta própria em vez de um
    // cliente genérico — `OperatorDirectory` já não fala `auth.admin.*` em
    // produção (`MySqlOperatorDirectory`), então o teste também não deveria.
    { provide: OPERATOR_DIRECTORY, useValue: operators },
  ])

  const token = await signOperatorToken({
    sub: OPERATOR_ID,
    email: 'operadora@veggiedent.test',
    exp: Math.floor(Date.now() / 1000) + 3600,
  })

  return {
    app,
    database,
    operators,
    token,
    close: async () => {
      await app.close()
    },
  }
}
