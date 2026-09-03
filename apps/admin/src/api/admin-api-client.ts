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
  MediaGateway,
  MediaResult,
  RegisterRequest,
  RegisteredMedia,
  UploadCredential,
  UploadRequest,
} from '../media/media-gateway'

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

/** Mensagem exibida quando a API não respondeu — não é recusa, é ausência. */
const UNREACHABLE_MESSAGE = 'Não foi possível falar com a API do CMS.'

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

function readErrorMessage(body: ApiErrorBody, status: number): string {
  return typeof body.error === 'string' && body.error.length > 0
    ? body.error
    : `A API do CMS recusou a operação (erro ${status}).`
}

/**
 * Cliente da API do CMS (SDD § "Visão de tiers").
 *
 * O painel fala com a API e só com ela para conteúdo, mídia e leads — o
 * Supabase é usado exclusivamente para autenticar. O token vai em cada
 * requisição, no mesmo cabeçalho que a guarda da API já lê.
 */
export class AdminApiClient implements SectionsGateway, MediaGateway {
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
    const body = outcome.body as { sections?: SectionSummary[] }
    return { status: 'ok', value: body.sections ?? [] }
  }

  async getSection(
    accessToken: string,
    key: SectionKey,
  ): Promise<LoadResult<SectionDetail>> {
    const outcome = await this.request(accessToken, `${SECTIONS_PATH}/${key}`)
    return outcome.kind === 'ok'
      ? { status: 'ok', value: outcome.body as SectionDetail }
      : { status: 'falha', message: messageOf(outcome) }
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
      return { status: 'salvo', section: outcome.body as SectionDetail }
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
    return outcome.kind === 'ok'
      ? { status: 'alterada', section: outcome.body as SectionSummary }
      : { status: 'falha', message: messageOf(outcome) }
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

  private async request(
    accessToken: string,
    path: string,
    call?: { readonly method: string; readonly body: unknown },
  ): Promise<ApiOutcome> {
    const headers: Record<string, string> = { authorization: `Bearer ${accessToken}` }
    if (call !== undefined) {
      headers['content-type'] = 'application/json'
    }

    let response: Response
    try {
      response = await this.fetchResource(`${this.baseUrl}${path}`, {
        method: call?.method ?? 'GET',
        headers,
        ...(call === undefined ? {} : { body: JSON.stringify(call.body) }),
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

function messageOf(outcome: ApiOutcome): string {
  return outcome.kind === 'recusado' ? outcome.message : UNREACHABLE_MESSAGE
}
