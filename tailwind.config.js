/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Lush forest. The ground is a shade below the palette's darkest so
        // cards lift off it, and the pale mint carries body text at a weight
        // that stays readable on green rather than glaring.
        bg: '#141f18', card: '#1c2c21', line: '#2f4a37',
        ink: '#e8fbee', muted: '#9dbfa8',
        brand: { DEFAULT: '#68BA7F', 2: '#CFFFDC', 3: '#2E6F40' },
        forest: { deep: '#253D2C', dark: '#2E6F40', mid: '#68BA7F', light: '#CFFFDC' },
        good: '#68BA7F', warn: '#e3c770', bad: '#e88a8a',
      },
      borderRadius: { xl: '1rem', '2xl': '1.35rem' },
    },
  },
  plugins: [],
}
