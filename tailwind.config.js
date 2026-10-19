/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // Brand palette: the red accent. 600 #d32f2f carries white text (4.98:1) on primary buttons and
      // selections; 700 is its hover; 800–950 for brand-coloured text.
      // Faults and errors keep Tailwind's red with an icon or words, never this colour alone.
      colors: {
        brand: {
          50: '#fdf2f2',
          100: '#fbe2e1',
          200: '#f5c2c0',
          300: '#ee9491',
          400: '#e8625e',
          500: '#e53935',
          600: '#d32f2f',
          700: '#b42626',
          800: '#9a1f1f',
          900: '#7c1a1a',
          950: '#4a0f0f',
        },
        // The app shell: title, menu and tool bars, project navigation and status bar.
        shell: {
          600: '#3a4045',
          700: '#2b2f33',
          800: '#25292c',
          900: '#1f2326',
          950: '#1a1d20',
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
