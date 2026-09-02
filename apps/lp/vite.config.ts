import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Build estático (SPA) — ver Especificação Funcional, seção 2.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
})
