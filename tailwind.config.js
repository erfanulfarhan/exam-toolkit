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
        // Cobalt sky. Navy is the ground rather than an accent, so cobalt and
        // the pale sky read as light against it; the slate carries secondary
        // text without competing with either.
        bg: '#0a1020', card: '#121c38', line: '#273a63',
        ink: '#eaf3fb', muted: '#8fa3bf',
        brand: { DEFAULT: '#0047AB', 2: '#82C8E5', 3: '#000080' },
        cobalt: { navy: '#000080', deep: '#0047AB', sky: '#82C8E5', slate: '#6D8196' },
        good: '#82C8E5', warn: '#e0b978', bad: '#e88a8a',
      },
      borderRadius: { xl: '1rem', '2xl': '1.35rem' },
    },
  },
  plugins: [],
}
