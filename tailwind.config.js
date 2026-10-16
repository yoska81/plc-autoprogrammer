/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // Brand palette built around the blue of the Israeli flag (#0038B8 = 600), cool greys.
      colors: {
        brand: {
          50: '#eef3fc',
          100: '#d6e2f8',
          200: '#adc4f0',
          300: '#7a9ee5',
          400: '#4673d6',
          500: '#1a4fc6',
          600: '#0038b8',
          700: '#002f9a',
          800: '#00267b',
          900: '#001c5c',
          950: '#00123d',
        },
        steel: {
          50: '#f5f7f8',
          100: '#e9edef',
          200: '#d4dbdf',
          300: '#b3bec4',
          400: '#8a9aa2',
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
