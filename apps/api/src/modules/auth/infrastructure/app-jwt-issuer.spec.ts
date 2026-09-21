import { jwtVerify } from 'jose'
import { AppJwtIssuer } from './app-jwt-issuer'
import { AppJwtVerifier, jwtSecretKey } from './app-jwt-verifier'

const SECRET = jwtSecretKey('segredo-de-teste-com-pelo-menos-32-caracteres')
const OPERATOR = { id: 'operadora-1', email: 'operadora@veggiedent.test' }
const EXPIRES_IN_SECONDS = 3600

describe('AppJwtIssuer', () => {
  it('assina um token que o próprio AppJwtVerifier aceita, com o operador correto', async () => {
    const issuer = new AppJwtIssuer(SECRET, EXPIRES_IN_SECONDS)
    const verifier = new AppJwtVerifier(SECRET)

    const issued = await issuer.issue(OPERATOR)

    expect(issued.expiresInSeconds).toBe(EXPIRES_IN_SECONDS)
    await expect(verifier.verify(issued.accessToken)).resolves.toEqual(OPERATOR)
  })

  it('assina com HS256 e expiração calculada a partir de agora', async () => {
    const issuer = new AppJwtIssuer(SECRET, EXPIRES_IN_SECONDS)
    const before = Math.floor(Date.now() / 1000)

    const { accessToken } = await issuer.issue(OPERATOR)
    const { protectedHeader, payload } = await jwtVerify(accessToken, SECRET)

    expect(protectedHeader.alg).toBe('HS256')
    expect(payload.exp).toBeGreaterThanOrEqual(before + EXPIRES_IN_SECONDS)
    expect(payload.exp).toBeLessThanOrEqual(before + EXPIRES_IN_SECONDS + 5)
  })
})
