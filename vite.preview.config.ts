import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Single-file build for the Claude side-panel preview (VITE_PREVIEW=1).
const drawingSet = fileURLToPath(new URL('./src/electrical/drawings/DrawingSet.tsx', import.meta.url))
const stub = fileURLToPath(new URL('./src/preview/DrawingSetStub.tsx', import.meta.url))

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  resolve: {
    alias: existsSync(drawingSet) ? [] : [{ find: /^.*\/electrical\/drawings\/DrawingSet$/, replacement: stub }],
  },
  build: { outDir: 'dist-preview' },
})
