import { jwtVerify } from 'jose'
import type { JWTPayload } from 'jose'
import type { Environment } from '../../../config/environment.schema'
import type { AuthenticatedOperator } from '../domain/authenticated-operator'
import {
  InvalidTokenError,
  TOKEN_REJECTION_REASONS,
  type TokenRejectionReason,
} from '../domain/invalid-token.error'
import type { TokenVerifier } from '../domain/token-verifier.port'

/**
 * Único algoritmo aceito: HS256, o mesmo (e só) que `AppJwtIssuer` usa para
 * assinar. Diferente do antigo `JwksTokenVerifier` — que recusava `HS256` de
 * propósito para não abrir confusão de algoritmo entre um segredo simétrico e
 * a chave pública de um JWKS —, aqui não existe mais JWKS nem chave pública
 * nenhuma: o único segredo em jogo é `AUTH_JWT_SECRET`, simétrico desde a
 * origem, então a confusão de algoritmo que justificava a lista restrita não
 * se aplica mais (SDD § D-03, revista em 2026-09-21).
 */
const ACCEPTED_ALGORITHMS = ['HS256']

const REASON_BY_JOSE_CODE: Readonly<Record<string, TokenRejectionReason>> = {
  ERR_JWT_EXPIRED: TOKEN_REJECTION_REASONS.expirado,
  ERR_JWS_SIGNATURE_VERIFICATION_FAILED: TOKEN_REJECTION_REASONS.assinaturaInvalida,
  ERR_JOSE_ALG_NOT_ALLOWED: TOKEN_REJECTION_REASONS.algoritmoNaoAceito,
  ERR_JWT_CLAIM_VALIDATION_FAILED: TOKEN_REJECTION_REASONS.claimInvalido,
  ERR_JWS_INVALID: TOKEN_REJECTION_REASONS.malformado,
  ERR_JWT_INVALID: TOKEN_REJECTION_REASONS.malformado,
  ERR_JOSE_NOT_SUPPORTED: TOKEN_REJECTION_REASONS.malformado,
}

function codeOf(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : undefined
}

/**
 * Traduz a falha da biblioteca para o vocabulário do domínio. Nada da mensagem
 * original atravessa — o motivo é sempre uma das frases fixas do domínio.
 */
function toInvalidTokenError(error: unknown): InvalidTokenError {
  const reason =
    REASON_BY_JOSE_CODE[codeOf(error) ?? ''] ?? TOKEN_REJECTION_REASONS.desconhecido
  return new InvalidTokenError(reason)
}

function readOptionalEmail(payload: JWTPayload): string | undefined {
  return typeof payload.email === 'string' && payload.email.length > 0
    ? payload.email
    : undefined
}

function toOperator(payload: JWTPayload): AuthenticatedOperator {
  if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
    throw new InvalidTokenError(TOKEN_REJECTION_REASONS.claimInvalido)
  }
  return { id: payload.sub, email: readOptionalEmail(payload) }
}

/**
 * Verifica o JWT próprio da aplicação com o segredo simétrico `AUTH_JWT_SECRET`
 * (SDD § D-03). Substitui `JwksTokenVerifier`: não há mais chave pública nem
 * JWKS a consultar — o mesmo segredo que `AppJwtIssuer` usa para assinar é o
 * que esta classe usa para verificar.
 *
 * Recebe a chave já derivada (`Uint8Array`), não a string do segredo, pela
 * mesma inversão de dependência que o verificador antigo já aplicava com o
 * resolvedor de chaves: o teste pode construir um segredo próprio sem tocar
 * em variável de ambiente nenhuma.
 */
export class AppJwtVerifier implements TokenVerifier {
  constructor(private readonly secret: Uint8Array) {}

  async verify(token: string): Promise<AuthenticatedOperator> {
    try {
      const { payload } = await jwtVerify(token, this.secret, {
        algorithms: ACCEPTED_ALGORITHMS,
        requiredClaims: ['sub', 'exp'],
      })
      return toOperator(payload)
    } catch (error) {
      if (error instanceof InvalidTokenError) {
        throw error
      }
      throw toInvalidTokenError(error)
    }
  }
}

/** Deriva a chave HS256 a partir da string do segredo, como o `jose` espera. */
export function jwtSecretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret)
}

/** Monta o verificador de produção, com o segredo simétrico do ambiente. */
export function createAppJwtVerifier(environment: Environment): TokenVerifier {
  return new AppJwtVerifier(jwtSecretKey(environment.AUTH_JWT_SECRET))
}
