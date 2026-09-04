/**
 * Remoção de operador recusada por travar o próprio acesso ao painel (SDD §
 * D-09, § R-10). As duas únicas razões são as duas formas de ninguém mais
 * conseguir entrar no painel depois da remoção:
 *
 * - `self` — quem está removendo é o próprio alvo da remoção;
 * - `last-operator` — o alvo é o único operador restante.
 *
 * Vive em `shared/domain`, ao lado de `ResourceInUseError` e
 * `ResourceNotFoundError`, e não em `modules/operators/domain`: a tradução
 * para `409` acontece uma única vez, em `presentation/error-response.factory.ts`
 * (também em `shared/`), que lê `reason` — nunca a mensagem desta exceção, que
 * é só para o log do servidor. Ficar em `modules/operators/` faria esse único
 * ponto de tradução importar de dentro de um módulo, invertendo a direção de
 * dependência que a arquitetura em camadas exige (SDD § "Visão de layers").
 */
export type OperatorRemovalReason = 'self' | 'last-operator'

export class OperatorRemovalRefusedError extends Error {
  readonly reason: OperatorRemovalReason

  constructor(reason: OperatorRemovalReason) {
    super(`Remoção de operador recusada: ${reason}.`)
    this.name = 'OperatorRemovalRefusedError'
    this.reason = reason
  }
}
