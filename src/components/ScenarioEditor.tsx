import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, X, Globe, Calendar, Flag, BookOpen, Layers } from 'lucide-react';
import { getAllTerrainTypes, getAllUnitTypes, getAllCountries, getAllCampaigns, getAllOverlayTypes, saveScenario, saveCountry, saveCampaign, getScenarioCountryIds } from '../data/typeUtils';
import HexGrid from './HexGrid';

const ScenarioEditor = ({ onBack, initialScenario }) => {
  const [scenario, setScenario] = useState({
    id: '',
    name: 'Nový scénář',
    description: '',
    boardWidth: 13,
    boardHeight: 9,
    sections: { leftWidth: 4, centerWidth: 5, rightWidth: 4 },
    player1: { name: 'Spojenci', income: 8, maxSectionResources: 10 },
    player2: { name: 'Osa', income: 8, maxSectionResources: 10 },
    victoryPointsToWin: 6,
    firstPlayerId: 'player1',
    initialHexes: [],
    initialUnits: [],
    isRealBattle: true,
    year: 1944,
    countryId: 'usa',
    countryIds: ['usa'],
    campaignId: '',
    campaignNumber: 1
  });

  const [tool, setTool] = useState({ type: 'terrain', id: 'grass' });
  const [player, setPlayer] = useState('player1');
  const [terrainTypes, setTerrainTypes] = useState([]);
  const [unitTypes, setUnitTypes] = useState([]);
  const [overlayTypes, setOverlayTypes] = useState([]);
  const [countries, setCountries] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [hexes, setHexes] = useState({});
  const [units, setUnits] = useState({});
  const [objSettings, setObjSettings] = useState({ name: 'Cíl', type: 'permanent', timing: 'immediate', points: 1, validFor: 'both' as any });

  useEffect(() => {
    const load = async () => {
      const [t, u, o, c, cp] = await Promise.all([
        getAllTerrainTypes(),
        getAllUnitTypes(),
        getAllOverlayTypes(),
        getAllCountries(),
        getAllCampaigns()
      ]);
      setTerrainTypes(t);
      setUnitTypes(u);
      setOverlayTypes(o);
      setCountries(c);
      setCampaigns(cp);
    };
    load();

    if (initialScenario) {
      // Older scenarios only have the single `countryId`; normalize to the
      // multi-country `countryIds` array so the editor can work uniformly.
      setScenario({ ...initialScenario, countryIds: getScenarioCountryIds(initialScenario) });
      const hObj = {};
      initialScenario.initialHexes.forEach(h => { hObj[`${h.q},${h.r}`] = h; });
      setHexes(hObj);
      const uObj = {};
      initialScenario.initialUnits.forEach(u => { uObj[u.id] = u; });
      setUnits(uObj);
    }
  }, [initialScenario]);

  const handleHexClick = (q, r) => {
    const key = `${q},${r}`;
    const ex = hexes[key] || { q, r, s: -q-r, terrainTypeId: 'grass' };


    if (tool.type === 'terrain') {
      setHexes({ ...hexes, [key]: { ...ex, terrainTypeId: tool.id } });
    } else if (tool.type === 'overlay') {
      setHexes({ ...hexes, [key]: { ...ex, overlayTypeId: ex.overlayTypeId === tool.id ? undefined : tool.id } });
    } else if (tool.type === 'objective') {
      setHexes({ ...hexes, [key]: { ...ex, objective: ex.objective ? undefined : { ...objSettings } } });
    } else if (tool.type === 'unit') {
      const uid = `unit-${Date.now()}`;
      const type = unitTypes.find(u => u.id === tool.id);
      setUnits({
        ...units,
        [uid]: {
          id: uid,
          typeId: tool.id,
          ownerId: player,
          figures: type?.maxFigures || 4,
          resources: 0,
          hasMoved: false,
          hasAttacked: false,
          movementUsed: 0
        }
      });
      setHexes({ ...hexes, [key]: { ...ex, unitId: uid } });
    } else if (tool.type === 'delete' && hexes[key]) {
      const { unitId, objective, overlayTypeId, ...rest } = hexes[key];
      setHexes({ ...hexes, [key]: { ...rest, unitId: undefined, objective: undefined, overlayTypeId: undefined } });
    }
  };

  const save = async () => {
    const countryIds = scenario.countryIds || [];
    const final = {
      ...scenario,
      id: scenario.id || `scen-${Date.now()}`,
      countryIds,
      // Keep the legacy `countryId` in sync (first selected country) for
      // backward compatibility with anything still reading the old field.
      countryId: countryIds[0] || scenario.countryId || '',
      initialHexes: Object.values(hexes),
      initialUnits: Object.values(units).filter(u => Object.values(hexes).some(h => h.unitId === u.id))
    };
    await saveScenario(final);
    alert('Uloženo do cloudu!');
    onBack();
  };

  const addNewItem = async (type) => {
    const name = prompt(`Zadejte název pro novou ${type === 'country' ? 'zemi' : 'kampaň'}:`);
    if (!name) return;
    const id = `${type}-${Date.now()}`;
    const newItem = { id, name };
    if (type === 'country') {
      await saveCountry(newItem);
      setCountries([...countries, newItem]);
      setScenario({ ...scenario, countryIds: [...(scenario.countryIds || []), id] });
    } else {
      await saveCampaign(newItem);
      setCampaigns([...campaigns, newItem]);
      setScenario({ ...scenario, campaignId: id });
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden p-4 bg-map-paper font-military">
      <div className="flex justify-between mb-4 border-b-2 border-map-ink-blue pb-2 items-center">
        <h2 className="text-2xl font-bold font-handwriting uppercase text-map-ink-blue flex items-center gap-2">
          <Layers /> Editor Scénáře
        </h2>
        <div className="flex gap-2">
          <button onClick={save} className="bg-map-ink-blue text-white px-6 py-2 rounded font-bold uppercase flex items-center gap-2 hover:bg-opacity-90 shadow-md">
            <Save size={18} /> Uložit
          </button>
          <button onClick={onBack} className="bg-gray-500 text-white px-6 py-2 rounded font-bold uppercase flex items-center gap-2 hover:bg-opacity-90 shadow-md">
            <X size={18} /> Zrušit
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden gap-4">
        <div className="w-96 overflow-y-auto bg-white/80 p-4 border-2 border-map-ink-blue rounded shadow-inner space-y-6">
          <section className="space-y-3">
            <h3 className="font-bold uppercase text-xs text-map-ink-blue border-b border-map-ink-blue/20 pb-1 flex items-center gap-1"><BookOpen size={12} /> Základní informace</h3>
            <input className="w-full p-2 border-2 border-gray-100 focus:border-map-ink-blue outline-none rounded font-bold" placeholder="Název scénáře" value={scenario.name} onChange={e => setScenario({ ...scenario, name: e.target.value })} />
            <textarea className="w-full p-2 border-2 border-gray-100 focus:border-map-ink-blue outline-none rounded text-xs" rows={3} placeholder="Popis scénáře..." value={scenario.description} onChange={e => setScenario({ ...scenario, description: e.target.value })} />

            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 p-2 border rounded bg-white">
                <input type="checkbox" id="realBattle" checked={scenario.isRealBattle} onChange={e => setScenario({ ...scenario, isRealBattle: e.target.checked })} />
                <label htmlFor="realBattle" className="text-[10px] font-bold uppercase cursor-pointer">Reálná bitva</label>
              </div>
              <div className="flex items-center gap-1 p-1 border rounded bg-white">
                <Calendar size={14} className="text-gray-400" />
                <input type="number" className="w-full text-xs outline-none" placeholder="Rok" value={scenario.year} onChange={e => setScenario({ ...scenario, year: parseInt(e.target.value) || 0 })} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-gray-500 flex items-center gap-1"><Flag size={10} /> Země (lze vybrat více)</label>
              <div className="flex flex-wrap gap-1 items-center">
                {countries.map(c => {
                  const active = (scenario.countryIds || []).includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        const cur = scenario.countryIds || [];
                        const next = active ? cur.filter(x => x !== c.id) : [...cur, c.id];
                        setScenario({ ...scenario, countryIds: next });
                      }}
                      className={`px-2 py-1 rounded text-xs font-bold uppercase border transition-colors ${active ? 'bg-map-ink-blue text-white border-map-ink-blue' : 'bg-white text-gray-600 border-gray-300 hover:border-map-ink-blue'}`}
                    >
                      {c.name}
                    </button>
                  );
                })}
                <button onClick={() => addNewItem('country')} className="bg-map-ink-green text-white p-1.5 rounded hover:bg-opacity-90"><Plus size={14} /></button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-gray-500">Body k výhře</label>
                <input type="number" className="w-full p-2 border text-xs rounded outline-none focus:border-map-ink-blue" value={scenario.victoryPointsToWin} onChange={e => setScenario({ ...scenario, victoryPointsToWin: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1">
                 <label className="text-[10px] font-bold uppercase text-gray-500">Příjem Spojenci</label>
                 <input type="number" className="w-full p-2 border text-xs rounded outline-none focus:border-map-ink-blue" value={scenario.player1.income} onChange={e => setScenario({ ...scenario, player1: { ...scenario.player1, income: parseInt(e.target.value) || 0 }})} />
              </div>
              <div className="space-y-1">
                 <label className="text-[10px] font-bold uppercase text-gray-500">Příjem Osa</label>
                 <input type="number" className="w-full p-2 border text-xs rounded outline-none focus:border-map-ink-blue" value={scenario.player2.income} onChange={e => setScenario({ ...scenario, player2: { ...scenario.player2, income: parseInt(e.target.value) || 0 }})} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2 space-y-1">
                <label className="text-[10px] font-bold uppercase text-gray-500 flex items-center gap-1"><Globe size={10} /> Kampaň</label>
                <div className="flex gap-1">
                  <select className="flex-1 p-2 border text-xs rounded outline-none focus:border-map-ink-blue" value={scenario.campaignId} onChange={e => setScenario({ ...scenario, campaignId: e.target.value })}>
                    <option value="">Žádná</option>
                    {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <button onClick={() => addNewItem('campaign')} className="bg-map-ink-green text-white p-2 rounded hover:bg-opacity-90"><Plus size={16} /></button>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-gray-500">Číslo</label>
                <input type="number" className="w-full p-2 border text-xs rounded outline-none focus:border-map-ink-blue" value={scenario.campaignNumber} onChange={e => setScenario({ ...scenario, campaignNumber: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
          </section>

          <section>
            <h3 className="font-bold mb-2 uppercase text-xs text-map-ink-blue border-b border-map-ink-blue/20 pb-1">Terén</h3>
            <div className="grid grid-cols-2 gap-2">
              {terrainTypes.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTool({ type: 'terrain', id: t.id })}
                  className={`p-2 border-2 text-[10px] rounded font-bold uppercase transition-all ${tool.id === t.id && tool.type === 'terrain' ? 'bg-map-ink-blue text-white border-map-ink-blue scale-105 shadow-md' : 'bg-white border-gray-100 hover:border-map-ink-blue/50'}`}
                >
                  <div className="w-full h-1 mb-1 rounded-full" style={{ backgroundColor: t.color }}></div>
                  {t.name}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3 className="font-bold mb-2 uppercase text-xs text-map-ink-blue border-b border-map-ink-blue/20 pb-1">Překážky</h3>
            <div className="grid grid-cols-2 gap-2">
              {overlayTypes.map(o => (
                <button
                  key={o.id}
                  onClick={() => setTool({ type: 'overlay', id: o.id })}
                  className={`p-2 border-2 text-[10px] rounded font-bold uppercase transition-all ${tool.id === o.id && tool.type === 'overlay' ? 'bg-map-ink-blue text-white border-map-ink-blue scale-105 shadow-md' : 'bg-white border-gray-100 hover:border-map-ink-blue/50'}`}
                >
                  {o.name}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3 className="font-bold mb-2 uppercase text-xs text-map-ink-blue border-b border-map-ink-blue/20 pb-1">Objektivy</h3>
            <div className="bg-white p-2 border rounded space-y-2 text-[10px]">
               <div className="flex justify-between items-center">
                 <span className="font-bold uppercase text-gray-500">Název:</span>
                 <input type="text" className="border rounded p-1 w-32" value={objSettings.name || ''} onChange={e => setObjSettings({...objSettings, name: e.target.value})} />
               </div>
               <div className="flex justify-between items-center">
                 <span className="font-bold uppercase text-gray-500">Typ:</span>
                 <select className="border rounded p-1" value={objSettings.type} onChange={e => setObjSettings({...objSettings, type: e.target.value as any})}>
                   <option value="permanent">Trvalý</option>
                   <option value="temporary">Dočasný</option>
                 </select>
               </div>
               <div className="flex justify-between items-center">
                 <span className="font-bold uppercase text-gray-500">Časování:</span>
                 <select className="border rounded p-1" value={objSettings.timing} onChange={e => setObjSettings({...objSettings, timing: e.target.value as any})}>
                   <option value="immediate">Okamžitý</option>
                   <option value="startOfTurn">Začátek tahu</option>
                 </select>
               </div>
               <div className="flex justify-between items-center">
                 <span className="font-bold uppercase text-gray-500">Body:</span>
                 <input type="number" className="border rounded p-1 w-12" value={objSettings.points} onChange={e => setObjSettings({...objSettings, points: parseInt(e.target.value) || 0})} />
               </div>
               <div className="flex justify-between items-center">
                 <span className="font-bold uppercase text-gray-500">Pro stranu:</span>
                 <select className="border rounded p-1" value={objSettings.validFor} onChange={e => setObjSettings({...objSettings, validFor: e.target.value as any})}>
                   <option value="both">Všechny</option>
                   <option value="player1">Spojenci</option>
                   <option value="player2">Osa</option>
                 </select>
               </div>
               <button
                 onClick={() => setTool({ type: 'objective', id: 'obj' })}
                 className={`w-full p-2 border-2 font-bold uppercase rounded transition-all ${tool.type === 'objective' ? 'bg-map-ink-blue text-white border-map-ink-blue' : 'bg-white border-gray-100'}`}
               >
                 Nastavit cíl
               </button>
            </div>
          </section>

          <section>
            <h3 className="font-bold mb-2 uppercase text-xs text-map-ink-blue border-b border-map-ink-blue/20 pb-1">Jednotky</h3>
            <div className="flex gap-1 mb-3">
              <button onClick={() => setPlayer('player1')} className={`flex-1 py-2 border-2 text-[10px] font-bold uppercase rounded transition-all ${player === 'player1' ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white border-gray-100'}`}>SPOJENCI</button>
              <button onClick={() => setPlayer('player2')} className={`flex-1 py-2 border-2 text-[10px] font-bold uppercase rounded transition-all ${player === 'player2' ? 'bg-red-600 text-white border-red-600 shadow-md' : 'bg-white border-gray-100'}`}>OSA</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {unitTypes.map(u => (
                <button
                  key={u.id}
                  onClick={() => setTool({ type: 'unit', id: u.id })}
                  className={`p-2 border-2 text-[10px] rounded font-bold uppercase transition-all ${tool.id === u.id && tool.type === 'unit' ? 'bg-map-ink-blue text-white border-map-ink-blue scale-105 shadow-md' : 'bg-white border-gray-100 hover:border-map-ink-blue/50'}`}
                >
                  {u.name}
                </button>
              ))}
            </div>
          </section>

          <button
            onClick={() => setTool({ type: 'delete' })}
            className={`w-full p-3 border-2 font-bold uppercase text-xs flex items-center justify-center gap-2 transition-all rounded ${tool.type === 'delete' ? 'bg-red-600 text-white border-red-600 shadow-lg' : 'bg-white text-red-600 border-red-600 hover:bg-red-50'}`}
          >
            <Trash2 size={16} /> Smazat z mapy
          </button>
        </div>

        <div className="flex-1 bg-white/40 rounded-xl border-2 border-map-ink-blue p-4 shadow-2xl relative overflow-hidden">
          <div className="absolute top-4 right-4 bg-white/80 p-2 rounded text-[10px] font-bold border border-map-ink-blue z-10 shadow-sm">
            Nástroj: <span className="text-map-ink-blue uppercase">{tool.type === 'delete' ? 'Smazat' : tool.id}</span>
            {tool.type === 'unit' && <span className={player === 'player1' ? ' text-blue-600' : ' text-red-600'}> ({player === 'player1' ? 'SPOJ' : 'OSA'})</span>}
          </div>
          <div className="h-full w-full flex items-center justify-center">
            <HexGrid
              width={scenario.boardWidth}
              height={scenario.boardHeight}
              hexes={hexes}
              units={units}
              terrainTypes={terrainTypes}
              unitTypes={unitTypes}
              onHexClick={handleHexClick}
              leftWidth={scenario.sections.leftWidth}
              centerWidth={scenario.sections.centerWidth}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
export default ScenarioEditor;
