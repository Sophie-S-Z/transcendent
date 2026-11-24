import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  // WebLLM is one lazy chunk of about 6 MB. It loads only in Tier 1 mode.
  build: { chunkSizeWarningLimit: 7000 },
  test: { environment: 'node' },
})
