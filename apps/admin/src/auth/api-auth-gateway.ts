import type { AdminEnvironment } from '../config/env'
import type { AuthGateway, SignInResult, Unsubscribe } from './auth-gateway'
import type { OperatorCredentials, OperatorSession } from './operator-session'

/**
 * Adaptador da API própria para a porta de autenticação (SDD § D-03,
 * reescrita em 2026-09-21). Substitui `supabase-auth-gateway.ts`: não há mais
 * um provedor de identidade externo para emitir e verificar sessão — o
 * painel fala só com `POST /api/auth/login`, guarda o token que recebe e o
 * repassa em `Authorization: Bearer` no resto das chamadas administrativas
 * (`AdminApiClient`, que já fazia isso antes desta troca).
 */

/**
 * O recorte do Web Storage que este adaptador usa — subconjunto de `Storage`
 * (DOM), estreito de propósito (ISP, mesma razão de `SupabaseAuthApi` antes
 * dele): o dublê de teste implementa três métodos, não o armazenamento do
 * navegador inteiro.
 */
export interface AuthStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/**
 * Chave do armazenamento do navegador para a sessão do painel. Própria do
 * painel — a LP, servida no mesmo domínio (T16), nunca compartilha esta
 * chave —, mesma ideia de isolamento que `storageKey` já dava ao cliente do
 * Supabase em `ADMIN_AUTH_OPTIONS`.
 */
export const AUTH_STORAGE_KEY = 'veggiedent-admin-auth'

const LOGIN_PATH = '/auth/login'

const HTTP_OK = 200

/**
 * O `fetch` do navegador precisa ser chamado com o objeto global como
 * contexto — mesma ressalva de `admin-api-client.ts`: guardá-lo numa
 * propriedade e chamá-lo dali dispara "Illegal invocation" no navegador, algo
 * que o jsdom dos testes não reproduz.
 */
const browserFetch: typeof fetch = (input, init) => globalThis.fetch(input, init)

interface StoredSession {
  readonly accessToken: string
}

interface LoginResponseBody {
  readonly accessToken?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Lê os claims do JWT (`sub`, `email`) sem verificar a assinatura.
 *
 * **Isto não é verificação de autenticidade — só leitura de um campo já
 * público.** O payload de um JWT é Base64URL simples, não cifrado; qualquer
 * um consegue lê-lo, com ou sem a chave de assinatura. Quem verifica a
 * assinatura de verdade, a cada requisição, é a API (SDD § D-03) — é isso que
 * impede um token forjado de fazer qualquer coisa além de decodificar aqui.
 * Sem um endpoint "whoami" (fora do escopo desta tarefa: a API não tem um, e
 * criar um não foi pedido), este é o único jeito de obter
 * `operatorId`/`operatorEmail` para o cabeçalho do painel sem uma chamada de
 * rede a mais a cada carregamento.
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const segments = token.split('.')
  if (segments.length !== 3) {
    return null
  }
  try {
    const base64 = segments[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
    const json = decodeURIComponent(
      Array.prototype.map
        .call(atob(padded), (character: string) => `%${character.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join(''),
    )
    const payload: unknown = JSON.parse(json)
    return isRecord(payload) ? payload : null
  } catch {
    return null
  }
}

function sessionFromToken(accessToken: string): OperatorSession | null {
  const payload = decodeJwtPayload(accessToken)
  if (payload === null) {
    return null
  }
  const operatorId = typeof payload.sub === 'string' ? payload.sub : ''
  const operatorEmail = typeof payload.email === 'string' ? payload.email : ''
  return { operatorId, operatorEmail, accessToken }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

/**
 * Gateway de autenticação contra a própria API (SDD § D-03).
 *
 * Recebe o armazenamento e o `fetch` prontos em vez de construí-los — mesmo
 * motivo de sempre: é o que permite ao teste exercitar login, sessão
 * persistida e logout sem tocar rede nem `localStorage` real.
 */
export class ApiAuthGateway implements AuthGateway {
  private readonly baseUrl: string
  private readonly listeners = new Set<(session: OperatorSession | null) => void>()

  constructor(
    baseUrl: string,
    private readonly storage: AuthStorage,
    private readonly fetchResource: typeof fetch = browserFetch,
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, '')
  }

  /**
   * Sem um provedor de identidade externo, não existe `onAuthStateChange` de
   * graça (o que o cliente do Supabase dava antes) — este adaptador mantém a
   * própria lista de observadores, avisados em `signIn`/`signOut`/aqui.
   *
   * O primeiro aviso é **imediato e síncrono**, com a sessão já lida do
   * armazenamento (ou `null`), antes de qualquer chamada de rede — é o mesmo
   * contrato que `auth-gateway.ts` documenta como obrigatório, só que
   * cumprido por um mecanismo próprio em vez de repassado do Supabase.
   */
  observeSession(listener: (session: OperatorSession | null) => void): Unsubscribe {
    this.listeners.add(listener)
    listener(this.readSession())
    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * `POST /api/auth/login`. A API já devolve `401` genérico tanto para
   * e-mail inexistente quanto para senha errada (SDD § D-03/C-02) — este
   * adaptador não tenta refinar essa distinção, e por isso classifica
   * **qualquer** resposta que não seja `200` como `credenciais-invalidas`,
   * inclusive um eventual erro de servidor. Só a ausência completa de
   * resposta — a chamada de rede falhando antes de qualquer status chegar —
   * conta como `indisponivel`: é o único caso em que ninguém, nem a API,
   * chegou a julgar as credenciais.
   */
  async signIn(credentials: OperatorCredentials): Promise<SignInResult> {
    let response: Response
    try {
      response = await this.fetchResource(`${this.baseUrl}${LOGIN_PATH}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(credentials),
      })
    } catch {
      return { ok: false, rejection: 'indisponivel' }
    }

    if (response.status !== HTTP_OK) {
      return { ok: false, rejection: 'credenciais-invalidas' }
    }

    const body = (await readJson(response)) as LoginResponseBody
    if (typeof body.accessToken !== 'string' || body.accessToken.length === 0) {
      return { ok: false, rejection: 'indisponivel' }
    }

    this.writeSession({ accessToken: body.accessToken })
    return { ok: true }
  }

  /**
   * Sem endpoint de logout na API — desenho stateless herdado do SDD § D-03:
   * o JWT não tem lista de revogação, e "sair" sempre foi só o painel
   * descartar o token guardado, mesmo com o Supabase. Por isso **não há
   * nenhuma chamada de rede aqui**, de propósito, não por omissão: limpar o
   * armazenamento local é o `signOut` inteiro, e é por isso que ele nunca
   * falha do lado do painel.
   */
  async signOut(): Promise<void> {
    this.storage.removeItem(AUTH_STORAGE_KEY)
    this.notify(null)
  }

  private readSession(): OperatorSession | null {
    const raw = this.storage.getItem(AUTH_STORAGE_KEY)
    if (raw === null) {
      return null
    }
    try {
      const stored = JSON.parse(raw) as StoredSession
      return typeof stored.accessToken === 'string' ? sessionFromToken(stored.accessToken) : null
    } catch {
      return null
    }
  }

  private writeSession(stored: StoredSession): void {
    this.storage.setItem(AUTH_STORAGE_KEY, JSON.stringify(stored))
    this.notify(sessionFromToken(stored.accessToken))
  }

  private notify(session: OperatorSession | null): void {
    for (const listener of this.listeners) {
      listener(session)
    }
  }
}

/** Monta o gateway de produção, contra `window.localStorage`. */
export function createApiAuthGateway(environment: AdminEnvironment): AuthGateway {
  return new ApiAuthGateway(environment.apiBaseUrl, window.localStorage)
}
