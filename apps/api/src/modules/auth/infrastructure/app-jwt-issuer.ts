import { SignJWT } from 'jose'
import type { Environment } from '../../../config/environment.schema'
import type { IssuedToken, OperatorClaims, TokenIssuer } from '../domain/token-issuer.port'
import { jwtSecretKey } from './app-jwt-verifier'

const SIGNING_ALGORITHM = 'HS256'

/**
 * Duração da sessão. Sem endpoint de refresh nesta versão (SDD § D-03,
 * "sessão sem estado no servidor, herdada do desenho original"): expirado o
 * token, o operador loga de novo. 12 horas cobre um turno de trabalho inteiro
 * sem exigir login no meio do expediente — decisão desta tarefa, não do SDD,
 * que não fixa um número.
 */
const DEFAULT_EXPIRES_IN_SECONDS = 60 * 60 * 12

function nowInSeconds(): number {
  return Math.floor(Date.now() / 1000)
}

/**
 * Assina o JWT próprio da aplicação com o segredo simétrico `AUTH_JWT_SECRET`
 * (SDD § D-03). Espelha `AppJwtVerifier`: mesmo segredo, mesmo único algoritmo
 * (`HS256`), lados opostos da mesma operação.
 */
export class AppJwtIssuer implements TokenIssuer {
  constructor(
    private readonly secret: Uint8Array,
    private readonly expiresInSeconds: number = DEFAULT_EXPIRES_IN_SECONDS,
  ) {}

  async issue(operator: OperatorClaims): Promise<IssuedToken> {
    const issuedAt = nowInSeconds()
    const accessToken = await new SignJWT({ email: operator.email })
      .setProtectedHeader({ alg: SIGNING_ALGORITHM })
      .setSubject(operator.id)
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + this.expiresInSeconds)
      .sign(this.secret)

    return { accessToken, expiresInSeconds: this.expiresInSeconds }
  }
}

/** Monta o emissor de produção, com o segredo simétrico do ambiente. */
export function createAppJwtIssuer(environment: Environment): TokenIssuer {
  return new AppJwtIssuer(jwtSecretKey(environment.AUTH_JWT_SECRET))
}
