import { Inject, Injectable } from '@nestjs/common'
import {
  OPERATOR_DIRECTORY,
  type OperatorDirectory,
  type OperatorInvite,
} from '../domain/operator-directory.port'

/**
 * Convida um novo operador (SDD § D-09): gera o link de ativação de uso único
 * pela Admin API do Supabase e o devolve — só nesta resposta. Nenhum e-mail é
 * enviado pela API (D-09, "sem e-mail transacional"); quem convida copia o
 * link e o envia pelo canal que preferir.
 */
@Injectable()
export class InviteOperatorUseCase {
  constructor(@Inject(OPERATOR_DIRECTORY) private readonly directory: OperatorDirectory) {}

  async execute(email: string): Promise<OperatorInvite> {
    return this.directory.invite(email)
  }
}
