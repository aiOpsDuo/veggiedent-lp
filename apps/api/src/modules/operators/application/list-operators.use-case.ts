import { Inject, Injectable } from '@nestjs/common'
import { OPERATOR_DIRECTORY, type OperatorDirectory } from '../domain/operator-directory.port'
import { toOperatorView, type OperatorView } from './operator-view'

/**
 * Lista os operadores do painel (SDD § C-13), mais recente primeiro — a mesma
 * ordem que as outras listagens administrativas já usam (leads, mídia).
 */
@Injectable()
export class ListOperatorsUseCase {
  constructor(@Inject(OPERATOR_DIRECTORY) private readonly directory: OperatorDirectory) {}

  async execute(): Promise<OperatorView[]> {
    const operators = await this.directory.listAll()
    return [...operators]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(toOperatorView)
  }
}
