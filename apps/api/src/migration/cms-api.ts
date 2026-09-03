import type { SectionKey } from '@veggiedent/content-schema'
import type { SectionDetail } from '../modules/content/application/section-view'
import type { MediaView, UploadCredentialView } from '../modules/media/application/media-view'
import type { SiteMetadataView } from '../modules/metadata/application/seo-metadata'

/**
 * Cliente HTTP dos endpoints administrativos da API.
 *
 * A migração grava **pelos mesmos endpoints que o painel usa**, e não direto no
 * banco. É o que garante que ela não escapa da validação de esquema: um
 * documento fora de forma é recusado com `422` aqui do mesmo jeito que seria
 * para um operador (SDD § D-01 e § R-03).
 *
 * Os tipos de resposta são os que a própria API declara — importados como tipo,
 * então nada disso existe em tempo de execução. Se um contrato mudar, esta
 * classe deixa de compilar em vez de decodificar errado em silêncio.
 */

export interface CmsApiConfig {
  /** Raiz da API, com o prefixo. Ex.: `http://localhost:3000/api`. */
  readonly baseUrl: string
  /** Token de operador do Supabase Auth. */
  readonly accessToken: string
}

/** O que a API respondeu quando não foi um sucesso. */
export class CmsApiError extends Error {
  constructor(
    readonly method: string,
    readonly path: string,
    readonly status: number,
    readonly body: string,
  ) {
    super(`${method} ${path} respondeu ${status}: ${body}`)
    this.name = 'CmsApiError'
  }
}

const NOT_FOUND = 404
const NO_CONTENT = 204

export interface UploadRequest {
  readonly originalFilename: string
  readonly contentType: string
  readonly sizeBytes: number
}

export interface RegisterMediaRequest {
  readonly kind: string
  readonly path: string
  readonly originalFilename: string
}

export class CmsApi {
  constructor(private readonly config: CmsApiConfig) {}

  private async send(method: string, path: string, body?: unknown): Promise<Response> {
    const headers: Record<string, string> = {
      authorization: `Bearer ${this.config.accessToken}`,
    }
    if (body !== undefined) {
      headers['content-type'] = 'application/json'
    }
    return fetch(`${this.config.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await this.send(method, path, body)
    if (!response.ok) {
      throw new CmsApiError(method, path, response.status, await response.text())
    }
    return response.status === NO_CONTENT ? (undefined as T) : ((await response.json()) as T)
  }

  async getSection(key: SectionKey): Promise<SectionDetail> {
    return this.request<SectionDetail>('GET', `/admin/sections/${key}`)
  }

  async saveSection(key: SectionKey, document: unknown): Promise<SectionDetail> {
    return this.request<SectionDetail>('PUT', `/admin/sections/${key}`, document)
  }

  async setSectionVisibility(key: SectionKey, isPublished: boolean): Promise<void> {
    await this.request<unknown>('PATCH', `/admin/sections/${key}/visibility`, { isPublished })
  }

  /** `null` quando a mídia não existe mais — registro apagado entre execuções. */
  async findMedia(id: string): Promise<MediaView | null> {
    const response = await this.send('GET', `/admin/media/${id}`)
    if (response.status === NOT_FOUND) {
      return null
    }
    if (!response.ok) {
      throw new CmsApiError('GET', `/admin/media/${id}`, response.status, await response.text())
    }
    return (await response.json()) as MediaView
  }

  async issueUploadCredential(request: UploadRequest): Promise<UploadCredentialView> {
    return this.request<UploadCredentialView>('POST', '/admin/media/upload-url', request)
  }

  async registerMedia(request: RegisterMediaRequest): Promise<MediaView> {
    return this.request<MediaView>('POST', '/admin/media', request)
  }

  async getMetadata(): Promise<SiteMetadataView> {
    return this.request<SiteMetadataView>('GET', '/admin/metadata')
  }

  async saveMetadata(document: unknown): Promise<SiteMetadataView> {
    return this.request<SiteMetadataView>('PUT', '/admin/metadata', document)
  }
}
