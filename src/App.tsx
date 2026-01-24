import React, { useState, useEffect } from 'react';
import ScenarioEditor from './components/ScenarioEditor';
import GameView from './components/GameView';
import Customization from './components/Customization';
import { DEFAULT_SCENARIO } from './data/defaultScenario';

function App() {
  const [mode, setMode] = useState('menu');
  const [scenarios, setScenarios] = useState([]);
  const [currentScenario, setCurrentScenario] = useState(null);

  useEffect(() => {
    try {
      const s = localStorage.getItem('scenarios');
      if (s) {
        setScenarios(JSON.parse(s));
      } else {
        setScenarios([DEFAULT_SCENARIO]);
      }
    } catch (e) {
      console.error("Failed to load scenarios", e);
      setScenarios([DEFAULT_SCENARIO]);
    }
  }, [mode]);

  if (mode === 'editor') return <ScenarioEditor onBack={() => setMode('menu')} />;
  if (mode === 'custom') return <Customization onBack={() => setMode('menu')} />;
  if (mode === 'game' && currentScenario) return <GameView scenario={currentScenario} onExit={() => setMode('menu')} />;

  return (
    <div className="min-h-screen bg-map-paper flex flex-col items-center justify-center p-4 font-military">
      <div className="max-w-md w-full bg-white/80 p-8 rounded shadow-xl border-2 border-map-ink-blue">
        <h1 className="text-3xl font-bold text-map-ink-blue mb-8 text-center font-handwriting uppercase tracking-wider">Memoir '44 Clone</h1>
        <div className="space-y-4">
          <button
            onClick={() => setMode('editor')}
            className="w-full bg-map-ink-blue text-white py-3 rounded font-bold uppercase hover:bg-opacity-90 transition-all shadow-md"
          >
            Nový scénář
          </button>
          <button
            onClick={() => setMode('custom')}
            className="w-full border-2 border-map-ink-blue text-map-ink-blue py-3 rounded font-bold uppercase hover:bg-white transition-all shadow-sm"
          >
            Nastavení
          </button>
          <div className="pt-4 border-t border-map-ink-blue">
            <h2 className="text-sm font-bold mb-2 uppercase text-map-ink-blue tracking-tighter">Uložené operace:</h2>
            <div className="space-y-2 max-h-48 overflow-y-auto mt-2 pr-1">
              {scenarios.map(s => (
                <div key={s.id} className="flex justify-between items-center p-2 border rounded bg-white text-xs shadow-sm border-gray-200">
                  <span className="font-bold uppercase text-map-ink-blue">{s.name}</span>
                  <button
                    onClick={() => { setCurrentScenario(s); setMode('game'); }}
                    className="bg-map-ink-green text-white px-3 py-1 rounded font-bold uppercase hover:bg-opacity-90 transition-transform active:scale-95"
                  >
                    Hrát
                  </button>
                </div>
              ))}
              {scenarios.length === 0 && <p className="text-[10px] text-gray-500 italic">Žádné uložené plány.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
