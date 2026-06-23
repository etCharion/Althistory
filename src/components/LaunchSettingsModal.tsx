import React, { useState } from 'react';
import { Settings, Play, X } from 'lucide-react';

export type LaunchSettings = { logisticsLimit: boolean };

type Props = {
  scenarioName: string;
  // Popisek režimu (např. „Místní hra" / „Online hra").
  modeLabel: string;
  onConfirm: (settings: LaunchSettings) => void;
  onCancel: () => void;
};

// Nastavení zobrazené při spuštění hry – volby pravidel, které platí pro celou
// partii (a u online her se uloží do sdíleného stavu). Záměrně neutrální styl,
// aby seděl do obou motivů (Polní mapa i Klasický).
export default function LaunchSettingsModal({ scenarioName, modeLabel, onConfirm, onCancel }: Props) {
  const [logisticsLimit, setLogisticsLimit] = useState(false);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-6"
      style={{ background: 'rgba(20,28,40,.6)', backdropFilter: 'blur(4px)' }}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border-2 border-slate-800 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 bg-slate-800 text-white flex items-center justify-between">
          <h3 className="font-bold text-lg uppercase tracking-wide flex items-center gap-2">
            <Settings size={20} /> Nastavení hry
          </h3>
          <button onClick={onCancel} className="hover:opacity-70 transition-opacity" aria-label="Zavřít">
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-5">
          <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">{modeLabel}</div>
          <div className="text-base font-bold text-slate-800 mb-5">{scenarioName}</div>

          <label className="flex items-start gap-3 cursor-pointer select-none p-3 rounded-xl border-2 border-slate-200 hover:border-slate-400 transition-colors">
            <input
              type="checkbox"
              className="mt-1 w-5 h-5 accent-slate-800 flex-shrink-0"
              checked={logisticsLimit}
              onChange={(e) => setLogisticsLimit(e.target.checked)}
            />
            <span>
              <span className="block font-bold text-slate-800 uppercase text-sm tracking-wide">Logistické omezení</span>
              <span className="block text-xs text-slate-600 leading-relaxed mt-1">
                Každý zdroj přidělený do sekce, která už má 4 přidělené zdroje, stojí ze skladu 2 zdroje místo 1.
                Nadlimitní zdroje jsou barevně odlišené.
              </span>
            </span>
          </label>
        </div>

        <div className="px-6 py-4 bg-slate-50 flex justify-end gap-3 border-t border-slate-200">
          <button
            onClick={onCancel}
            className="px-5 py-2.5 rounded-lg font-bold uppercase text-sm text-slate-600 hover:bg-slate-200 transition-colors"
          >
            Zrušit
          </button>
          <button
            onClick={() => onConfirm({ logisticsLimit })}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-slate-800 text-white font-bold uppercase text-sm hover:bg-slate-700 transition-colors"
          >
            <Play size={16} fill="currentColor" strokeWidth={0} /> Zahájit
          </button>
        </div>
      </div>
    </div>
  );
}
