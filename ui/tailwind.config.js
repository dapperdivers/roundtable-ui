/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        roundtable: {
          gold: '#D4AF37',
          crimson: '#DC143C',
          navy: '#0A1628',
          slate: '#1E293B',
          steel: '#334155',
        },
      },
    },
  },
  plugins: [],
}
