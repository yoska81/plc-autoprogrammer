/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // Brand palette: the Israeli-flag blue hue (#0038B8), softened for long screen use; cool greys.
      colors: {
        brand: {
          50: '#f0f4fa',
          100: '#dde5f4',
          200: '#b9c8e8',
          300: '#88a0d4',
          400: '#5677c0',
          500: '#2f56a8',
          600: '#22448c',
          700: '#1c3873',
          800: '#172e5d',
          900: '#122449',
          950: '#0b1730',
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
