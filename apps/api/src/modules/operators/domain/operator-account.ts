/**
 * Um operador do painel, como o Supabase Auth o registra (SDD § D-09). A API
 * não guarda operador nenhum em tabela própria — a Admin API do Supabase é a
 * única fonte, e este tipo é a tradução do que ela devolve para o vocabulário
 * do domínio.
 */
export interface OperatorAccount {
  readonly id: string
  readonly email: string
  readonly createdAt: string
  readonly lastSignInAt: string | null
}
