import { createRemoteJWKSet, jwtVerify } from 'jose'
import type { JWTPayload, JWTVerifyGetKey } from 'jose'
import type { Environment } from '../../../config/environment.schema'
import type { AuthenticatedOperator } from '../domain/authenticated-operator'
import {
  InvalidTokenError,
  TOKEN_REJECTION_REASONS,
  type TokenRejectionReason,
} from '../domain/invalid-token.error'
import type { TokenVerifier } from '../domain/token-verifier.port'

/**
 * Só algoritmos assimétricos. A ausência de `HS256` aqui é deliberada: aceitar
 * um algoritmo simétrico junto de um JWKS abre a confusão de algoritmo, em que
 * a chave pública publicada passa a servir de segredo de assinatura.
 */
const ACCEPTED_ALGORITHMS = ['ES256', 'RS256', 'EdDSA']

/** Público dos tokens de operador emitidos pelo Supabase Auth. */
const OPERATOR_AUDIENCE = 'authenticated'

/** Caminho do emissor dentro do projeto Supabase. */
const ISSUER_PATH = '/auth/v1'

const REASON_BY_JOSE_CODE: Readonly<Record<string, TokenRejectionReason>> = {
  ERR_JWT_EXPIRED: TOKEN_REJECTION_REASONS.expirado,
  ERR_JWS_SIGNATURE_VERIFICATION_FAILED: TOKEN_REJECTION_REASONS.assinaturaInvalida,
  ERR_JWKS_NO_MATCHING_KEY: TOKEN_REJECTION_REASONS.chaveDesconhecida,
  ERR_JWKS_MULTIPLE_MATCHING_KEYS: TOKEN_REJECTION_REASONS.chaveDesconhecida,
  ERR_JOSE_ALG_NOT_ALLOWED: TOKEN_REJECTION_REASONS.algoritmoNaoAceito,
  ERR_JWT_CLAIM_VALIDATION_FAILED: TOKEN_REJECTION_REASONS.claimInvalido,
  ERR_JWS_INVALID: TOKEN_REJECTION_REASONS.malformado,
  ERR_JWT_INVALID: TOKEN_REJECTION_REASONS.malformado,
  ERR_JOSE_NOT_SUPPORTED: TOKEN_REJECTION_REASONS.malformado,
  ERR_JWKS_TIMEOUT: TOKEN_REJECTION_REASONS.jwksIndisponivel,
  ERR_JWKS_INVALID: TOKEN_REJECTION_REASONS.jwksIndisponivel,
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
 * Verifica o token do Supabase Auth contra as chaves públicas do projeto.
 *
 * A API não guarda nenhum segredo de assinatura (SDD § D-03): recebe as chaves
 * públicas pelo JWKS. Recebe o resolvedor de chaves pronto, em vez de montá-lo,
 * para que o teste possa apontá-lo a um JWKS local — a mesma inversão de
 * dependência que a porta já aplica no nível de camada.
 */
export class JwksTokenVerifier implements TokenVerifier {
  constructor(
    private readonly keys: JWTVerifyGetKey,
    private readonly issuer: string,
  ) {}

  async verify(token: string): Promise<AuthenticatedOperator> {
    try {
      const { payload } = await jwtVerify(token, this.keys, {
        algorithms: ACCEPTED_ALGORITHMS,
        issuer: this.issuer,
        audience: OPERATOR_AUDIENCE,
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

/** Emissor dos tokens do projeto, derivado da URL do Supabase. */
export function issuerFor(supabaseUrl: string): string {
  return new URL(ISSUER_PATH, supabaseUrl).toString()
}

/** Monta o verificador de produção, com o JWKS remoto do projeto Supabase. */
export function createJwksTokenVerifier(environment: Environment): TokenVerifier {
  return new JwksTokenVerifier(
    createRemoteJWKSet(new URL(environment.SUPABASE_JWKS_URL)),
    issuerFor(environment.SUPABASE_URL),
  )
}
