/**
 * Leitura tipada das variáveis do painel.
 *
 * Nenhum componente lê `import.meta.env` direto — a mesma convenção da LP
 * (`apps/lp/src/config/env.ts`).
 *
 * **Revisto em 2026-09-21 (SDD § D-03):** `supabaseUrl`/`supabasePublishableKey`
 * saíram, sem substituto — o painel autentica contra `POST /api/auth/login`,
 * na própria API (`apiBaseUrl`), não mais contra um provedor externo. Não há
 * mais nenhuma variável que faça esta leitura falhar: `apiBaseUrl` sempre tem
 * um valor, por padrão ou declarado.
 */
export interface AdminEnvironment {
  readonly apiBaseUrl: string
}

/** Fonte das variáveis: `import.meta.env` em produção, um objeto no teste. */
export type EnvironmentSource = Readonly<Record<string, string | undefined>>

const DEFAULT_API_BASE_URL = '/api'

export function readEnvironment(source: EnvironmentSource): AdminEnvironment {
  return {
    apiBaseUrl: source.VITE_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL,
  }
}
