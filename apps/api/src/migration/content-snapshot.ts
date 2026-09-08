import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { SECTION_KEYS, isSectionKey, type SectionKey } from '@veggiedent/content-schema'

/**
 * O instantâneo de conteúdo como fonte da carga do CMS (PLAN.md § T23).
 *
 * O instantâneo é a cópia versionada do conteúdo publicado, gravada por
 * `npm run instantaneo` e embutida no build da LP (SDD § D-08). Ele é a fonte
 * da carga porque é a única cópia do conteúdo que vive no repositório: os
 * `*.content.ts` que a carga original lia deixaram de existir na T14, e
 * duplicá-los aqui criaria uma segunda verdade a manter em sincronia.
 *
 * Da forma publicada vêm duas consequências, e as duas são tratadas adiante:
 * campos de mídia guardam **URL pública** em vez de identificador
 * (`media-reconciliation.ts`), e o que estava despublicado no momento em que o
 * instantâneo foi gerado não está nele — nem a seção, nem o item de lista.
 */

const SNAPSHOT_RELATIVE_PATH = join(
  'apps',
  'lp',
  'src',
  'content',
  'content-snapshot.json',
)

/** O instantâneo, na forma exata em que `GET /api/content` o produziu. */
export interface ContentSnapshot {
  readonly sections: Readonly<Partial<Record<SectionKey, Record<string, unknown>>>>
  /** `null` quando a página ainda não tinha metadados gravados. */
  readonly metadata: Readonly<Record<string, unknown>> | null
}

export class SnapshotError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SnapshotError'
  }
}

/**
 * Procura o instantâneo subindo a partir deste arquivo até a raiz do
 * repositório. Subir em vez de contar níveis fixos mantém o caminho correto
 * tanto rodando de `src/` (testes, com ts-jest) quanto de `dist/` (o comando
 * publicado), sem depender do formato de saída do compilador.
 */
export function defaultSnapshotPath(): string {
  let directory = __dirname
  for (;;) {
    const candidate = resolve(directory, SNAPSHOT_RELATIVE_PATH)
    if (existsSync(candidate)) {
      return candidate
    }
    const parent = dirname(directory)
    if (parent === directory) {
      throw new SnapshotError(
        `Não encontrei ${SNAPSHOT_RELATIVE_PATH} em nenhum diretório acima de ${__dirname}.`,
      )
    }
    directory = parent
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Recusa um instantâneo que a carga não saberia semear, com a mesma severidade
 * com que o gerador recusa gravar um instantâneo vazio: semear nada, ou semear
 * uma chave que não é seção, deixaria o painel em um estado que ninguém pediu.
 */
export function parseContentSnapshot(content: unknown): ContentSnapshot {
  if (!isRecord(content)) {
    throw new SnapshotError('O instantâneo não é um objeto JSON.')
  }

  const { sections, metadata } = content
  if (!isRecord(sections)) {
    throw new SnapshotError('O instantâneo não traz o objeto `sections`.')
  }

  const keys = Object.keys(sections)
  if (keys.length === 0) {
    throw new SnapshotError('O instantâneo não traz nenhuma seção publicada.')
  }

  const unknownKeys = keys.filter((key) => !isSectionKey(key))
  if (unknownKeys.length > 0) {
    throw new SnapshotError(
      `O instantâneo traz seções que não existem no esquema: ${unknownKeys.join(', ')}.`,
    )
  }

  const malformed = keys.filter((key) => !isRecord(sections[key]))
  if (malformed.length > 0) {
    throw new SnapshotError(
      `Estas seções do instantâneo não são documentos: ${malformed.join(', ')}.`,
    )
  }

  if (metadata !== null && metadata !== undefined && !isRecord(metadata)) {
    throw new SnapshotError('O `metadata` do instantâneo não é um documento.')
  }

  return {
    sections: sections as ContentSnapshot['sections'],
    metadata: isRecord(metadata) ? metadata : null,
  }
}

export function loadContentSnapshot(path: string): ContentSnapshot {
  let raw: string
  try {
    raw = readFileSync(path, 'utf8')
  } catch (error) {
    throw new SnapshotError(
      `Não consegui ler o instantâneo em ${path}: ${(error as Error).message}`,
    )
  }

  try {
    return parseContentSnapshot(JSON.parse(raw))
  } catch (error) {
    if (error instanceof SnapshotError) {
      throw error
    }
    throw new SnapshotError(`O instantâneo em ${path} não é JSON válido.`)
  }
}

/** As seções do instantâneo, na ordem em que aparecem na página. */
export function snapshotSectionKeys(snapshot: ContentSnapshot): SectionKey[] {
  return SECTION_KEYS.filter((key) => snapshot.sections[key] !== undefined)
}

/**
 * Cada seção do instantâneo com o seu documento, na ordem da página. Existe
 * para que quem consome não precise reafirmar que a chave tem documento —
 * `parseContentSnapshot` já recusou o instantâneo em que não tivesse.
 */
export function snapshotSections(
  snapshot: ContentSnapshot,
): [SectionKey, Record<string, unknown>][] {
  return snapshotSectionKeys(snapshot).map((key) => [
    key,
    snapshot.sections[key] as Record<string, unknown>,
  ])
}

/**
 * As seções que o instantâneo **não** traz. Estavam despublicadas quando ele
 * foi gerado, e é assim que precisam terminar no CMS semeado.
 */
export function sectionKeysMissingFromSnapshot(snapshot: ContentSnapshot): SectionKey[] {
  return SECTION_KEYS.filter((key) => snapshot.sections[key] === undefined)
}
