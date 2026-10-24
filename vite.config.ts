import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { svg2pdfFastMeasure } from './vite.svg2pdf'
import { readFileSync } from 'node:fs'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), svg2pdfFastMeasure()],
  define: { __APP_VERSION__: JSON.stringify(version) },
})
