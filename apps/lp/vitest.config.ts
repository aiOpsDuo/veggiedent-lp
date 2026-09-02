import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

// Reaproveita a configuracao de build (plugin React, resolucao de assets) para
// que um teste enxergue o mesmo modulo que a pagina enxerga em producao.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      include: ['src/**/*.test.{ts,tsx}'],
    },
  }),
)
