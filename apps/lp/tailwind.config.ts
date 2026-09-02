import type { Config } from 'tailwindcss'

// Tokens extraidos do Design System v1.2, secoes 4-6.
// Espacamento: mantido o padrao do Tailwind (1 unidade = 4px), que ja bate
// com a escala de 8px do Design System (space.3=16px -> p-4, space.4=24px -> p-6,
// space.5=32px -> p-8, space.6=48px -> py-12, space.7=64px -> py-16, space.8=96px -> py-24).
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    screens: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
      '3xl': '1920px',
    },
    extend: {
      colors: {
        brand: {
          primary: '#27B6AD', // extraido de Veggiedent-Fresh-EDC_logo.svg (logo oficial confirmado v1.2)
          'primary-alt': '#46C1C3',
          'primary-hover': '#1E8F88', // uso obrigatorio em texto grande sobre branco (contraste), nunca brand.primary puro
          secondary: '#B08968', // [A VALIDAR contra assets da nova campanha]
        },
        ink: {
          900: '#1B1B18',
          700: '#3A3A35',
          400: '#6E6E66',
        },
        surface: {
          canvas: '#FBF8F3',
          card: '#FFFFFF',
          'section-alt': '#F1ECE3',
        },
        feedback: {
          success: '#27B6AD',
          error: '#B3261E',
          focus: '#1A73E8',
        },
        claim: {
          gold: '#C9A227', // [A VALIDAR] selo oficial N.1, se existir arte pronta
        },
      },
      fontFamily: {
        sans: ['Manjari', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        // Inter: exclusivo para elementos de ação (botões, labels de formulário).
        // Métricas mais previsíveis que Manjari em tamanhos pequenos/médios.
        ui: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      maxWidth: {
        content: '1200px',
      },
    },
  },
  plugins: [],
} satisfies Config
