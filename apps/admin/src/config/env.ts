/**
 * Leitura tipada das variáveis do painel.
 *
 * Nenhum componente lê `import.meta.env` direto — a mesma convenção da LP
 * (`apps/lp/src/config/env.ts`). Aqui, além de centralizar, a leitura **falha
 * cedo**: sem a URL do Supabase ou sem a chave publicável não existe login
 * possível, e uma tela de login que não autentica é pior do que uma mensagem
 * dizendo qual variável falta.
 */
export interface AdminEnvironment {
  readonly apiBaseUrl: string
  readonly supabaseUrl: string
  readonly supabasePublishableKey: string
}

/** Fonte das variáveis: `import.meta.env` em produção, um objeto no teste. */
export type EnvironmentSource = Readonly<Record<string, string | undefined>>

const DEFAULT_API_BASE_URL = '/api'

export class MissingEnvironmentVariableError extends Error {
  constructor(readonly variableName: string) {
    super(
      `A variável ${variableName} não está definida. Copie apps/admin/.env.example para apps/admin/.env e preencha.`,
    )
    this.name = 'MissingEnvironmentVariableError'
  }
}

function requireVariable(source: EnvironmentSource, name: string): string {
  const value = source[name]?.trim() ?? ''
  if (value.length === 0) {
    throw new MissingEnvironmentVariableError(name)
  }
  return value
}

export function readEnvironment(source: EnvironmentSource): AdminEnvironment {
  return {
    apiBaseUrl: source.VITE_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL,
    supabaseUrl: requireVariable(source, 'VITE_SUPABASE_URL'),
    supabasePublishableKey: requireVariable(source, 'VITE_SUPABASE_PUBLISHABLE_KEY'),
  }
}
