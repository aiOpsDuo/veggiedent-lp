import { SignJWT } from 'jose'
import type { JWTPayload } from 'jose'
import { InvalidTokenError, TOKEN_REJECTION_REASONS } from '../domain/invalid-token.error'
import { AppJwtVerifier, jwtSecretKey } from './app-jwt-verifier'

const OPERATOR_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const SECRET = jwtSecretKey('segredo-de-teste-com-pelo-menos-32-caracteres')
const OUTRO_SECRET = jwtSecretKey('outro-segredo-de-teste-com-32-ou-mais-caracteres')

const inSeconds = (offset: number): number => Math.floor(Date.now() / 1000) + offset

const claims = (overrides: JWTPayload = {}): JWTPayload => ({
  sub: OPERATOR_ID,
  exp: inSeconds(3600),
  ...overrides,
})

const sign = (payload: JWTPayload, secret = SECRET, alg = 'HS256'): Promise<string> =>
  new SignJWT(payload).setProtectedHeader({ alg }).sign(secret)

const verifier = new AppJwtVerifier(SECRET)

describe('AppJwtVerifier', () => {
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
    ['sem exp', () => claims({ exp: undefined }), TOKEN_REJECTION_REASONS.claimInvalido],
    ['sem sub', () => claims({ sub: undefined }), TOKEN_REJECTION_REASONS.claimInvalido],
  ])('recusa token %s', async (_caso, build, reason) => {
    await expect(verifier.verify(await sign(build()))).rejects.toMatchObject({
      constructor: InvalidTokenError,
      reason,
    })
  })

  it('recusa token malformado', async () => {
    await expect(verifier.verify('nao-e-um-jwt')).rejects.toBeInstanceOf(InvalidTokenError)
  })

  it('recusa token assinado com o segredo errado', async () => {
    const token = await sign(claims(), OUTRO_SECRET)

    await expect(verifier.verify(token)).rejects.toMatchObject({
      constructor: InvalidTokenError,
      reason: TOKEN_REJECTION_REASONS.assinaturaInvalida,
    })
  })

  /**
   * Diferente do antigo `JwksTokenVerifier`, `HS256` agora é o único algoritmo
   * em uso — não há mais confusão de algoritmo a evitar (ver comentário em
   * `app-jwt-verifier.ts`). O que este verificador ainda precisa recusar é
   * qualquer *outro* algoritmo, caso um token chegue assinado de outra forma.
   */
  it('recusa token assinado com algoritmo fora do aceito', async () => {
    const token = await sign(claims(), SECRET, 'HS384')

    await expect(verifier.verify(token)).rejects.toMatchObject({
      constructor: InvalidTokenError,
      reason: TOKEN_REJECTION_REASONS.algoritmoNaoAceito,
    })
  })

  it('nunca deixa escapar um erro que não seja do domínio', async () => {
    const falho = new AppJwtVerifier(new Uint8Array())

    await expect(falho.verify(await sign(claims()))).rejects.toBeInstanceOf(InvalidTokenError)
  })
})
