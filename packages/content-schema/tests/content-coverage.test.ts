/**
 * Cobertura dos esquemas sobre o conteúdo que hoje vive em código.
 *
 * Critério de "pronto" da T2: os esquemas cobrem todos os campos hoje presentes
 * nos 12 arquivos `*.content.ts`. Este teste confronta cada arquivo com o
 * esquema da sua seção: uma chave de conteúdo que não tenha campo correspondente
 * reprova, e é assim que se descobre um campo esquecido antes da migração (T9).
 *
 * O esquema não copia os nomes de hoje ao pé da letra — achata objetos de
 * agrupamento, renomeia referências de mídia e substitui controles em código por
 * visibilidade. Cada uma dessas diferenças é declarada abaixo, com o motivo;
 * nada é dispensado em silêncio.
 */
import { describe, expect, it } from 'vitest'
import type { SectionKey, SectionSchema } from '../src/contract'
import { SECTION_KEYS } from '../src/contract'
import { sectionSchemas } from '../src/sections'
import { readContentKeyPaths } from './content-files'

interface ContentKeyTranslation {
  /** Chaves que ganharam outro nome ao virar campo de esquema. */
  readonly renamed?: Readonly<Record<string, string>>
  /** Objetos de agrupamento que o esquema achatou em campos irmãos. */
  readonly grouping?: readonly string[]
  /** Controles de publicação escritos em código, hoje substituídos por visibilidade. */
  readonly visibilityControls?: readonly string[]
  /** Chaves técnicas do código atual, sem texto que o operador edite. */
  readonly technicalKeys?: readonly string[]
}

const FORM_FIELD_NAMES = [
  'nome',
  'email',
  'telefone',
  'nomeCachorro',
  'porteCachorro',
  'cidadeEstado',
  'conheceVirbac',
  'usaProdutoVirbac',
  'qualProdutoVirbac',
] as const

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

/** `fields.nome.label` do arquivo atual é `formNomeLabel` no esquema. */
const formFieldRenames: Record<string, string> = Object.fromEntries(
  FORM_FIELD_NAMES.flatMap((name) => [
    [`fields.${name}.label`, `form${capitalize(name)}Label`],
    [`fields.${name}.placeholder`, `form${capitalize(name)}Placeholder`],
  ]),
)

const formFieldGroups: string[] = ['fields', ...FORM_FIELD_NAMES.map((name) => `fields.${name}`)]

const CONTENT_KEY_TRANSLATION: Partial<Record<SectionKey, ContentKeyTranslation>> = {
  educacao: {
    renamed: { 'cards.image.src': 'cards.image', 'cards.image.alt': 'cards.imageAlt' },
  },
  rotina: {
    renamed: { 'steps.image.src': 'steps.image', 'steps.image.alt': 'steps.imageAlt' },
  },
  demonstracao: {
    renamed: {
      'banner.overline': 'bannerOverline',
      'banner.headline': 'bannerHeadline',
      'banner.body': 'bannerBody',
      'banner.ctaLabel': 'bannerCtaLabel',
      'videos.src': 'videos.video',
      'videos.posterSrc': 'videos.poster',
      'videos.captionsSrc': 'videos.captions',
    },
    grouping: ['banner'],
    // O identificador do vídeo hoje é digitado no código para servir de âncora;
    // no CMS a identidade do item vem do registro, não de um texto editável.
    technicalKeys: ['videos.id'],
  },
  ingredientes: {
    visibilityControls: ['isContentReady'],
  },
  captura_lead: {
    renamed: {
      ...formFieldRenames,
      ebookTitlePlaceholder: 'ebookTitle',
      'errorMessages.nome': 'errorNome',
      'errorMessages.email': 'errorEmail',
      'errorMessages.aceiteLgpd': 'errorAceiteLgpd',
      'successModal.title': 'successModalTitle',
      'successModal.body': 'successModalBody',
      'successModal.closeAriaLabel': 'successModalCloseAriaLabel',
      'successModal.downloadCtaLabel': 'successModalDownloadCtaLabel',
      'successModal.emailModeMessage': 'successModalEmailModeMessage',
    },
    grouping: [...formFieldGroups, 'errorMessages', 'successModal'],
  },
  onde_comprar: {
    renamed: { 'partners.logoUrl': 'partners.logo' },
  },
  faq: {
    visibilityControls: ['items.isReadyForProduction'],
  },
  footer: {
    renamed: { legalDataPlaceholder: 'legalData' },
  },
}

function translationOf(section: SectionKey): ContentKeyTranslation {
  return CONTENT_KEY_TRANSLATION[section] ?? {}
}

function omittedKeys(section: SectionKey): Set<string> {
  const { grouping = [], visibilityControls = [], technicalKeys = [] } = translationOf(section)
  return new Set([...grouping, ...visibilityControls, ...technicalKeys])
}

function declaredKeys(section: SectionKey): string[] {
  const { renamed = {} } = translationOf(section)
  return [...Object.keys(renamed), ...omittedKeys(section)]
}

function schemaKeyPaths(schema: SectionSchema): Set<string> {
  const paths = new Set<string>(schema.fields.map((field) => field.name))
  for (const list of schema.lists) {
    paths.add(list.name)
    for (const field of list.itemFields) paths.add(`${list.name}.${field.name}`)
  }
  return paths
}

/** Chaves do arquivo de conteúdo que nenhum campo do esquema cobre. */
function uncoveredContentKeys(section: SectionKey): string[] {
  const { renamed = {} } = translationOf(section)
  const omitted = omittedKeys(section)
  const schemaPaths = schemaKeyPaths(sectionSchemas[section])

  return [...readContentKeyPaths(section)]
    .filter((contentKey) => !omitted.has(contentKey))
    .filter((contentKey) => !schemaPaths.has(renamed[contentKey] ?? contentKey))
    .sort()
}

describe('cobertura dos esquemas sobre os arquivos `*.content.ts`', () => {
  it.each(SECTION_KEYS)('o arquivo de conteúdo de %s é lido e declara campos', (section) => {
    expect(readContentKeyPaths(section).size).toBeGreaterThan(0)
  })

  it.each(SECTION_KEYS)('o esquema de %s cobre todo campo hoje presente no arquivo', (section) => {
    expect(uncoveredContentKeys(section)).toEqual([])
  })

  it.each(SECTION_KEYS)('a tradução declarada para %s não tem entrada obsoleta', (section) => {
    const contentKeys = readContentKeyPaths(section)
    const obsolete = declaredKeys(section).filter((key) => !contentKeys.has(key))

    expect(obsolete).toEqual([])
  })

  it.each(SECTION_KEYS)('toda renomeação declarada para %s aponta para um campo do esquema', (section) => {
    const schemaPaths = schemaKeyPaths(sectionSchemas[section])
    const { renamed = {} } = translationOf(section)
    const dangling = Object.values(renamed).filter((schemaPath) => !schemaPaths.has(schemaPath))

    expect(dangling).toEqual([])
  })
})
