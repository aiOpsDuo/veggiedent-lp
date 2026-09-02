import type { SectionKey, SectionSchema } from '../contract'
import { SECTION_KEYS } from '../contract'
import { headerSchema } from './header'
import { heroSchema } from './hero'
import { educacaoSchema } from './educacao'
import { rotinaSchema } from './rotina'
import { produtoSchema } from './produto'
import { demonstracaoSchema } from './demonstracao'
import { ingredientesSchema } from './ingredientes'
import { provaAutoridadeSchema } from './prova-autoridade'
import { capturaLeadSchema } from './captura-lead'
import { ondeComprarSchema } from './onde-comprar'
import { faqSchema } from './faq'
import { footerSchema } from './footer'

export {
  headerSchema,
  heroSchema,
  educacaoSchema,
  rotinaSchema,
  produtoSchema,
  demonstracaoSchema,
  ingredientesSchema,
  provaAutoridadeSchema,
  capturaLeadSchema,
  ondeComprarSchema,
  faqSchema,
  footerSchema,
}

export const sectionSchemas = {
  header: headerSchema,
  hero: heroSchema,
  educacao: educacaoSchema,
  rotina: rotinaSchema,
  produto: produtoSchema,
  demonstracao: demonstracaoSchema,
  ingredientes: ingredientesSchema,
  prova_autoridade: provaAutoridadeSchema,
  captura_lead: capturaLeadSchema,
  onde_comprar: ondeComprarSchema,
  faq: faqSchema,
  footer: footerSchema,
} as const satisfies Record<SectionKey, SectionSchema>

export type SectionSchemas = typeof sectionSchemas

/** As 12 seções na ordem em que aparecem na página. */
export const orderedSectionSchemas: readonly SectionSchema[] = SECTION_KEYS.map((key) => sectionSchemas[key])

export function getSectionSchema(key: SectionKey): SectionSchema {
  return sectionSchemas[key]
}
