import type { SectionKey } from '@veggiedent/content-schema'
import type {
  FieldErrors,
  LoadResult,
  SaveResult,
  SectionDetail,
  SectionSummary,
  SectionsGateway,
  VisibilityResult,
} from '../content/sections-gateway'
import type {
  LeadDeleteResult,
  LeadPeriod,
  LeadsExportResult,
  LeadsGateway,
  LeadsPage,
  LeadsPageResult,
  LeadsQuery,
} from '../leads/leads-gateway'
import type {
  MediaGateway,
  MediaResult,
  RegisterRequest,
  RegisteredMedia,
  UploadCredential,
  UploadRequest,
} from '../media/media-gateway'
import type {
  MetadataGateway,
  MetadataLoadResult,
  MetadataSaveResult,
  SiteMetadataDetail,
} from '../metadata/metadata-gateway'
import type {
  OperatorCreateInput,
  OperatorCreateResult,
  OperatorRemoveResult,
  OperatorsGateway,
  OperatorsListResult,
  OperatorView,
} from '../operators/operators-gateway'

/**
 * O que a API respondeu a uma chamada administrativa autenticada.
 *
 * `nao-autorizado` é o `401` da guarda global da API (SDD § D-03): o token que
 * o painel tem em mãos deixou de valer. É diferente de `indisponivel`, em que a
 * API não respondeu — no primeiro caso o operador precisa entrar de novo, no
 * segundo não adianta.
 */
export type AdminAccessCheck = 'autorizado' | 'nao-autorizado' | 'indisponivel'

const UNAUTHORIZED = 401
const FORBIDDEN = 403
const UNPROCESSABLE_ENTITY = 422
const CONFLICT = 409

/**
 * Endpoint usado para conferir se a API aceita o token do operador.
 *
 * É a listagem de seções porque ela é o endpoint administrativo mais barato que
 * existe e o primeiro que o painel consome de verdade. A resposta é descartada:
 * aqui interessa apenas se a guarda da API deixou passar.
 */
const SECTIONS_PATH = '/admin/sections'

/** Rotas de mídia. Nenhuma delas carrega bytes de arquivo (SDD § D-05). */
const MEDIA_PATH = '/admin/media'
const UPLOAD_CREDENTIAL_PATH = `${MEDIA_PATH}/upload-url`

const METADATA_PATH = '/admin/metadata'

const LEADS_PATH = '/admin/leads'
const LEADS_EXPORT_PATH = `${LEADS_PATH}/export`

const OPERATORS_PATH = '/admin/operators'

/** Nome usado quando a resposta da exportação não traz o dela. */
const FALLBACK_EXPORT_FILENAME = 'leads.csv'

/** Mensagem exibida quando a API não respondeu — não é recusa, é ausência. */
const UNREACHABLE_MESSAGE = 'Não foi possível falar com a API do CMS.'

/**
 * Mensagem para o `200` cujo corpo não é um objeto JSON. Um sucesso ilegível
 * não pode virar `null` circulando pelas telas: quem recebe faria `dados.campo`
 * e quebraria longe daqui, com uma mensagem que não diz o que aconteceu.
 */
const UNREADABLE_MESSAGE = 'A API do CMS respondeu em um formato inesperado.'

/**
 * O `fetch` do navegador precisa ser chamado com o objeto global como contexto:
 * guardá-lo em uma propriedade e chamá-lo dali o invocaria com o cliente como
 * contexto, e o navegador recusa isso com "Illegal invocation" — falha que o
 * jsdom dos testes não reproduz, e que apareceu na verificação manual da T10.
 */
const browserFetch: typeof fetch = (input, init) => globalThis.fetch(input, init)

/** A resposta da API já lida, antes de virar o resultado de cada operação. */
type ApiOutcome =
  | { readonly kind: 'ok'; readonly body: unknown }
  | {
      readonly kind: 'recusado'
      readonly status: number
      readonly message: string
      readonly fields?: FieldErrors
    }
  | { readonly kind: 'sem-resposta' }

interface ApiErrorBody {
  readonly error?: unknown
  readonly fields?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Só sobrevive o que tem a forma do contrato: `{ campo: mensagem }`. */
function readFieldErrors(candidate: unknown): FieldErrors | undefined {
  if (!isRecord(candidate)) {
    return undefined
  }
  const fields: Record<string, string> = {}
  for (const [path, message] of Object.entries(candidate)) {
    if (typeof message === 'string') {
      fields[path] = message
    }
  }
  return fields
}

function refusalMessageOf(status: number): string {
  return `A API do CMS recusou a operação (erro ${status}).`
}

function readErrorMessage(body: ApiErrorBody, status: number): string {
  return typeof body.error === 'string' && body.error.length > 0
    ? body.error
    : refusalMessageOf(status)
}

/**
 * Cliente da API do CMS (SDD § "Visão de tiers").
 *
 * O painel fala com a API e só com ela para conteúdo, mídia e leads — o
 * Supabase é usado exclusivamente para autenticar. O token vai em cada
 * requisição, no mesmo cabeçalho que a guarda da API já lê.
 */
export class AdminApiClient
  implements SectionsGateway, MediaGateway, MetadataGateway, LeadsGateway, OperatorsGateway
{
  private readonly baseUrl: string

  constructor(
    baseUrl: string,
    private readonly fetchResource: typeof fetch = browserFetch,
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, '')
  }

  async checkAccess(accessToken: string): Promise<AdminAccessCheck> {
    try {
      const response = await this.fetchResource(`${this.baseUrl}${SECTIONS_PATH}`, {
        headers: { authorization: `Bearer ${accessToken}` },
      })
      if (response.status === UNAUTHORIZED || response.status === FORBIDDEN) {
        return 'nao-autorizado'
      }
      return response.ok ? 'autorizado' : 'indisponivel'
    } catch {
      return 'indisponivel'
    }
  }

  async listSections(accessToken: string): Promise<LoadResult<readonly SectionSummary[]>> {
    const outcome = await this.request(accessToken, SECTIONS_PATH)
    if (outcome.kind !== 'ok') {
      return { status: 'falha', message: messageOf(outcome) }
    }
    const body = isRecord(outcome.body) ? outcome.body : {}
    return { status: 'ok', value: Array.isArray(body.sections) ? body.sections : [] }
  }

  async getSection(
    accessToken: string,
    key: SectionKey,
  ): Promise<LoadResult<SectionDetail>> {
    const outcome = await this.request(accessToken, `${SECTIONS_PATH}/${key}`)
    return toLoadResult<SectionDetail>(outcome)
  }

  async saveSection(
    accessToken: string,
    key: SectionKey,
    document: Readonly<Record<string, unknown>>,
  ): Promise<SaveResult> {
    const outcome = await this.request(accessToken, `${SECTIONS_PATH}/${key}`, {
      method: 'PUT',
      body: document,
    })
    if (outcome.kind === 'ok') {
      return isRecord(outcome.body)
        ? { status: 'salvo', section: outcome.body as unknown as SectionDetail }
        : { status: 'falha', message: UNREADABLE_MESSAGE }
    }
    if (outcome.kind === 'recusado' && outcome.status === UNPROCESSABLE_ENTITY) {
      return { status: 'invalido', fields: outcome.fields ?? {} }
    }
    return { status: 'falha', message: messageOf(outcome) }
  }

  async setSectionVisibility(
    accessToken: string,
    key: SectionKey,
    isPublished: boolean,
  ): Promise<VisibilityResult> {
    const outcome = await this.request(
      accessToken,
      `${SECTIONS_PATH}/${key}/visibility`,
      { method: 'PATCH', body: { isPublished } },
    )
    if (outcome.kind !== 'ok') {
      return { status: 'falha', message: messageOf(outcome) }
    }
    return isRecord(outcome.body)
      ? { status: 'alterada', section: outcome.body as unknown as SectionSummary }
      : { status: 'falha', message: UNREADABLE_MESSAGE }
  }

  async requestUploadCredential(
    accessToken: string,
    request: UploadRequest,
  ): Promise<MediaResult<UploadCredential>> {
    const outcome = await this.request(accessToken, UPLOAD_CREDENTIAL_PATH, {
      method: 'POST',
      body: request,
    })
    return toMediaResult<UploadCredential>(outcome)
  }

  async registerMedia(
    accessToken: string,
    request: RegisterRequest,
  ): Promise<MediaResult<RegisteredMedia>> {
    const outcome = await this.request(accessToken, MEDIA_PATH, {
      method: 'POST',
      body: request,
    })
    return toMediaResult<RegisteredMedia>(outcome)
  }

  async getMedia(accessToken: string, id: string): Promise<MediaResult<RegisteredMedia>> {
    const outcome = await this.request(accessToken, `${MEDIA_PATH}/${id}`)
    return toMediaResult<RegisteredMedia>(outcome)
  }

  async getMetadata(accessToken: string): Promise<MetadataLoadResult> {
    const outcome = await this.request(accessToken, METADATA_PATH)
    return outcome.kind === 'ok'
      ? { status: 'ok', value: toMetadataDetail(outcome.body) }
      : { status: 'falha', message: messageOf(outcome) }
  }

  async saveMetadata(
    accessToken: string,
    document: Readonly<Record<string, unknown>>,
  ): Promise<MetadataSaveResult> {
    const outcome = await this.request(accessToken, METADATA_PATH, {
      method: 'PUT',
      body: document,
    })
    if (outcome.kind === 'ok') {
      return { status: 'salvo', value: toMetadataDetail(outcome.body) }
    }
    if (outcome.kind === 'recusado' && outcome.status === UNPROCESSABLE_ENTITY) {
      return { status: 'invalido', fields: outcome.fields ?? {} }
    }
    return { status: 'falha', message: messageOf(outcome) }
  }

  async listLeads(accessToken: string, query: LeadsQuery): Promise<LeadsPageResult> {
    const outcome = await this.request(
      accessToken,
      `${LEADS_PATH}${queryString({ from: query.from, to: query.to, page: String(query.page) })}`,
    )
    return outcome.kind === 'ok'
      ? { status: 'ok', value: toLeadsPage(outcome.body, query.page) }
      : { status: 'falha', message: messageOf(outcome) }
  }

  /**
   * A exportação é a única resposta administrativa que não é JSON: o corpo é o
   * arquivo. Ele é lido como `Blob` e entregue **sem ser reescrito**, para que
   * o BOM UTF-8 e o separador que a API escreveu cheguem intactos ao Excel
   * (regra de negócio RN-01).
   */
  async exportLeads(accessToken: string, period: LeadPeriod): Promise<LeadsExportResult> {
    const path = `${LEADS_EXPORT_PATH}${queryString({ from: period.from, to: period.to })}`
    let response: Response
    try {
      response = await this.fetchResource(`${this.baseUrl}${path}`, {
        headers: { authorization: `Bearer ${accessToken}` },
      })
    } catch {
      return { status: 'falha', message: UNREACHABLE_MESSAGE }
    }

    if (!response.ok) {
      return { status: 'falha', message: refusalMessageOf(response.status) }
    }
    return {
      status: 'ok',
      value: {
        filename: filenameOf(response.headers.get('content-disposition')),
        content: await response.blob(),
      },
    }
  }

  async deleteLead(accessToken: string, id: string): Promise<LeadDeleteResult> {
    const outcome = await this.request(accessToken, `${LEADS_PATH}/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
    return outcome.kind === 'ok'
      ? { status: 'excluido' }
      : { status: 'falha', message: messageOf(outcome) }
  }

  async listOperators(accessToken: string): Promise<OperatorsListResult> {
    const outcome = await this.request(accessToken, OPERATORS_PATH)
    if (outcome.kind !== 'ok') {
      return { status: 'falha', message: messageOf(outcome) }
    }
    return { status: 'ok', value: Array.isArray(outcome.body) ? (outcome.body as OperatorView[]) : [] }
  }

  async createOperator(
    accessToken: string,
    input: OperatorCreateInput,
  ): Promise<OperatorCreateResult> {
    const outcome = await this.request(accessToken, OPERATORS_PATH, {
      method: 'POST',
      body: input,
    })
    if (outcome.kind === 'ok') {
      return isRecord(outcome.body)
        ? { status: 'criado', value: outcome.body as unknown as OperatorView }
        : { status: 'falha', message: UNREADABLE_MESSAGE }
    }
    if (outcome.kind === 'recusado' && outcome.status === UNPROCESSABLE_ENTITY) {
      const fieldMessage = Object.values(outcome.fields ?? {})[0]
      return { status: 'invalido', message: fieldMessage ?? messageOf(outcome) }
    }
    return { status: 'falha', message: messageOf(outcome) }
  }

  async removeOperator(accessToken: string, id: string): Promise<OperatorRemoveResult> {
    const outcome = await this.request(accessToken, `${OPERATORS_PATH}/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
    if (outcome.kind === 'ok') {
      return { status: 'removido' }
    }
    if (outcome.kind === 'recusado' && outcome.status === CONFLICT) {
      return { status: 'recusado', message: outcome.message }
    }
    return { status: 'falha', message: messageOf(outcome) }
  }

  private async request(
    accessToken: string,
    path: string,
    call?: { readonly method: string; readonly body?: unknown },
  ): Promise<ApiOutcome> {
    const headers: Record<string, string> = { authorization: `Bearer ${accessToken}` }
    const hasBody = call?.body !== undefined
    if (hasBody) {
      headers['content-type'] = 'application/json'
    }

    let response: Response
    try {
      response = await this.fetchResource(`${this.baseUrl}${path}`, {
        method: call?.method ?? 'GET',
        headers,
        ...(hasBody ? { body: JSON.stringify(call?.body) } : {}),
      })
    } catch {
      return { kind: 'sem-resposta' }
    }

    const body = await readJson(response)
    if (response.ok) {
      return { kind: 'ok', body }
    }
    const errorBody: ApiErrorBody = isRecord(body) ? body : {}
    return {
      kind: 'recusado',
      status: response.status,
      message: readErrorMessage(errorBody, response.status),
      fields: readFieldErrors(errorBody.fields),
    }
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

/**
 * A recusa de mídia vira uma mensagem só. A API endereça o erro ao campo do
 * **corpo** que ela recebeu (`contentType`, `sizeBytes`), e nenhum desses
 * campos existe no formulário — quem os preenche é o navegador, a partir do
 * arquivo. Mostrar a primeira mensagem ao lado do campo de mídia diz ao
 * operador o que ele precisa saber; pendurá-la num campo que ele não vê, não.
 */
function toMediaResult<T>(outcome: ApiOutcome): MediaResult<T> {
  if (outcome.kind === 'ok') {
    return { status: 'ok', value: outcome.body as T }
  }
  const fieldMessage = Object.values(outcome.kind === 'recusado' ? outcome.fields ?? {} : {})[0]
  return { status: 'recusado', message: fieldMessage ?? messageOf(outcome) }
}

/** Sucesso vira valor só quando o corpo tem forma de objeto (ver `UNREADABLE_MESSAGE`). */
function toLoadResult<T>(outcome: ApiOutcome): LoadResult<T> {
  if (outcome.kind !== 'ok') {
    return { status: 'falha', message: messageOf(outcome) }
  }
  return isRecord(outcome.body)
    ? { status: 'ok', value: outcome.body as unknown as T }
    : { status: 'falha', message: UNREADABLE_MESSAGE }
}

function messageOf(outcome: ApiOutcome): string {
  return outcome.kind === 'recusado' ? outcome.message : UNREACHABLE_MESSAGE
}

/**
 * Os parâmetros de consulta que têm valor. Um filtro em branco é ausência de
 * filtro, e mandá-lo vazio faria a API validar um dia que ninguém escolheu.
 */
function queryString(params: Readonly<Record<string, string>>): string {
  const search = new URLSearchParams()
  for (const [name, value] of Object.entries(params)) {
    if (value.trim().length > 0) {
      search.set(name, value.trim())
    }
  }
  const query = search.toString()
  return query.length > 0 ? `?${query}` : ''
}

/**
 * Uma resposta incompleta vira metadados vazios, nunca uma tela quebrada: o
 * formulário sabe desenhar campo sem valor, que é o estado real de metadados
 * ainda não preenchidos.
 */
function toMetadataDetail(body: unknown): SiteMetadataDetail {
  const source = isRecord(body) ? body : {}
  return {
    metadata: isRecord(source.metadata) ? source.metadata : {},
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : null,
  }
}

/**
 * A página de leads, tolerante ao que faltar. Ficar sem `total` não pode virar
 * `NaN` na contagem exibida nem paginação impossível de sair.
 */
function toLeadsPage(body: unknown, requestedPage: number): LeadsPage {
  const source = isRecord(body) ? body : {}
  const leads = Array.isArray(source.leads) ? (source.leads as LeadsPage['leads']) : []
  return {
    leads,
    total: typeof source.total === 'number' ? source.total : leads.length,
    page: typeof source.page === 'number' ? source.page : requestedPage,
    pageSize:
      typeof source.pageSize === 'number' && source.pageSize > 0
        ? source.pageSize
        : Math.max(leads.length, 1),
  }
}

/** O nome do arquivo que a API mandou baixar, em `Content-Disposition`. */
function filenameOf(contentDisposition: string | null): string {
  const quoted = contentDisposition?.match(/filename="([^"]+)"/)?.[1]
  return quoted !== undefined && quoted.length > 0 ? quoted : FALLBACK_EXPORT_FILENAME
}
