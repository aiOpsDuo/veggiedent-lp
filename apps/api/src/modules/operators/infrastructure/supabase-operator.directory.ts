import { Inject, Injectable } from '@nestjs/common'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { SUPABASE_CLIENT } from '../../../shared/infrastructure/supabase-client'
import { SupabaseAuthOperationError } from '../../../shared/infrastructure/supabase-auth-operation.error'
import type { OperatorAccount } from '../domain/operator-account'
import type { OperatorDirectory, OperatorInvite } from '../domain/operator-directory.port'

function toOperatorAccount(user: User): OperatorAccount {
  return {
    id: user.id,
    email: user.email ?? '',
    createdAt: user.created_at,
    lastSignInAt: user.last_sign_in_at ?? null,
  }
}

/**
 * Fala com a Admin API do Supabase Auth (SDD § D-09). Não existe tabela de
 * operadores no banco do CMS — o Supabase Auth é a única fonte, e é por isso
 * que este adaptador usa `.auth.admin.*` do cliente já compartilhado
 * (`supabase-client.ts`), nunca `.from(...)` como os repositórios dos outros
 * módulos.
 *
 * `invite` usa `generateLink({ type: 'invite' })`, nunca `inviteUserByEmail`
 * (D-09): o link volta na resposta para quem convida copiar, em vez de a API
 * depender do servidor de e-mail do Supabase, nunca testado neste projeto.
 */
@Injectable()
export class SupabaseOperatorDirectory implements OperatorDirectory {
  constructor(@Inject(SUPABASE_CLIENT) private readonly client: SupabaseClient) {}

  async listAll(): Promise<OperatorAccount[]> {
    const { data, error } = await this.client.auth.admin.listUsers()
    if (error) {
      throw new SupabaseAuthOperationError('listar operadores', error)
    }
    return data.users.map(toOperatorAccount)
  }

  async invite(email: string): Promise<OperatorInvite> {
    const { data, error } = await this.client.auth.admin.generateLink({ type: 'invite', email })
    if (error) {
      throw new SupabaseAuthOperationError('convidar operador', error)
    }
    return { email, activationLink: data.properties.action_link }
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.client.auth.admin.deleteUser(id)
    if (error) {
      throw new SupabaseAuthOperationError('remover operador', error)
    }
  }
}
