import type { INestApplication } from '@nestjs/common'
import { SUPABASE_CLIENT } from '../src/shared/infrastructure/supabase-client'
import { issuerFor } from '../src/modules/auth/infrastructure/jwks-token-verifier'
import { createTestApp } from './create-test-app'
import { FakeSupabaseDatabase } from './fake-supabase'
import { createSigningKey, signToken, startJwksServer, type JwksServer } from './signing-keys'

export const OPERATOR_ID = '9f1c2f3e-4a5b-4c6d-8e9f-0a1b2c3d4e5f'

/**
 * A aplicação inteira no ar, sem rede: o JWKS é local (T5) e o banco é o dublê
 * em memória. Tudo entre a requisição e o cliente Supabase é código de produção.
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
  const key = await createSigningKey('chave-de-teste')
  const jwks: JwksServer = await startJwksServer([key])

  const app = await createTestApp(
    {},
    { SUPABASE_JWKS_URL: jwks.url },
    [{ provide: SUPABASE_CLIENT, useValue: database.asSupabaseClient() }],
  )

  const token = await signToken(key, {
    sub: OPERATOR_ID,
    email: 'operadora@veggiedent.test',
    aud: 'authenticated',
    iss: issuerFor(process.env.SUPABASE_URL as string),
    exp: Math.floor(Date.now() / 1000) + 3600,
  })

  return {
    app,
    database,
    token,
    close: async () => {
      await app.close()
      await jwks.close()
    },
  }
}
