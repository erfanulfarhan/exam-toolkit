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
        bg: '#0a0b10', card: '#12141c', line: '#232634',
        ink: '#eef1f8', muted: '#9aa3b8',
        brand: { DEFAULT: '#4f8cff', 2: '#22d3ee', 3: '#7c6cff' },
        good: '#34d399', warn: '#fbbf24', bad: '#f87171',
      },
      borderRadius: { xl: '1rem', '2xl': '1.35rem' },
    },
  },
  plugins: [],
}
