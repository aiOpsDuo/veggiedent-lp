import { Inject, Injectable } from '@nestjs/common'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ENVIRONMENT } from '../../../config/environment'
import type { Environment } from '../../../config/environment.schema'
import { SUPABASE_CLIENT } from '../../../shared/infrastructure/supabase-client'
import { StorageOperationError } from '../../../shared/infrastructure/storage-operation.error'
import type {
  MediaStorage,
  StoredObject,
  UploadCredential,
} from '../domain/media-storage.port'
import type { UploadTarget } from '../domain/upload-plan'

/**
 * Caminho do protocolo retomável (TUS) com credencial assinada, conforme a
 * documentação vigente do Supabase Storage: o painel aponta o cliente TUS para
 * este endereço e manda o token no cabeçalho `x-signature`, com os metadados
 * `bucketName`, `objectName` e `contentType`, em blocos de 6 MB. É o caminho
 * dos vídeos, que o SDD § D-05 exige retomáveis.
 */
const RESUMABLE_UPLOAD_PATH = '/storage/v1/upload/resumable/sign'

/**
 * Validade da credencial de upload. O Supabase a fixa em duas horas e **não a
 * devolve** na resposta de `createSignedUploadUrl`; o valor está aqui para o
 * painel poder avisar o operador, e não é ele quem controla a expiração — quem
 * expira é o token, do lado do armazenamento.
 */
const CREDENTIAL_LIFETIME_SECONDS = 2 * 60 * 60

const OBJECT_NOT_FOUND_STATUS = 404

/**
 * O erro do Storage carrega o status HTTP, mas o tipo exportado pelo pacote não
 * o declara em todas as suas variantes — daí a leitura defensiva em vez de um
 * `error.status` direto.
 */
function isNotFound(error: unknown): boolean {
  return (error as { status?: number }).status === OBJECT_NOT_FOUND_STATUS
}

/**
 * Armazenamento de mídia sobre o Supabase Storage.
 *
 * Único ponto do sistema que fala com o armazenamento, e o faz com a chave
 * secreta — que **não sai daqui**. O navegador recebe apenas a credencial
 * temporária emitida por `createUploadCredential`, válida para um caminho, em
 * um bucket, por tempo limitado (SDD § D-05).
 *
 * Nenhum método transfere bytes: emite credencial, pergunta o que existe,
 * calcula endereço público e apaga.
 */
@Injectable()
export class SupabaseMediaStorage implements MediaStorage {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    @Inject(ENVIRONMENT) private readonly environment: Environment,
  ) {}

  async createUploadCredential(target: UploadTarget): Promise<UploadCredential> {
    const { data, error } = await this.supabase.storage
      .from(target.policy.bucket)
      .createSignedUploadUrl(target.path)

    if (error) {
      throw new StorageOperationError('emitir credencial de upload', error)
    }

    return {
      signedUrl: data.signedUrl,
      token: data.token,
      resumableEndpoint: `${this.environment.SUPABASE_URL}${RESUMABLE_UPLOAD_PATH}`,
      expiresInSeconds: CREDENTIAL_LIFETIME_SECONDS,
    }
  }

  /**
   * Ausência do arquivo é resposta, não falha: é o caso de um upload que não
   * chegou ao fim. Qualquer outro erro sobe — tratar indisponibilidade do
   * armazenamento como "arquivo não existe" faria a API recusar uma confirmação
   * legítima dizendo a coisa errada.
   */
  async findObject(bucket: string, path: string): Promise<StoredObject | null> {
    const { data, error } = await this.supabase.storage.from(bucket).info(path)

    if (error) {
      if (isNotFound(error)) {
        return null
      }
      throw new StorageOperationError('consultar arquivo no armazenamento', error)
    }

    return { sizeBytes: data.size ?? 0, mimeType: data.contentType ?? null }
  }

  publicUrlFor(bucket: string, path: string): string {
    return this.supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
  }

  async remove(bucket: string, path: string): Promise<void> {
    const { error } = await this.supabase.storage.from(bucket).remove([path])
    if (error) {
      throw new StorageOperationError('remover arquivo do armazenamento', error)
    }
  }
}
