import { z } from 'zod'

export const DEFAULT_PORT = 3000

/**
 * Variáveis de ambiente do servidor, conforme o README § "Variáveis de ambiente".
 *
 * Todas são obrigatórias: sem qualquer uma delas a API não tem como falar com o
 * Supabase, e é lá que o lead é gravado — o único lugar onde ele existe desde
 * que o repasse a sistema externo foi descontinuado (SDD § C-11).
 *
 * `ADMIN_APP_URL` é a origem do painel (sem caminho, ex.: `http://localhost:5173`
 * em desenvolvimento ou o domínio único de produção) — é para onde o link de
 * convite de operador (SDD § D-09) redireciona depois que o Supabase confirma o
 * token, na rota `/admin/ativar`. Sem ela, o link cairia no `Site URL` padrão do
 * projeto Supabase, que não é o endereço do painel.
 */
export const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(DEFAULT_PORT),
  SUPABASE_URL: z.url(),
  SUPABASE_SECRET_KEY: z.string().min(1),
  SUPABASE_JWKS_URL: z.url(),
  ALLOWED_ORIGINS: z.string().min(1),
  ADMIN_APP_URL: z.url(),
})

export type Environment = z.infer<typeof environmentSchema>

export type EnvironmentVariableName = keyof Environment

export const ENVIRONMENT_VARIABLE_NAMES = Object.keys(
  environmentSchema.shape,
) as EnvironmentVariableName[]
