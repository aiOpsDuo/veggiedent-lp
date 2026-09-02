/**
 * Leitura dos arquivos `*.content.ts` que hoje guardam o conteúdo da LP.
 *
 * Os arquivos importam imagens e vídeos, então não podem ser executados aqui:
 * o que interessa ao teste de cobertura são os caminhos de chave que eles
 * declaram, e esses são extraídos do texto do arquivo.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { SectionKey } from '../src/contract'

const testsDir = dirname(fileURLToPath(import.meta.url))
const lpSourceDir = resolve(testsDir, '../../../apps/lp/src')

export const CONTENT_FILE_BY_SECTION: Record<SectionKey, string> = {
  header: 'components/layout/Header/Header.content.ts',
  hero: 'sections/Hero/Hero.content.ts',
  educacao: 'sections/Educacao/Educacao.content.ts',
  rotina: 'sections/RotinaCuidado/RotinaCuidado.content.ts',
  produto: 'sections/Produto/Produto.content.ts',
  demonstracao: 'sections/Demonstracao/Demonstracao.content.ts',
  ingredientes: 'sections/Ingredientes/Ingredientes.content.ts',
  prova_autoridade: 'sections/ProvaAutoridade/ProvaAutoridade.content.ts',
  captura_lead: 'sections/CapturaLead/CapturaLead.content.ts',
  onde_comprar: 'sections/OndeComprar/OndeComprar.content.ts',
  faq: 'sections/Faq/Faq.content.ts',
  footer: 'components/layout/Footer/Footer.content.ts',
}

const KEY_PATTERN = /([A-Za-z_$][\w$]*)\s*:\s*([^,]*)/g
const COMMENT_LINE = /^\s*(\/\/|\/\*|\*)/
const IMPORT_OR_EXPORT_LINE = /^\s*(import|export)\b/
const STRING_LITERAL = /'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g

interface KeyOnLine {
  readonly key: string
  readonly opensBlock: boolean
}

function stripNoise(rawLine: string): string {
  return rawLine.replace(STRING_LITERAL, '""').replace(/\/\/.*$/, '')
}

function findKeys(line: string): KeyOnLine[] {
  const found: KeyOnLine[] = []
  for (const match of line.matchAll(KEY_PATTERN)) {
    const value = match[2].trim()
    found.push({ key: match[1], opensBlock: value.startsWith('{') || value.startsWith('[') })
  }
  return found
}

function countUnclosed(line: string): number {
  const opened = (line.match(/[{[]/g) ?? []).length
  const closed = (line.match(/[}\]]/g) ?? []).length
  return opened - closed
}

/**
 * Extrai os caminhos de chave declarados no arquivo (ex.: `banner.headline`,
 * `videos.captionsSrc`). Índices de array são ignorados: interessa o conjunto
 * de campos, não quantos itens existem.
 */
export function extractContentKeyPaths(fileContent: string): Set<string> {
  const paths = new Set<string>()
  const openPath: string[] = []
  const depthWhenOpened: number[] = []
  let depth = 0

  for (const rawLine of fileContent.split('\n')) {
    const line = stripNoise(rawLine)
    const isIgnoredLine = COMMENT_LINE.test(rawLine) || IMPORT_OR_EXPORT_LINE.test(rawLine)

    if (!isIgnoredLine) {
      const keys = findKeys(line)
      for (const { key } of keys) paths.add([...openPath, key].join('.'))

      const opener = [...keys].reverse().find((entry) => entry.opensBlock)
      const unclosed = countUnclosed(line)
      if (opener && unclosed > 0) {
        openPath.push(opener.key)
        depthWhenOpened.push(depth)
      }
    }

    depth += countUnclosed(line)
    while (depthWhenOpened.length > 0 && depth <= depthWhenOpened[depthWhenOpened.length - 1]) {
      depthWhenOpened.pop()
      openPath.pop()
    }
  }

  return paths
}

export function readContentKeyPaths(section: SectionKey): Set<string> {
  const file = resolve(lpSourceDir, CONTENT_FILE_BY_SECTION[section])
  return extractContentKeyPaths(readFileSync(file, 'utf8'))
}
