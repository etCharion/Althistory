/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // --- Theme-aware tokens (driven by CSS variables in index.css). These
        // flip between the "field" (new) and "classic" (original) palettes
        // depending on the [data-ui-theme] attribute on <html>. ---
        'map-paper': 'rgb(var(--color-map-paper) / <alpha-value>)',
        'map-ink-blue': 'rgb(var(--color-map-ink-blue) / <alpha-value>)',
        'map-ink-red': 'rgb(var(--color-map-ink-red) / <alpha-value>)',
        'map-ink-green': 'rgb(var(--color-map-ink-green) / <alpha-value>)',
        // --- New "field map" design system (static; used only by the new look) ---
        parchment: '#efe4c9',
        'parchment-card': '#fffdf7',
        ink: '#16202e',
        ally: '#1c3f6b',
        'ally-soft': '#2f6db0',
        axis: '#7c2018',
        'axis-soft': '#a3382b',
        danger: '#c0392b',
        army: '#2c7d42',
        'army-soft': '#3aa657',
        gold: '#f5c518',
        'gold-soft': '#ffce4a',
        tan: '#a08f63',
        'tan-deep': '#8a7a52',
        'tan-text': '#6b6450',
        'tan-border': '#e0d4af',
        'tan-border-soft': '#d3c39c',
        'tan-line': '#d8cba6',
      },
      fontFamily: {
        // Theme-aware display / body faces (CSS variables flip per theme).
        'handwriting': ['var(--font-display)'],
        'military': ['var(--font-body)'],
        // Static faces used by the new look.
        'condensed': ['"Barlow Condensed"', 'sans-serif'],
        'sans': ['"Barlow"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
