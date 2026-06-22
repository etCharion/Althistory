import React, { createContext, useContext, useEffect, useState } from 'react';

export type UITheme = 'field' | 'classic';

type ThemeCtx = { theme: UITheme; setTheme: (t: UITheme) => void; toggle: () => void };
const ThemeContext = createContext<ThemeCtx>({ theme: 'field', setTheme: () => {}, toggle: () => {} });

const STORAGE_KEY = 'uiTheme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<UITheme>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved === 'classic' || saved === 'field' ? saved : 'field';
    } catch { return 'field'; }
  });

  const setTheme = (t: UITheme) => {
    setThemeState(t);
    try { localStorage.setItem(STORAGE_KEY, t); } catch { /* ignore */ }
  };

  // Drive the CSS variables (palette + fonts + background) via a root attribute.
  useEffect(() => { document.documentElement.setAttribute('data-ui-theme', theme); }, [theme]);

  const toggle = () => setTheme(theme === 'field' ? 'classic' : 'field');

  return <ThemeContext.Provider value={{ theme, setTheme, toggle }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);

// Small segmented switch used in the menu headers to flip between the new
// "Polní mapa" look and the original "Klasický" look.
export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const opt = (val: UITheme, label: string) => (
    <button
      type="button"
      onClick={() => setTheme(val)}
      className={`px-3 py-1.5 rounded-md text-[12px] font-bold uppercase tracking-wide transition-colors ${theme === val ? 'bg-map-ink-blue text-white shadow' : 'text-map-ink-blue hover:bg-black/5'}`}
    >
      {label}
    </button>
  );
  return (
    <div className={`inline-flex items-center gap-1 p-1 rounded-lg border-2 border-map-ink-blue/30 bg-white/70 backdrop-blur-sm ${className}`} title="Přepnout vzhled aplikace">
      {opt('field', 'Polní mapa')}
      {opt('classic', 'Klasický')}
    </div>
  );
}
