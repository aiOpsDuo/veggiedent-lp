import type { Config } from 'tailwindcss'

/**
 * O painel é ferramenta interna: o SDD § D-02 prioriza clareza sobre
 * sofisticação visual. Por isso a configuração fica no padrão do Tailwind, com
 * uma única extensão — a cor da marca, para que o painel seja reconhecível como
 * parte do produto. Os tokens do Design System da LP não são copiados para cá:
 * duplicá-los criaria duas fontes da mesma verdade (regra G5).
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#27B6AD',
          hover: '#1E8F88',
        },
      },
    },
  },
  plugins: [],
} satisfies Config
