/**
 * Paleta de cor da identidade visual Veggiedent.
 *
 * Fonte: `apps/lp/tailwind.config.ts` (Design System v1.2, seções 4-6) — os
 * valores hex abaixo são os mesmos de lá, extraídos aqui como o lugar
 * compartilhado por `apps/lp` e `apps/admin` (T35, item 1), para que nenhum
 * dos dois apps precise repetir um valor hex que o outro já declara (regra
 * G5).
 *
 * `apps/lp/tailwind.config.ts` continua com sua cópia literal destes mesmos
 * valores: a LP está fora do escopo de alteração desta tarefa (só pode ser
 * lida, nunca editada — ver `agent_context/PLAN.md`, T35), então ela não foi
 * migrada para importar deste pacote. Este arquivo é a fonte nova que
 * `apps/admin/tailwind.config.ts` passa a consumir; se a paleta da LP mudar no
 * futuro, quem alterar `apps/lp/tailwind.config.ts` precisa atualizar este
 * arquivo também — limitação aceita e declarada, não um descuido.
 */
export const brandColors = {
  primary: '#27B6AD',
  'primary-alt': '#46C1C3',
  // Uso obrigatório em texto grande sobre branco (contraste) — nunca `primary` puro.
  'primary-hover': '#1E8F88',
  secondary: '#B08968',
} as const

export const inkColors = {
  900: '#1B1B18',
  700: '#3A3A35',
  400: '#6E6E66',
} as const

export const surfaceColors = {
  canvas: '#FBF8F3',
  card: '#FFFFFF',
  'section-alt': '#F1ECE3',
} as const
