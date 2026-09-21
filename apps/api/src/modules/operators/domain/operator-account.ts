/**
 * Um operador do painel, como a tabela `operators` do MySQL o registra (SDD
 * § D-09, § "Modelo de dados" — revistas em 2026-09-21). Substitui a tradução
 * do que a Admin API do Supabase Auth devolvia: a tabela agora é da própria
 * aplicação, então não há mais metadado externo a traduzir.
 *
 * `name` nunca é vazio aqui: a coluna `operators.name` é `NOT NULL` e
 * `CreateOperatorDto.name` já exige uma string não vazia na criação — ao
 * contrário do Supabase Auth (onde o nome vivia em `user_metadata`, opcional,
 * e podia faltar num operador criado antes desse campo existir), não há
 * caminho de escrita que grave um operador sem nome. `operator-view.ts` não
 * precisa mais de um valor de reserva para este campo.
 *
 * **Sem `lastSignInAt`** (removido nesta migração): o Supabase Auth media o
 * último login de graça; a tabela `operators` própria não tem coluna
 * equivalente, e nem o SDD nem o PRD pedem rastrear isso — não é perda de
 * requisito, é a ausência de um dado que só existia como efeito colateral do
 * provedor anterior.
 */
export interface OperatorAccount {
  readonly id: string
  readonly email: string
  readonly name: string
  readonly createdAt: string
}
