import { rmSync } from 'node:fs'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The desktop app reuses the web app's public folder for the MediaPipe files and the face model.
// The build removes the demo sites, because the app does not use them.
export default defineConfig({
  root: import.meta.dirname,
  base: './',
  publicDir: '../public',
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'drop-demo-sites',
      writeBundle: ({ dir }) => rmSync(`${dir}/demo-sites`, { recursive: true, force: true }),
    },
  ],
  build: { outDir: 'dist', emptyOutDir: true },
})
