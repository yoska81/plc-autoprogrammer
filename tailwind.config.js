/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // Brand palette: bright blue #0d6efd for actions and selection (white text on it),
      // deep blue 800–950 for brand-coloured text.
      colors: {
        brand: {
          50: '#eef4ff',
          100: '#dce8fe',
          200: '#bcd3fd',
          300: '#8fb6fb',
          400: '#5a93f8',
          500: '#2f7bf5',
          600: '#0d6efd',
          700: '#0b5ed7',
          800: '#0a52c0',
          900: '#0a3f8f',
          950: '#0b2a5c',
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
      // Near-square corners, like Siemens engineering tools.
      borderRadius: { sm: '1px', DEFAULT: '2px', md: '2px', lg: '3px', xl: '4px', '2xl': '4px' },
      fontFamily: {
        // Desktop engineering-tool look: the Windows UI font, Arial fallback.
        sans: ['"Segoe UI"', 'Arial', 'Helvetica', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
