import type { Config } from 'tailwindcss'
import { brandColors, inkColors, surfaceColors } from '@veggiedent/design-tokens'

/**
 * A identidade visual do painel é a mesma da LP (T35, item 1; PRD § "Notas de
 * design", revisão de 2026-09-04) — a decisão anterior de manter uma paleta
 * própria, mínima, está revertida. As cores vêm de `@veggiedent/design-tokens`
 * (não copiadas à mão de `apps/lp/tailwind.config.ts`): é o pacote pequeno e
 * compartilhado que evita duas fontes do mesmo valor hex (regra G5) — ver o
 * comentário em `packages/design-tokens/src/colors.ts` para a única exceção
 * declarada (a própria LP, fora do escopo de edição desta tarefa).
 *
 * `darkMode: 'class'` (T35, item 4) liga o tema escuro a uma classe no `<html>`
 * em vez da preferência do sistema sozinha — é o que permite ao operador
 * escolher e ao painel lembrar essa escolha (ver `src/theme/theme-context.tsx`).
 * Nenhuma cor de superfície/texto de tema escuro vem daqui: a LP não tem
 * paleta escura, então o painel usa a escala neutra do próprio Tailwind
 * (`slate`) para isso, e os tokens de marca só como acento — em claro e em
 * escuro.
 */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: brandColors,
        ink: inkColors,
        surface: surfaceColors,
      },
      // Entrada suave de cartões e campos (T35, item 6) — utilidade do
      // próprio Tailwind, sem biblioteca de animação nova.
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(0.5rem)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.3s ease-out',
      },
    },
  },
  plugins: [],
} satisfies Config
