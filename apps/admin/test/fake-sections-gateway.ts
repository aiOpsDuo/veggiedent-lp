import type { SectionKey } from '@veggiedent/content-schema'
import { orderedSectionSchemas } from '@veggiedent/content-schema'
import type {
  FieldErrors,
  LoadResult,
  SaveResult,
  SectionDetail,
  SectionSummary,
  SectionsGateway,
  VisibilityResult,
} from '../src/content/sections-gateway'

/**
 * Dublê da API do CMS: guarda os documentos em memória e responde como a API
 * responde. A rede inteira do painel mora aqui e só aqui — o formulário, o
 * roteador e o estado exercitados nos testes são o código de produção.
 *
 * Ele guarda o que recebe, e não apenas registra a chamada, porque é isso que
 * permite verificar o que interessa de verdade em uma edição: recarregar a
 * tela e encontrar o que foi salvo, na ordem em que foi salvo.
 */

const LAST_EDIT = '2026-09-03T12:00:00.000Z'

interface StoredSection {
  data: Record<string, unknown>
  isPublished: boolean
  updatedAt: string | null
}

export interface FakeSectionsGatewayOptions {
  /** Documentos iniciais por seção. As demais nascem vazias. */
  readonly documents?: Readonly<Partial<Record<SectionKey, Record<string, unknown>>>>
  /** Quando presente, a próxima gravação é recusada com estes erros por campo. */
  readonly rejectSaveWith?: FieldErrors
  /** Quando presente, toda leitura e gravação falha com esta mensagem. */
  readonly failWith?: string
}

export class FakeSectionsGateway implements SectionsGateway {
  readonly savedDocuments: { key: SectionKey; document: Record<string, unknown> }[] = []
  private readonly sections = new Map<SectionKey, StoredSection>()
  private rejectSaveWith: FieldErrors | undefined

  constructor(private readonly options: FakeSectionsGatewayOptions = {}) {
    this.rejectSaveWith = options.rejectSaveWith
    for (const schema of orderedSectionSchemas) {
      const data = options.documents?.[schema.key]
      this.sections.set(schema.key, {
        data: data ?? {},
        isPublished: data !== undefined,
        updatedAt: data === undefined ? null : LAST_EDIT,
      })
    }
  }

  async listSections(_accessToken?: string): Promise<LoadResult<readonly SectionSummary[]>> {
    if (this.options.failWith !== undefined) {
      return { status: 'falha', message: this.options.failWith }
    }
    // Fora da ordem da página de propósito: a ordem exibida é responsabilidade
    // do painel, que a tira do esquema, e não da ordem em que a API respondeu.
    const summaries = orderedSectionSchemas
      .map((schema) => this.summaryOf(schema.key))
      .reverse()
    return { status: 'ok', value: summaries }
  }

  async getSection(
    _accessToken: string,
    key: SectionKey,
  ): Promise<LoadResult<SectionDetail>> {
    if (this.options.failWith !== undefined) {
      return { status: 'falha', message: this.options.failWith }
    }
    return { status: 'ok', value: this.detailOf(key) }
  }

  async saveSection(
    _accessToken: string,
    key: SectionKey,
    document: Readonly<Record<string, unknown>>,
  ): Promise<SaveResult> {
    if (this.options.failWith !== undefined) {
      return { status: 'falha', message: this.options.failWith }
    }
    this.savedDocuments.push({ key, document: { ...document } })

    const rejection = this.rejectSaveWith
    if (rejection !== undefined) {
      this.rejectSaveWith = undefined
      return { status: 'invalido', fields: rejection }
    }

    this.sections.set(key, { data: { ...document }, isPublished: true, updatedAt: LAST_EDIT })
    return { status: 'salvo', section: this.detailOf(key) }
  }

  async setSectionVisibility(
    _accessToken: string,
    key: SectionKey,
    isPublished: boolean,
  ): Promise<VisibilityResult> {
    if (this.options.failWith !== undefined) {
      return { status: 'falha', message: this.options.failWith }
    }
    const stored = this.storedOf(key)
    this.sections.set(key, { ...stored, isPublished })
    return { status: 'alterada', section: this.summaryOf(key) }
  }

  /** O último documento gravado de uma seção, como a API o recebeu. */
  lastDocumentOf(key: SectionKey): Record<string, unknown> | undefined {
    return this.savedDocuments.filter((saved) => saved.key === key).at(-1)?.document
  }

  private storedOf(key: SectionKey): StoredSection {
    return this.sections.get(key) ?? { data: {}, isPublished: false, updatedAt: null }
  }

  private summaryOf(key: SectionKey): SectionSummary {
    const stored = this.storedOf(key)
    const schema = orderedSectionSchemas.find((each) => each.key === key)
    return {
      key,
      label: schema?.label ?? key,
      isPublished: stored.isPublished,
      updatedAt: stored.updatedAt,
    }
  }

  private detailOf(key: SectionKey): SectionDetail {
    return { ...this.summaryOf(key), data: { ...this.storedOf(key).data } }
  }
}
