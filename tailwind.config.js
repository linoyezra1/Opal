/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        medical: {
          blue: {
            DEFAULT: '#0ea5e9',
            dark: '#0284c7',
            light: '#38bdf8',
          },
          teal: {
            DEFAULT: '#0d9488',
            dark: '#0f766e',
            light: '#14b8a6',
          },
          grey: {
            DEFAULT: '#64748b',
            light: '#94a3b8',
            dark: '#475569',
          },
        },
      },
      fontFamily: {
        sans: ['Heebo', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
