import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from 'jose'
import type { JWK, JWTPayload, KeyLike } from 'jose'
import { InvalidTokenError, TOKEN_REJECTION_REASONS } from '../domain/invalid-token.error'
import { JwksTokenVerifier, issuerFor } from './jwks-token-verifier'

const ISSUER = 'https://projeto-de-teste.supabase.co/auth/v1'
const OPERATOR_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

const inSeconds = (offset: number): number => Math.floor(Date.now() / 1000) + offset

let privateKey: KeyLike
let publicJwk: JWK
let verifier: JwksTokenVerifier

const claims = (overrides: JWTPayload = {}): JWTPayload => ({
  sub: OPERATOR_ID,
  aud: 'authenticated',
  iss: ISSUER,
  exp: inSeconds(3600),
  ...overrides,
})

const sign = (payload: JWTPayload, alg = 'ES256'): Promise<string> =>
  new SignJWT(payload).setProtectedHeader({ alg }).sign(privateKey)

/** Chaves geradas na hora e um JWKS em memória: nenhuma rede, nenhum segredo. */
beforeAll(async () => {
  const pair = await generateKeyPair('ES256', { extractable: true })
  privateKey = pair.privateKey
  publicJwk = { ...(await exportJWK(pair.publicKey)), alg: 'ES256' }
  verifier = new JwksTokenVerifier(createLocalJWKSet({ keys: [publicJwk] }), ISSUER)
})

describe('issuerFor', () => {
  it('deriva o emissor do projeto a partir da URL do Supabase', () => {
    expect(issuerFor('https://projeto-de-teste.supabase.co')).toBe(ISSUER)
  })
})

describe('JwksTokenVerifier', () => {
  it('devolve o operador do token válido', async () => {
    const token = await sign(claims({ email: 'operadora@veggiedent.test' }))

    await expect(verifier.verify(token)).resolves.toEqual({
      id: OPERATOR_ID,
      email: 'operadora@veggiedent.test',
    })
  })

  it('aceita token válido sem e-mail', async () => {
    await expect(verifier.verify(await sign(claims()))).resolves.toEqual({
      id: OPERATOR_ID,
      email: undefined,
    })
  })

  it.each([
    ['expirado', () => claims({ exp: inSeconds(-1) }), TOKEN_REJECTION_REASONS.expirado],
    ['de outro emissor', () => claims({ iss: 'https://outro.supabase.co/auth/v1' }), TOKEN_REJECTION_REASONS.claimInvalido],
    ['de outro público', () => claims({ aud: 'anon' }), TOKEN_REJECTION_REASONS.claimInvalido],
    ['sem exp', () => claims({ exp: undefined }), TOKEN_REJECTION_REASONS.claimInvalido],
    ['sem sub', () => claims({ sub: undefined }), TOKEN_REJECTION_REASONS.claimInvalido],
  ])('recusa token %s', async (_caso, build, reason) => {
    await expect(verifier.verify(await sign(build()))).rejects.toMatchObject({
      constructor: InvalidTokenError,
      reason,
    })
  })

  it('recusa token malformado', async () => {
    await expect(verifier.verify('nao-e-um-jwt')).rejects.toBeInstanceOf(
      InvalidTokenError,
    )
  })

  /**
   * Confusão de algoritmo: um atacante que pega a chave pública do JWKS — ela é
   * pública por definição — e a usa como segredo de um HS256. O verificador só
   * aceita algoritmos assimétricos, então isso não passa.
   */
  it('recusa token assinado com algoritmo simétrico', async () => {
    const symmetricSecret = new TextEncoder().encode(JSON.stringify(publicJwk))
    const token = await new SignJWT(claims())
      .setProtectedHeader({ alg: 'HS256' })
      .sign(symmetricSecret)

    await expect(verifier.verify(token)).rejects.toBeInstanceOf(InvalidTokenError)
  })

  it('recusa token assinado por chave fora do JWKS', async () => {
    const outro = await generateKeyPair('ES256', { extractable: true })
    const token = await new SignJWT(claims())
      .setProtectedHeader({ alg: 'ES256' })
      .sign(outro.privateKey)

    await expect(verifier.verify(token)).rejects.toBeInstanceOf(InvalidTokenError)
  })

  it('nunca deixa escapar um erro que não seja do domínio', async () => {
    const explosivo = jest.fn().mockRejectedValue(new Error('detalhe interno do jose'))

    const falho = new JwksTokenVerifier(explosivo, ISSUER)

    await expect(falho.verify(await sign(claims()))).rejects.toBeInstanceOf(
      InvalidTokenError,
    )
  })
})
