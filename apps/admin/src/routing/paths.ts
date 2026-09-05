import type { SectionKey } from '@veggiedent/content-schema'

/**
 * Caminhos do painel, dentro da base `/admin/` declarada no `vite.config.ts`.
 * Ficam nomeados em um lugar só para que a guarda, a tela de login e o menu não
 * repitam a mesma string (regra G25).
 */
export const LOGIN_PATH = '/login'
export const HOME_PATH = '/'
export const SECTIONS_PATH = '/secoes'
export const METADATA_PATH = '/metadados'
export const LEADS_PATH = '/leads'
export const OPERATORS_PATH = '/operadores'

/** Padrão de rota da tela de edição, e o caminho de uma seção concreta. */
export const SECTION_EDITOR_ROUTE = `${SECTIONS_PATH}/:key`

export function sectionPath(key: SectionKey): string {
  return `${SECTIONS_PATH}/${key}`
}
