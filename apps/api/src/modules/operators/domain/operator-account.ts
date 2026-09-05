/**
 * Um operador do painel, como o Supabase Auth o registra (SDD § D-09). A API
 * não guarda operador nenhum em tabela própria — a Admin API do Supabase é a
 * única fonte, e este tipo é a tradução do que ela devolve para o vocabulário
 * do domínio.
 *
 * `name` vem de `user_metadata.name` (revisto na T34) — a única extensão de
 * dado que a Admin API do Supabase Auth permite sem outra fonte de verdade.
 * É `null` para um operador criado antes deste campo existir (ex.: o operador
 * original) — `operator-view.ts` decide o que mostrar nesse caso, não este tipo.
 */
export interface OperatorAccount {
  readonly id: string
  readonly email: string
  readonly name: string | null
  readonly createdAt: string
  readonly lastSignInAt: string | null
}
