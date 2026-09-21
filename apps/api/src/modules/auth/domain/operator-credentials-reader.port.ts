/** Token de injeção da porta. O domínio declara; a infraestrutura implementa. */
export const OPERATOR_CREDENTIALS_READER = Symbol('OperatorCredentialsReader')

/** O mínimo de `operators` que o login precisa: identidade, login e hash. */
export interface OperatorCredentials {
  readonly id: string
  readonly email: string
  readonly passwordHash: string
}

/**
 * Porta de leitura de credenciais (SDD § "Visão de layers dentro da API").
 *
 * Estreita de propósito: só existe para o caso de uso de login localizar um
 * operador pelo e-mail e comparar a senha. Não é a porta de gestão completa de
 * operadores (listar/criar/remover) — essa é `OperatorDirectory`, do módulo
 * `operators`, tarefa futura e sequencial (`migracao-mysql/gestao-operadores`).
 * As duas portas convivem sobre a mesma tabela `operators`, cada uma com a
 * fração de acesso que seu módulo de fato precisa (ISP).
 */
export interface OperatorCredentialsReader {
  findByEmail(email: string): Promise<OperatorCredentials | null>
}
