import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { SignJWT, exportJWK, generateKeyPair } from 'jose'
import type { JWK, JWTPayload, KeyLike } from 'jose'

/**
 * Chaves de teste e um JWKS servido em `127.0.0.1`.
 *
 * A suíte não fala com o Supabase: gera o próprio par ES256 — o mesmo algoritmo
 * que o projeto real usa — assina os tokens localmente e aponta a verificação a
 * este JWKS. Assim os casos de expirado, chave errada e malformado são
 * determinísticos e rápidos, e o caminho exercitado continua sendo o de
 * produção: `createRemoteJWKSet` buscando um JWKS por HTTP.
 */
const SIGNING_ALGORITHM = 'ES256'

export interface TestSigningKey {
  keyId: string
  privateKey: KeyLike
  publicJwk: JWK
}

export async function createSigningKey(keyId: string): Promise<TestSigningKey> {
  const { privateKey, publicKey } = await generateKeyPair(SIGNING_ALGORITHM, {
    extractable: true,
  })
  return {
    keyId,
    privateKey,
    publicJwk: { ...(await exportJWK(publicKey)), kid: keyId, alg: SIGNING_ALGORITHM },
  }
}

export interface TokenClaims extends JWTPayload {
  sub: string
}

/** Assina um token com a chave dada, sem nenhum valor implícito nos claims. */
export async function signToken(
  key: TestSigningKey,
  claims: TokenClaims,
): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: SIGNING_ALGORITHM, kid: key.keyId })
    .sign(key.privateKey)
}

export interface JwksServer {
  url: string
  close(): Promise<void>
}

/** Sobe um JWKS em porta efêmera de loopback. Nenhuma rede externa envolvida. */
export async function startJwksServer(keys: TestSigningKey[]): Promise<JwksServer> {
  const body = JSON.stringify({ keys: keys.map((key) => key.publicJwk) })
  const server: Server = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(body)
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo

  return {
    url: `http://127.0.0.1:${port}/auth/v1/.well-known/jwks.json`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  }
}
