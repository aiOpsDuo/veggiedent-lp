import { z } from 'zod'

export const DEFAULT_PORT = 3000

/**
 * Variáveis de ambiente do servidor, conforme o README § "Variáveis de ambiente".
 *
 * As duas do RD Station ficam opcionais até a T8, quando o repasse do lead migra
 * da função serverless para a API (SDD § D-07): exigi-las agora impediria a API
 * de subir por causa de uma credencial que nenhum código ainda lê.
 */
export const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(DEFAULT_PORT),
  SUPABASE_URL: z.url(),
  SUPABASE_SECRET_KEY: z.string().min(1),
  SUPABASE_JWKS_URL: z.url(),
  ALLOWED_ORIGINS: z.string().min(1),
  RDSTATION_API_TOKEN: z.string().optional(),
  RDSTATION_CONVERSION_IDENTIFIER: z.string().optional(),
})

export type Environment = z.infer<typeof environmentSchema>

export type EnvironmentVariableName = keyof Environment

export const ENVIRONMENT_VARIABLE_NAMES = Object.keys(
  environmentSchema.shape,
) as EnvironmentVariableName[]
