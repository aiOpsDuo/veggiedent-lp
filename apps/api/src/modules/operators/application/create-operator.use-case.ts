import { Inject, Injectable } from '@nestjs/common'
import {
  OPERATOR_DIRECTORY,
  type CreateOperatorInput,
  type OperatorDirectory,
} from '../domain/operator-directory.port'
import { toOperatorView, type OperatorView } from './operator-view'

/**
 * Cria um operador novo, já pronto para logar (SDD § D-09, revista na T34):
 * e-mail, senha e nome vêm todos desta mesma chamada, sem link nem e-mail
 * transacional — a Admin API do Supabase confirma o e-mail na hora
 * (`email_confirm: true`), porque não existe passo de confirmação neste fluxo.
 */
@Injectable()
export class CreateOperatorUseCase {
  constructor(@Inject(OPERATOR_DIRECTORY) private readonly directory: OperatorDirectory) {}

  async execute(input: CreateOperatorInput): Promise<OperatorView> {
    const account = await this.directory.create(input)
    return toOperatorView(account)
  }
}
