import type { INestApplication } from '@nestjs/common'
import { MEDIA_REPOSITORY } from '../src/modules/media/domain/media-repository.port'
import { MEDIA_URL_REPOSITORY } from '../src/modules/media/domain/media-url-repository.port'
import { MINIO_CLIENT } from '../src/modules/media/infrastructure/minio-client'
import { SUPABASE_CLIENT } from '../src/shared/infrastructure/supabase-client'
import { createTestApp } from './create-test-app'
import { FakeMediaRepository, FakeMediaUrlRepository } from './fake-media-repository'
import { FakeSupabaseDatabase } from './fake-supabase'
import { signOperatorToken } from './operator-tokens'

export const OPERATOR_ID = '9f1c2f3e-4a5b-4c6d-8e9f-0a1b2c3d4e5f'

/**
 * A aplicação inteira no ar, sem rede: o token é assinado localmente com o
 * mesmo segredo simétrico da aplicação (`AUTH_JWT_SECRET`, SDD § D-03) e o
 * banco é o dublê em memória. Tudo entre a requisição e o cliente Supabase é
 * código de produção.
 */
export interface ContentHarness {
  readonly app: INestApplication
  readonly database: FakeSupabaseDatabase
  /** Token de operador válido, para as rotas administrativas. */
  readonly token: string
  close(): Promise<void>
}

export async function startContentHarness(): Promise<ContentHarness> {
  const database = new FakeSupabaseDatabase()

  const app = await createTestApp({}, {}, [
    { provide: SUPABASE_CLIENT, useValue: database.asSupabaseClient() },
    // Mídia (migrada para MySQL/MinIO — SDD § D-05/D-10): três fronteiras
    // próprias, sem passar pelo dublê Supabase acima. `MINIO_CLIENT` troca de
    // lugar (não `MEDIA_STORAGE`) para que o adaptador real,
    // `MinioMediaStorage`, continue sendo o que a suíte exercita — só o
    // cliente MinIO por trás dele é o dublê (`database.storage`, um
    // `FakeMinioClient`). Os dois repositórios
    // (`MEDIA_REPOSITORY`/`MEDIA_URL_REPOSITORY`) trocam de lugar na porta
    // mesmo: replicar a superfície inteira do `PrismaClient` gerado só para
    // isso não se paga — ver o comentário de `fake-media-repository.ts`.
    { provide: MINIO_CLIENT, useValue: database.storage },
    { provide: MEDIA_REPOSITORY, useValue: new FakeMediaRepository(database) },
    { provide: MEDIA_URL_REPOSITORY, useValue: new FakeMediaUrlRepository(database) },
  ])

  const token = await signOperatorToken({
    sub: OPERATOR_ID,
    email: 'operadora@veggiedent.test',
    exp: Math.floor(Date.now() / 1000) + 3600,
  })

  return {
    app,
    database,
    token,
    close: async () => {
      await app.close()
    },
  }
}
