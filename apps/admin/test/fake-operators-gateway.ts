import { randomUUID } from 'node:crypto'
import type {
  OperatorCreateInput,
  OperatorCreateResult,
  OperatorRemoveResult,
  OperatorsGateway,
  OperatorsListResult,
  OperatorView,
} from '../src/operators/operators-gateway'

/**
 * Dublê da API de operadores: guarda os operadores em memória e responde como
 * a API responde, inclusive as duas recusas de R-10 — a mesma disciplina do
 * dublê de leads, para que o que está sob teste seja a tela, não a rede.
 */

export interface FakeOperatorsGatewayOptions {
  readonly operators?: readonly OperatorView[]
  readonly failListWith?: string
  /** Quando presente, toda criação falha com esta mensagem (`falha`, não `invalido`). */
  readonly failCreateWith?: string
}

export class FakeOperatorsGateway implements OperatorsGateway {
  readonly criacoes: OperatorCreateInput[] = []
  readonly remocoes: string[] = []

  private operators: OperatorView[]

  constructor(private readonly options: FakeOperatorsGatewayOptions = {}) {
    this.operators = [...(options.operators ?? [])]
  }

  async listOperators(_accessToken: string): Promise<OperatorsListResult> {
    if (this.options.failListWith !== undefined) {
      return { status: 'falha', message: this.options.failListWith }
    }
    return {
      status: 'ok',
      value: [...this.operators].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    }
  }

  async createOperator(
    _accessToken: string,
    input: OperatorCreateInput,
  ): Promise<OperatorCreateResult> {
    this.criacoes.push(input)
    if (this.options.failCreateWith !== undefined) {
      return { status: 'falha', message: this.options.failCreateWith }
    }
    if (!input.email.includes('@')) {
      return { status: 'invalido', message: 'Informe um e-mail válido.' }
    }
    const created: OperatorView = {
      id: randomUUID(),
      email: input.email,
      name: input.name,
      createdAt: new Date().toISOString(),
      lastSignInAt: null,
    }
    this.operators.push(created)
    return { status: 'criado', value: created }
  }

  async removeOperator(_accessToken: string, id: string): Promise<OperatorRemoveResult> {
    this.remocoes.push(id)
    const alvo = this.operators.find((operator) => operator.id === id)
    if (alvo === undefined) {
      return { status: 'falha', message: 'Operador não encontrado.' }
    }
    if (this.operators.length === 1) {
      return { status: 'recusado', message: 'Não é possível remover o último operador restante.' }
    }
    this.operators = this.operators.filter((operator) => operator.id !== id)
    return { status: 'removido' }
  }
}

/** Um operador com os campos preenchidos, para o teste variar só o que importa. */
export function operadorDeTeste(
  overrides: Partial<OperatorView> & Pick<OperatorView, 'id'>,
): OperatorView {
  return {
    email: 'operadora@veggiedent.test',
    name: 'Operadora de Teste',
    createdAt: '2026-09-01T12:00:00.000Z',
    lastSignInAt: null,
    ...overrides,
  }
}
