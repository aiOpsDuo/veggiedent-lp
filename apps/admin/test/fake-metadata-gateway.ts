import type {
  MetadataGateway,
  MetadataLoadResult,
  MetadataSaveResult,
  SiteMetadataDetail,
} from '../src/metadata/metadata-gateway'
import type { FieldErrors } from '../src/content/sections-gateway'

/**
 * Dublê de `GET`/`PUT /api/admin/metadata`. Guarda o documento que recebe, e
 * não apenas registra a chamada: é isso que permite verificar o que interessa
 * numa edição — recarregar e encontrar o que foi salvo.
 */

const LAST_EDIT = '2026-09-03T12:00:00.000Z'

export interface FakeMetadataGatewayOptions {
  readonly metadata?: Record<string, unknown>
  /** Quando presente, a próxima gravação é recusada com estes erros por campo. */
  readonly rejectSaveWith?: FieldErrors
  /** Quando presente, toda leitura e gravação falha com esta mensagem. */
  readonly failWith?: string
}

export class FakeMetadataGateway implements MetadataGateway {
  readonly savedDocuments: Record<string, unknown>[] = []
  private metadata: Record<string, unknown>
  private updatedAt: string | null
  private rejectSaveWith: FieldErrors | undefined

  constructor(private readonly options: FakeMetadataGatewayOptions = {}) {
    this.metadata = { ...(options.metadata ?? {}) }
    this.updatedAt = options.metadata === undefined ? null : LAST_EDIT
    this.rejectSaveWith = options.rejectSaveWith
  }

  async getMetadata(): Promise<MetadataLoadResult> {
    if (this.options.failWith !== undefined) {
      return { status: 'falha', message: this.options.failWith }
    }
    return { status: 'ok', value: this.detail() }
  }

  async saveMetadata(
    _accessToken: string,
    document: Readonly<Record<string, unknown>>,
  ): Promise<MetadataSaveResult> {
    if (this.options.failWith !== undefined) {
      return { status: 'falha', message: this.options.failWith }
    }
    this.savedDocuments.push({ ...document })

    const rejection = this.rejectSaveWith
    if (rejection !== undefined) {
      this.rejectSaveWith = undefined
      return { status: 'invalido', fields: rejection }
    }

    this.metadata = { ...document }
    this.updatedAt = LAST_EDIT
    return { status: 'salvo', value: this.detail() }
  }

  /** O último documento gravado, como a API o recebeu. */
  get lastDocument(): Record<string, unknown> | undefined {
    return this.savedDocuments.at(-1)
  }

  private detail(): SiteMetadataDetail {
    return { metadata: { ...this.metadata }, updatedAt: this.updatedAt }
  }
}
