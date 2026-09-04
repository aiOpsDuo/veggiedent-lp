import { OperatorRemovalRefusedError } from '../../../shared/domain/operator-removal-refused.error'
import { ResourceNotFoundError } from '../../../shared/domain/resource-not-found.error'
import type { OperatorAccount } from '../domain/operator-account'
import type { OperatorDirectory, OperatorInvite } from '../domain/operator-directory.port'
import { RemoveOperatorUseCase } from './remove-operator.use-case'

/**
 * As duas recusas de R-10: remover a si mesmo e remover o último operador
 * restante. As duas travariam o painel se não existissem, e por isso este
 * arquivo é o que a T29 usa como prova por mutação — desligar qualquer um dos
 * dois `if` em `remove-operator.use-case.ts` faz um destes testes falhar.
 */

function operator(id: string): OperatorAccount {
  return { id, email: `${id}@veggiedent.test`, createdAt: '2026-09-01T00:00:00.000Z', lastSignInAt: null }
}

class FakeOperatorDirectory implements OperatorDirectory {
  removed: string[] = []

  constructor(private operators: OperatorAccount[]) {}

  async listAll(): Promise<OperatorAccount[]> {
    return this.operators
  }

  async invite(): Promise<OperatorInvite> {
    throw new Error('não usado neste teste')
  }

  async remove(id: string): Promise<void> {
    this.removed.push(id)
    this.operators = this.operators.filter((candidate) => candidate.id !== id)
  }
}

const EU = 'aaaaaaaa-0000-4000-8000-000000000001'
const OUTRO = 'bbbbbbbb-0000-4000-8000-000000000002'

describe('RemoveOperatorUseCase', () => {
  it('recusa com OperatorRemovalRefusedError("self") remover a si mesmo, mesmo havendo outros operadores', async () => {
    const directory = new FakeOperatorDirectory([operator(EU), operator(OUTRO)])
    const useCase = new RemoveOperatorUseCase(directory)

    await expect(useCase.execute(EU, EU)).rejects.toThrow(OperatorRemovalRefusedError)
    await expect(useCase.execute(EU, EU)).rejects.toMatchObject({ reason: 'self' })
    expect(directory.removed).toHaveLength(0)
  })

  it('recusa com OperatorRemovalRefusedError("last-operator") remover o único operador restante', async () => {
    const directory = new FakeOperatorDirectory([operator(OUTRO)])
    const useCase = new RemoveOperatorUseCase(directory)

    await expect(useCase.execute(OUTRO, EU)).rejects.toThrow(OperatorRemovalRefusedError)
    await expect(useCase.execute(OUTRO, EU)).rejects.toMatchObject({ reason: 'last-operator' })
    expect(directory.removed).toHaveLength(0)
  })

  it('responde 404 (ResourceNotFoundError) ao remover um id que não é operador', async () => {
    const directory = new FakeOperatorDirectory([operator(EU), operator(OUTRO)])
    const useCase = new RemoveOperatorUseCase(directory)

    await expect(useCase.execute('inexistente', EU)).rejects.toThrow(ResourceNotFoundError)
    expect(directory.removed).toHaveLength(0)
  })

  it('remove quando não é a si mesmo e sobra pelo menos um outro operador', async () => {
    const directory = new FakeOperatorDirectory([operator(EU), operator(OUTRO)])
    const useCase = new RemoveOperatorUseCase(directory)

    await useCase.execute(OUTRO, EU)

    expect(directory.removed).toEqual([OUTRO])
  })
})
