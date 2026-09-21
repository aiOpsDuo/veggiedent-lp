import { SignJWT } from 'jose'
import type { JWTPayload } from 'jose'
import { jwtSecretKey } from '../src/modules/auth/infrastructure/app-jwt-verifier'

/**
 * Assina um token de operador de teste com o mesmo segredo simétrico que a
 * aplicação usa (`AUTH_JWT_SECRET`, definido em `test/setup-environment.ts`).
 *
 * Substitui `signing-keys.ts` (par de chaves ES256 + servidor JWKS local),
 * aposentado junto da troca do Supabase Auth pelo JWT próprio (SDD § D-03,
 * revista em 2026-09-21): não há mais chave pública nem JWKS a servir — só um
 * segredo simétrico, e um teste que precisa de um token só precisa assiná-lo
 * com o mesmo segredo (ou, de propósito, com outro, para testar a recusa).
 */
export interface OperatorTokenClaims extends JWTPayload {
  sub: string
}

export function signOperatorToken(
  claims: OperatorTokenClaims,
  secret: string = process.env.AUTH_JWT_SECRET as string,
): Promise<string> {
  return new SignJWT(claims).setProtectedHeader({ alg: 'HS256' }).sign(jwtSecretKey(secret))
}
