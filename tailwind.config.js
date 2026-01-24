/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        'map-paper': '#f4e4bc',
        'map-ink-blue': '#1a3a5f',
        'map-ink-red': '#8b0000',
        'map-ink-green': '#006400',
      },
      fontFamily: {
        'handwriting': ['"Permanent Marker"', 'cursive'],
        'military': ['"Courier Prime"', 'monospace'],
      },
    },
  },
  plugins: [],
}
