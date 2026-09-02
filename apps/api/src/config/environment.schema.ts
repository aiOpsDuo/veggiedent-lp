import { z } from 'zod'

export const DEFAULT_PORT = 3000

/**
 * Variáveis de ambiente do servidor, conforme o README § "Variáveis de ambiente".
 *
 * As duas do RD Station continuam opcionais depois da T8, e isso é decisão, não
 * pendência: exigi-las na inicialização faria a API recusar subir sem uma
 * credencial que a Virbac ainda não confirmou (SDD § R-08) — e sem API não há
 * como gravar lead nenhum, que é justamente o dado que não pode se perder.
 * Faltando a credencial, o lead é gravado e o repasse fica registrado como
 * `nao_enviado` (SDD § D-07 e § C-11). Quem as exige é o adaptador do RD
 * Station, no instante em que o repasse é de fato tentado.
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
