import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { svg2pdfFastMeasure } from './vite.svg2pdf'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Single-file build for the Claude side-panel preview (VITE_PREVIEW=1).
const drawingSet = fileURLToPath(new URL('./src/electrical/drawings/DrawingSet.tsx', import.meta.url))
const stub = fileURLToPath(new URL('./src/preview/DrawingSetStub.tsx', import.meta.url))

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

export default defineConfig({
  plugins: [react(), svg2pdfFastMeasure(), viteSingleFile()],
  define: { __APP_VERSION__: JSON.stringify(version) },
  resolve: {
    alias: existsSync(drawingSet) ? [] : [{ find: /^.*\/electrical\/drawings\/DrawingSet$/, replacement: stub }],
  },
  build: { outDir: 'dist-preview' },
})
