import type { SectionKey, SectionSchema } from '../contract'
import { SECTION_KEYS } from '../contract'
import { heroSchema } from './hero'
import { educacaoSchema } from './educacao'
import { rotinaSchema } from './rotina'
import { produtoSchema } from './produto'
import { demonstracaoSchema } from './demonstracao'
import { provaAutoridadeSchema } from './prova-autoridade'
import { capturaLeadSchema, OPCAO_SIM, PORTE_OPTIONS, SIM_NAO_OPTIONS } from './captura-lead'
import { ondeComprarSchema } from './onde-comprar'
import { faqSchema } from './faq'

export { OPCAO_SIM, PORTE_OPTIONS, SIM_NAO_OPTIONS }

export {
  heroSchema,
  educacaoSchema,
  rotinaSchema,
  produtoSchema,
  demonstracaoSchema,
  provaAutoridadeSchema,
  capturaLeadSchema,
  ondeComprarSchema,
  faqSchema,
}

export const sectionSchemas = {
  hero: heroSchema,
  educacao: educacaoSchema,
  rotina: rotinaSchema,
  produto: produtoSchema,
  demonstracao: demonstracaoSchema,
  prova_autoridade: provaAutoridadeSchema,
  captura_lead: capturaLeadSchema,
  onde_comprar: ondeComprarSchema,
  faq: faqSchema,
} as const satisfies Record<SectionKey, SectionSchema>

export type SectionSchemas = typeof sectionSchemas

/** As 9 seções na ordem em que aparecem na página. */
export const orderedSectionSchemas: readonly SectionSchema[] = SECTION_KEYS.map((key) => sectionSchemas[key])

export function getSectionSchema(key: SectionKey): SectionSchema {
  return sectionSchemas[key]
}
