import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { build, defineConfig, type Plugin } from 'vite'

// Run from the repository root: npm run build:extension. Load extension/dist as an unpacked extension.
const root = 'extension'

const manifest = {
  manifest_version: 3,
  name: 'Transcendent',
  version: '0.1.0',
  description: 'Use web pages with one signal: a held blink or any key. The camera and the page stay on this laptop.',
  action: { default_title: 'Open Transcendent' },
  background: { service_worker: 'background.js', type: 'module' },
  side_panel: { default_path: 'sidepanel.html' },
  permissions: ['activeTab', 'scripting', 'sidePanel', 'storage'],
  optional_host_permissions: ['http://*/*', 'https://*/*'],
  // MediaPipe runs WebAssembly.
  content_security_policy: { extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'" },
}

// Writes the manifest, and builds the content script as one classic script, because executeScript cannot load modules.
const extension: Plugin = {
  name: 'extension',
  apply: 'build',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'manifest.json', source: JSON.stringify(manifest, null, 2) })
  },
  async closeBundle() {
    await build({
      configFile: false,
      root,
      logLevel: 'warn',
      build: {
        outDir: 'dist',
        emptyOutDir: false,
        copyPublicDir: false,
        lib: { entry: 'content.ts', formats: ['iife'], name: 'transcendent', fileName: () => 'content.js' },
      },
    })
  },
}

// The public folder gives the MediaPipe files and the face model. The demo sites come with it, and the extension does not use them.
export default defineConfig({
  root,
  base: '/',
  publicDir: '../public',
  plugins: [react(), tailwindcss(), extension],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: { sidepanel: `${root}/sidepanel.html`, permission: `${root}/permission.html`, background: `${root}/background.ts` },
      output: { entryFileNames: (c) => (c.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js') },
    },
  },
})
