import { Inject, Injectable, Logger } from '@nestjs/common'
import { ResourceNotFoundError } from '../../../shared/domain/resource-not-found.error'
import { ensureLeadId } from '../domain/lead-id'
import {
  LEAD_REPOSITORY,
  type LeadRepository,
} from '../domain/lead-repository.port'

/**
 * Exclusão definitiva de um lead, para pedido do titular
 * (SDD § "Endpoints administrativos"; exigência de LGPD do PRD).
 *
 * É apagar mesmo, não marcar como apagado: o titular que pede a exclusão dos
 * seus dados não fica satisfeito com uma coluna `deleted_at`. Por isso a
 * exclusão fica registrada no log do servidor com o identificador — o dado do
 * titular some, o registro de que a operação aconteceu fica.
 *
 * O lead é lido antes de ser apagado para que um identificador inexistente
 * responda `404` em vez de um `204` que mentiria dizendo que algo foi apagado.
 */
@Injectable()
export class DeleteLeadUseCase {
  private readonly logger = new Logger(DeleteLeadUseCase.name)

  constructor(
    @Inject(LEAD_REPOSITORY) private readonly repository: LeadRepository,
  ) {}

  async execute(rawId: string, operatorId: string): Promise<void> {
    const id = ensureLeadId(rawId)
    if ((await this.repository.findById(id)) === null) {
      throw new ResourceNotFoundError(`lead ${id}`)
    }

    await this.repository.delete(id)
    this.logger.log(`Lead ${id} excluído definitivamente pelo operador ${operatorId}.`)
  }
}
