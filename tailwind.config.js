/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // --- Legacy tokens, remapped onto the new "Generální štáb" palette so
        // any untouched class names still land on the right colours. ---
        'map-paper': '#efe4c9',
        'map-ink-blue': '#1c3f6b',
        'map-ink-red': '#7c2018',
        'map-ink-green': '#2c7d42',
        // --- New design system ---
        parchment: '#efe4c9',
        'parchment-card': '#fffdf7',
        ink: '#16202e',
        // Allies (Spojenci)
        ally: '#1c3f6b',
        'ally-soft': '#2f6db0',
        // Axis (Osa)
        axis: '#7c2018',
        'axis-soft': '#a3382b',
        danger: '#c0392b',
        // Action / local game
        army: '#2c7d42',
        'army-soft': '#3aa657',
        // Accents
        gold: '#f5c518',
        'gold-soft': '#ffce4a',
        // Muted parchment tans (labels, borders, captions)
        tan: '#a08f63',
        'tan-deep': '#8a7a52',
        'tan-text': '#6b6450',
        'tan-border': '#e0d4af',
        'tan-border-soft': '#d3c39c',
        'tan-line': '#d8cba6',
      },
      fontFamily: {
        // Condensed military display face for headings & labels
        'handwriting': ['"Barlow Condensed"', 'sans-serif'],
        'condensed': ['"Barlow Condensed"', 'sans-serif'],
        // Body / UI face
        'military': ['"Barlow"', 'sans-serif'],
        'sans': ['"Barlow"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
