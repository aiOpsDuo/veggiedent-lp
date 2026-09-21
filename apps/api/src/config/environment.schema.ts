import { z } from 'zod'

export const DEFAULT_PORT = 3000

/**
 * Variáveis de ambiente do servidor, conforme o README § "Variáveis de ambiente".
 *
 * Todas são obrigatórias: sem qualquer uma delas a API não tem como falar com a
 * plataforma de dados própria (MySQL + MinIO, auto-hospedados desde 2026-09-21 —
 * SDD § "Camadas e padrão arquitetural", T5) nem verificar a identidade dos
 * operadores. O lead continua sendo gravado só no MySQL — o único lugar onde ele
 * existe desde que o repasse a sistema externo foi descontinuado (SDD § C-11).
 */
export const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(DEFAULT_PORT),
  // Connection string do MySQL no formato que o Prisma espera (SDD § D-10):
  // mysql://usuario:senha@host:porta/banco. Não é necessariamente uma URL http,
  // por isso `z.string()` em vez de `z.url()`.
  DATABASE_URL: z.string().min(1),
  // Endereço do MinIO (compatível com S3), alcançado só pela API — nunca pelo
  // navegador (SDD § D-05).
  MINIO_ENDPOINT: z.url(),
  // Access key e secret key do MinIO. Nomeadas como o próprio contêiner as
  // recebe (`MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD`), não como "chave de API"
  // genérica, para não perder o vínculo com a variável do docker-compose.
  MINIO_ROOT_USER: z.string().min(1),
  MINIO_ROOT_PASSWORD: z.string().min(1),
  MINIO_BUCKET_IMAGES: z.string().min(1),
  MINIO_BUCKET_VIDEOS: z.string().min(1),
  // Segredo simétrico de assinatura do JWT próprio (SDD § D-03). Tamanho
  // mínimo arbitrário, mas razoável para um segredo gerado por
  // `openssl rand -base64 32` (44 caracteres em base64).
  AUTH_JWT_SECRET: z.string().min(32),
  ALLOWED_ORIGINS: z.string().min(1),
})

export type Environment = z.infer<typeof environmentSchema>

export type EnvironmentVariableName = keyof Environment

export const ENVIRONMENT_VARIABLE_NAMES = Object.keys(
  environmentSchema.shape,
) as EnvironmentVariableName[]
