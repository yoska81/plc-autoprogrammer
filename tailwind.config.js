/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // Brand palette: lime accent #EAFF46 for actions and selection (dark text on it),
      // graphite-olive 800–950 for the title/status bars and for brand-coloured text.
      colors: {
        brand: {
          50: '#fbffe6',
          100: '#f5ffc4',
          200: '#ecff94',
          300: '#e1f866',
          400: '#cfe83a',
          500: '#b3cc1c',
          600: '#eaff46',
          700: '#d6ef2c',
          800: '#3b4011',
          900: '#24270b',
          950: '#15170a',
        },
        // Tailwind's gray/slate-400 (2.5:1 on white) made hint text hard to read.
        gray: { 400: '#7d8590' },
        slate: { 400: '#7b8898' },
        steel: {
          50: '#f5f7f8',
          100: '#e9edef',
          200: '#d4dbdf',
          300: '#b3bec4',
          400: '#788891', // hint text: ≥3.4:1 on white and steel-50
          500: '#6b7c85',
          600: '#55646c',
          700: '#454f56',
          800: '#2f373c',
          900: '#1d2327',
        },
      },
      fontFamily: {
        // Desktop engineering-tool look: the Windows UI font, Arial fallback.
        sans: ['"Segoe UI"', 'Arial', 'Helvetica', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
