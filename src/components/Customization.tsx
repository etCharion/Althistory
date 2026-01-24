import React, { useState, useEffect } from 'react'; import { DEFAULT_UNIT_TYPES, DEFAULT_TERRAIN_TYPES } from '../data/defaults';
const Customization = ({ onBack }) => {
  const [units, setUnits] = useState([]); const [terrains, setTerrains] = useState([]);
  useEffect(() => { const u = localStorage.getItem('customUnitTypes'); const t = localStorage.getItem('customTerrainTypes'); setUnits(u ? JSON.parse(u) : DEFAULT_UNIT_TYPES); setTerrains(t ? JSON.parse(t) : DEFAULT_TERRAIN_TYPES); }, []);
  const saveU = (val) => { setUnits(val); localStorage.setItem('customUnitTypes', JSON.stringify(val)); };
  const saveT = (val) => { setTerrains(val); localStorage.setItem('customTerrainTypes', JSON.stringify(val)); };
  return (
    <div className="min-h-screen bg-map-paper p-8 font-military">
      <div className="max-w-4xl mx-auto bg-white/80 p-8 rounded border border-map-ink-blue">
        <div className="flex justify-between items-center mb-8"><h1 className="text-3xl font-bold font-handwriting">Vlastní typy</h1><button onClick={onBack} className="bg-gray-500 text-white px-4 py-2 rounded uppercase font-bold text-xs">Zpět</button></div>
        <div className="grid grid-cols-2 gap-8">
          <section><h2 className="text-xl font-bold mb-4 uppercase text-sm">Jednotky</h2>{units.map(u => <div key={u.id} className="p-2 border mb-2 bg-white text-xs"><input className="w-full font-bold mb-1" value={u.name} onChange={e => { const n = [...units]; n.find(x => x.id === u.id).name = e.target.value; saveU(n); }} /><p>Pohyb: {u.movement}</p></div>)}</section>
          <section><h2 className="text-xl font-bold mb-4 uppercase text-sm">Terén</h2>{terrains.map(t => <div key={t.id} className="p-2 border mb-2 bg-white text-xs"><input className="w-full font-bold mb-1" value={t.name} onChange={e => { const n = [...terrains]; n.find(x => x.id === t.id).name = e.target.value; saveT(n); }} /><p>Obrana: {t.diceModifierDefense}</p></div>)}</section>
        </div>
      </div>
    </div>
  );
};
export default Customization;
