import type { OperatorAccount } from '../domain/operator-account'
import type { CreateOperatorInput, OperatorDirectory } from '../domain/operator-directory.port'
import { CreateOperatorUseCase } from './create-operator.use-case'

/**
 * A parte do fluxo direto (SDD § D-09, revista na T34) que não depende do
 * Supabase real: o caso de uso repassa exatamente o que recebeu ao diretório
 * e devolve a `OperatorView` da conta criada — nunca a senha.
 */

class FakeOperatorDirectory implements OperatorDirectory {
  recebido: CreateOperatorInput | null = null

  async listAll(): Promise<OperatorAccount[]> {
    return []
  }

  async create(input: CreateOperatorInput): Promise<OperatorAccount> {
    this.recebido = input
    return {
      id: 'novo-operador',
      email: input.email,
      name: input.name,
      createdAt: '2026-09-04T00:00:00.000Z',
      lastSignInAt: null,
    }
  }

  async remove(): Promise<void> {
    throw new Error('não usado neste teste')
  }
}

describe('CreateOperatorUseCase', () => {
  it('repassa e-mail, senha e nome ao diretório', async () => {
    const directory = new FakeOperatorDirectory()
    const useCase = new CreateOperatorUseCase(directory)

    await useCase.execute({
      email: 'nova.operadora@veggiedent.test',
      password: 'senha-inicial',
      name: 'Nova Operadora',
    })

    expect(directory.recebido).toEqual({
      email: 'nova.operadora@veggiedent.test',
      password: 'senha-inicial',
      name: 'Nova Operadora',
    })
  })

  it('devolve a view da conta criada, sem a senha', async () => {
    const directory = new FakeOperatorDirectory()
    const useCase = new CreateOperatorUseCase(directory)

    const view = await useCase.execute({
      email: 'nova.operadora@veggiedent.test',
      password: 'senha-inicial',
      name: 'Nova Operadora',
    })

    expect(view).toEqual({
      id: 'novo-operador',
      email: 'nova.operadora@veggiedent.test',
      name: 'Nova Operadora',
      createdAt: '2026-09-04T00:00:00.000Z',
      lastSignInAt: null,
    })
    expect(JSON.stringify(view)).not.toMatch(/senha-inicial/)
  })
})
