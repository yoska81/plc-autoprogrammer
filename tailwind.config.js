/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // Industrial configurator palette: petrol/teal primary, cool greys.
      colors: {
        petrol: {
          50: '#eef8f8',
          100: '#d3eeee',
          200: '#a7dcdc',
          300: '#6fc3c4',
          400: '#2ea6a8',
          500: '#008c8f',
          600: '#007376',
          700: '#005c60',
          800: '#00454a',
          900: '#002e33',
          950: '#001d21',
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
        sans: ['"IBM Plex Sans"', 'system-ui', '"Segoe UI"', 'Roboto', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
