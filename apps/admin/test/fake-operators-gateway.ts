import { randomUUID } from 'node:crypto'
import type {
  OperatorInvite,
  OperatorInviteResult,
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
  /** Quando presente, todo convite falha com esta mensagem (`falha`, não `invalido`). */
  readonly failInviteWith?: string
}

export class FakeOperatorsGateway implements OperatorsGateway {
  readonly convites: string[] = []
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

  async inviteOperator(_accessToken: string, email: string): Promise<OperatorInviteResult> {
    this.convites.push(email)
    if (this.options.failInviteWith !== undefined) {
      return { status: 'falha', message: this.options.failInviteWith }
    }
    if (!email.includes('@')) {
      return { status: 'invalido', message: 'Informe um e-mail válido.' }
    }
    const invite: OperatorInvite = {
      email,
      activationLink: `https://fake-supabase.test/auth/v1/verify?type=invite&token=${randomUUID()}`,
    }
    this.operators.push({
      id: randomUUID(),
      email,
      createdAt: new Date().toISOString(),
      lastSignInAt: null,
    })
    return { status: 'convidado', value: invite }
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
    createdAt: '2026-09-01T12:00:00.000Z',
    lastSignInAt: null,
    ...overrides,
  }
}
