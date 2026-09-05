import { Inject, Injectable } from '@nestjs/common'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { SUPABASE_CLIENT } from '../../../shared/infrastructure/supabase-client'
import { SupabaseAuthOperationError } from '../../../shared/infrastructure/supabase-auth-operation.error'
import type { OperatorAccount } from '../domain/operator-account'
import type { CreateOperatorInput, OperatorDirectory } from '../domain/operator-directory.port'

function nameFromMetadata(user: User): string | null {
  const name = user.user_metadata?.name
  return typeof name === 'string' && name.trim().length > 0 ? name : null
}

function toOperatorAccount(user: User): OperatorAccount {
  return {
    id: user.id,
    email: user.email ?? '',
    name: nameFromMetadata(user),
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
 * `create` usa `admin.createUser` com `email_confirm: true` (D-09, revista na
 * T34): a conta nasce pronta para logar, sem link nem e-mail — sem
 * `email_confirm`, o Supabase esperaria uma confirmação que este fluxo nunca
 * envia, e a conta ficaria pendente para sempre.
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

  async create(input: CreateOperatorInput): Promise<OperatorAccount> {
    const { data, error } = await this.client.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: { name: input.name },
    })
    if (error) {
      throw new SupabaseAuthOperationError('criar operador', error)
    }
    return toOperatorAccount(data.user)
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.client.auth.admin.deleteUser(id)
    if (error) {
      throw new SupabaseAuthOperationError('remover operador', error)
    }
  }
}
