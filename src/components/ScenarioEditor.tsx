import React, { useState, useEffect } from 'react'; import { getAllTerrainTypes, getAllUnitTypes } from '../data/typeUtils'; import HexGrid from './HexGrid';
const ScenarioEditor = ({ onBack }) => {
  const [scenario, setScenario] = useState({ id: '', name: 'Nový scénář', description: '', boardWidth: 13, boardHeight: 9, sections: { leftWidth: 4, centerWidth: 5, rightWidth: 4 }, player1: { name: 'Spojenci', income: 8, maxSectionResources: 10 }, player2: { name: 'Osa', income: 8, maxSectionResources: 10 }, victoryPointsToWin: 6, firstPlayerId: 'player1', initialHexes: [], initialUnits: [] });
  const [tool, setTool] = useState({ type: 'terrain', id: 'grass' }); const [player, setPlayer] = useState('player1'); const [terrainTypes, setTerrainTypes] = useState([]); const [unitTypes, setUnitTypes] = useState([]); const [hexes, setHexes] = useState({}); const [units, setUnits] = useState({});
  useEffect(() => { setTerrainTypes(getAllTerrainTypes()); setUnitTypes(getAllUnitTypes()); }, []);
  const handleHexClick = (q, r) => {
    const key = `${q},${r}`;
    if (tool.type === 'terrain') { const ex = hexes[key] || { q, r, s: -q-r, terrainTypeId: 'grass' }; setHexes({ ...hexes, [key]: { ...ex, terrainTypeId: tool.id } }); }
    else if (tool.type === 'unit') { const uid = `unit-${Date.now()}`; const type = unitTypes.find(u => u.id === tool.id); setUnits({ ...units, [uid]: { id: uid, typeId: tool.id, ownerId: player, figures: type?.maxFigures || 4, resources: 0, hasMoved: false, hasAttacked: false } }); const ex = hexes[key] || { q, r, s: -q-r, terrainTypeId: 'grass' }; setHexes({ ...hexes, [key]: { ...ex, unitId: uid } }); }
    else if (tool.type === 'delete' && hexes[key]) { const { unitId, ...rest } = hexes[key]; setHexes({ ...hexes, [key]: { ...rest, unitId: undefined } }); }
  };
  const save = () => {
    const final = { ...scenario, id: scenario.id || `scen-${Date.now()}`, initialHexes: Object.values(hexes), initialUnits: Object.values(units).filter(u => Object.values(hexes).some(h => h.unitId === u.id)) };
    const saved = localStorage.getItem('scenarios'); const scens = saved ? JSON.parse(saved) : []; const idx = scens.findIndex(s => s.id === final.id); if (idx >= 0) scens[idx] = final; else scens.push(final);
    localStorage.setItem('scenarios', JSON.stringify(scens)); alert('Uloženo!'); onBack();
  };
  return (
    <div className="flex flex-col h-screen overflow-hidden p-4 bg-map-paper font-military">
      <div className="flex justify-between mb-4 border-b-2 border-map-ink-blue pb-2">
        <h2 className="text-2xl font-bold font-handwriting">Editor</h2>
        <div className="space-x-2"><button onClick={save} className="bg-map-ink-blue text-white px-6 py-2 rounded font-bold uppercase">Uložit</button><button onClick={onBack} className="bg-gray-500 text-white px-6 py-2 rounded font-bold uppercase">Zrušit</button></div>
      </div>
      <div className="flex flex-1 overflow-hidden gap-4">
        <div className="w-80 overflow-y-auto bg-white/50 p-4 border border-map-ink-blue rounded">
          <input className="w-full p-2 border mb-2" placeholder="Název" value={scenario.name} onChange={e => setScenario({...scenario, name: e.target.value})} />
          <h3 className="font-bold mb-2 uppercase text-xs">Terén</h3><div className="grid grid-cols-2 gap-2 mb-4">{terrainTypes.map(t => <button key={t.id} onClick={() => setTool({ type: 'terrain', id: t.id })} className={`p-2 border text-[10px] rounded ${tool.id === t.id ? 'bg-map-ink-blue text-white' : 'bg-white'}`}>{t.name}</button>)}</div>
          <h3 className="font-bold mb-2 uppercase text-xs">Jednotky</h3><div className="flex gap-1 mb-2"><button onClick={() => setPlayer('player1')} className={`flex-1 p-1 border text-xs ${player === 'player1' ? 'bg-blue-600 text-white' : 'bg-white'}`}>SPOJENCI</button><button onClick={() => setPlayer('player2')} className={`flex-1 p-1 border text-xs ${player === 'player2' ? 'bg-red-600 text-white' : 'bg-white'}`}>OSA</button></div>
          <div className="grid grid-cols-2 gap-2 mb-4">{unitTypes.map(u => <button key={u.id} onClick={() => setTool({ type: 'unit', id: u.id })} className={`p-2 border text-[10px] rounded ${tool.id === u.id ? 'bg-map-ink-blue text-white' : 'bg-white'}`}>{u.name}</button>)}</div>
          <button onClick={() => setTool({ type: 'delete' })} className="w-full p-2 border bg-white text-red-600 font-bold uppercase text-xs">Smazat</button>
        </div>
        <div className="flex-1 bg-white/30 rounded border border-map-ink-blue p-2">
          <HexGrid width={scenario.boardWidth} height={scenario.boardHeight} hexes={hexes} units={units} terrainTypes={terrainTypes} onHexClick={handleHexClick} leftWidth={scenario.sections.leftWidth} centerWidth={scenario.sections.centerWidth} />
        </div>
      </div>
    </div>
  );
};
export default ScenarioEditor;
