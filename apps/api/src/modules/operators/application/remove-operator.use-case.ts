import { Inject, Injectable } from '@nestjs/common'
import { OperatorRemovalRefusedError } from '../../../shared/domain/operator-removal-refused.error'
import { ResourceNotFoundError } from '../../../shared/domain/resource-not-found.error'
import { OPERATOR_DIRECTORY, type OperatorDirectory } from '../domain/operator-directory.port'

/**
 * Remove um operador (SDD § D-09, § C-13, § R-10).
 *
 * Duas recusas travariam o acesso ao painel se não existissem, e por isso são
 * checadas **antes** de qualquer chamada à Admin API — a única forma de
 * exclusão de operador que a API expõe é esta, sem caminho alternativo (ex.:
 * direto no banco) que contorne as duas checagens:
 *
 * - remover a si mesmo — quem está de fato logado ficaria sem a própria
 *   sessão para desfazer o próprio erro;
 * - remover o último operador restante — ninguém mais teria acesso ao painel
 *   para corrigir isso depois.
 *
 * A checagem de "a si mesmo" compara com o operador do token, não com a lista
 * da Admin API — é mais barata e nunca depende de uma segunda chamada de rede
 * para recusar o caso mais comum. A checagem de "último operador" precisa da
 * lista porque é sobre quantos restam, não sobre quem está pedindo.
 */
@Injectable()
export class RemoveOperatorUseCase {
  constructor(@Inject(OPERATOR_DIRECTORY) private readonly directory: OperatorDirectory) {}

  async execute(targetId: string, currentOperatorId: string): Promise<void> {
    if (targetId === currentOperatorId) {
      throw new OperatorRemovalRefusedError('self')
    }

    const operators = await this.directory.listAll()
    if (!operators.some((operator) => operator.id === targetId)) {
      throw new ResourceNotFoundError(`operador ${targetId}`)
    }
    if (operators.length === 1) {
      throw new OperatorRemovalRefusedError('last-operator')
    }

    await this.directory.remove(targetId)
  }
}
