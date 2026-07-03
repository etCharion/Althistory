import React, { useState, useEffect, useRef } from 'react';
import { Trash2, Plus, Edit2, X as CloseIcon } from 'lucide-react';
import NatoSymbol from './NatoSymbol';
import { getAllUnitTypes, getAllTerrainTypes, getAllCountries, getAllCampaigns, getAllScenarios, getAllOverlayTypes, saveUnitType, deleteUnitType, saveTerrainType, deleteTerrainType, saveOverlayType, deleteOverlayType, saveCountry, deleteCountry, saveCampaign, deleteCampaign, saveScenario, deleteScenario, getScenarioCountryNames } from '../data/typeUtils';

const NATO_SYMBOLS = [
  { id: 'infantry', name: 'Pěchota' },
  { id: 'tank', name: 'Tank' },
  { id: 'artillery', name: 'Dělostřelectvo' },
  { id: 'sof', name: 'SOF (Speciální síly)' },
  { id: 'engineers', name: 'Ženisté' },
  { id: 'mortar', name: 'Minomet' },
  { id: 'hmg', name: 'Těžký kulomet' },
  { id: 'anti-tank', name: 'Protitanková jednotka' },
  { id: 'sniper', name: 'Odstřelovač' },
  { id: 'tank-destroyer', name: 'Stíhač tanků' },
  { id: 'elite-tank', name: 'Elitní tank' },
  { id: 'flame-tank', name: 'Plamenometný tank' },
  { id: 'mobile-artillery', name: 'Mobilní dělostřelectvo' },
  { id: 'rocket-artillery', name: 'Raketové dělostřelectvo' },
  { id: 'long-range-artillery', name: 'Dalekonosné dělostřelectvo' },
  { id: 'anti-aircraft', name: 'Protiletadlové dělo' },
  { id: 'partisans', name: 'Partyzáni' },
  { id: 'half-track', name: 'Polopás' },
  { id: 'mobile-infantry', name: 'Mobilní pěchota' },
  { id: 'command-vehicle', name: 'Řídicí vůz' },
  { id: 'supply', name: 'Zásobování' },
  { id: 'ambulance', name: 'Sanitka' },
  { id: 'cavalry', name: 'Kavalérie' },
  { id: 'mountain', name: 'Horské jednotky' },
  { id: 'landing', name: 'Vyloďovací jednotky' },
  { id: 'paratroopers', name: 'Parašutisté' }
];

const Customization = ({ onBack, onEditScenario }) => {
  const [units, setUnits] = useState([]);
  const [terrains, setTerrains] = useState([]);
  const [overlays, setOverlays] = useState([]);
  const [countries, setCountries] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [scenarios, setScenarios] = useState([]);
  const [activeTab, setActiveTab] = useState('scenarios');
  const [selectedUnitForSymbol, setSelectedUnitForSymbol] = useState(null);

  useEffect(() => {
    const load = async () => {
      const [u, t, o, c, cp, s] = await Promise.all([
        getAllUnitTypes(),
        getAllTerrainTypes(),
        getAllOverlayTypes(),
        getAllCountries(),
        getAllCampaigns(),
        getAllScenarios()
      ]);
      setUnits(u);
      setTerrains(t);
      setOverlays(o);
      setCountries(c);
      setCampaigns(cp);
      setScenarios(s);
    };
    load();
  }, []);

  // Debounced persistence: update React state synchronously so controlled
  // inputs keep their caret position, then save to Firestore in the background
  // (debounced per item to avoid a write on every keystroke).
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const debouncedSave = (key: string, save: () => Promise<void>) => {
    if (saveTimers.current[key]) clearTimeout(saveTimers.current[key]);
    saveTimers.current[key] = setTimeout(() => { save(); }, 500);
  };
  useEffect(() => () => { Object.values(saveTimers.current).forEach(clearTimeout); }, []);

  const updateUnit = (item) => { setUnits(prev => prev.map(u => u.id === item.id ? item : u)); debouncedSave(`unit-${item.id}`, () => saveUnitType(item)); };
  const updateTerrain = (item) => { setTerrains(prev => prev.map(t => t.id === item.id ? item : t)); debouncedSave(`terrain-${item.id}`, () => saveTerrainType(item)); };
  const updateOverlay = (item) => { setOverlays(prev => prev.map(o => o.id === item.id ? item : o)); debouncedSave(`overlay-${item.id}`, () => saveOverlayType(item)); };
  const updateCountry = (item) => { setCountries(prev => prev.map(c => c.id === item.id ? item : c)); debouncedSave(`country-${item.id}`, () => saveCountry(item)); };
  const updateCampaign = (item) => { setCampaigns(prev => prev.map(cp => cp.id === item.id ? item : cp)); debouncedSave(`campaign-${item.id}`, () => saveCampaign(item)); };

  const addUnit = async () => {
    const newUnit = { id: `unit-${Date.now()}`, name: 'Nová jednotka', movement: 2, shootingRange: [3, 2, 1], canShootAfterMovingMax: 1, maxFigures: 4, natoSymbol: 'infantry', category: 'infantry' };
    await saveUnitType(newUnit);
    setUnits([...units, newUnit]);
  };

  const addTerrain = async () => {
    const newTerrain = { id: `terrain-${Date.now()}`, name: 'Nový terén', blocksLOS: false, diceModifierDefenseInfantry: 0, diceModifierDefenseTank: 0, diceModifierAttackInfantry: 0, diceModifierAttackTank: 0, ignoreFlags: 0, color: '#cccccc', description: '' };
    await saveTerrainType(newTerrain);
    setTerrains([...terrains, newTerrain]);
  };

  const addOverlay = async () => {
    const newOverlay = { id: `overlay-${Date.now()}`, name: 'Nová překážka', diceModifierDefense: 0, diceModifierAttackInfantry: 0, diceModifierAttackTank: 0, diceModifierAttackArtillery: 0, ignoreFlags: 0, movementRestriction: 'none', blocksLOS: false, color: '#cccccc', description: '' };
    await saveOverlayType(newOverlay);
    setOverlays([...overlays, newOverlay]);
  };

  const addCountry = async () => {
    const newCountry = { id: `country-${Date.now()}`, name: 'Nová země' };
    await saveCountry(newCountry);
    setCountries([...countries, newCountry]);
  };

  const addCampaign = async () => {
    const newCampaign = { id: `campaign-${Date.now()}`, name: 'Nová kampaň' };
    await saveCampaign(newCampaign);
    setCampaigns([...campaigns, newCampaign]);
  };

  const deleteItem = async (type, setter, list, id) => {
    if (type === 'scenarios' && id === 'default-1') {
      alert('Výchozí scénář nelze smazat.');
      return;
    }
    if (!confirm('Opravdu smazat?')) return;

    if (type === 'units') await deleteUnitType(id);
    else if (type === 'terrains') await deleteTerrainType(id);
    else if (type === 'overlays') await deleteOverlayType(id);
    else if (type === 'countries') await deleteCountry(id);
    else if (type === 'campaigns') await deleteCampaign(id);
    else if (type === 'scenarios') await deleteScenario(id);

    setter(list.filter(item => item.id !== id));
  };

  return (
    <div className="min-h-screen bg-map-paper p-4 md:p-8 font-military overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6 border-b-2 border-ally pb-4">
          <h1 className="text-[34px] font-condensed font-extrabold uppercase tracking-[0.02em] text-ally">Administrace</h1>
          <button onClick={onBack} className="bg-ally text-white px-[22px] py-2.5 rounded-[10px] uppercase font-condensed font-extrabold text-sm tracking-[0.06em] hover:opacity-90 transition-opacity shadow-md">Zpět</button>
        </div>

        <div className="flex flex-wrap gap-2 mb-7">
          {['scenarios', 'units', 'terrains', 'overlays', 'countries', 'campaigns'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-[18px] py-2.5 rounded-[9px] font-condensed font-extrabold uppercase text-sm tracking-[0.05em] transition-all ${activeTab === tab ? 'bg-ally text-white shadow-md' : 'bg-white/50 text-ally border-[1.5px] border-ally hover:bg-ally/10'}`}
            >
              {tab === 'scenarios' ? 'Scénáře' : tab === 'units' ? 'Jednotky' : tab === 'terrains' ? 'Terén' : tab === 'overlays' ? 'Překážky' : tab === 'countries' ? 'Země' : 'Kampaně'}
            </button>
          ))}
        </div>

        {activeTab === 'scenarios' && (
          <section className="animate-in fade-in duration-300">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold uppercase text-map-ink-blue">Správa scénářů</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {scenarios.map(s => (
                <div key={s.id} className="p-4 border-2 border-tan-border rounded-[12px] bg-parchment-card shadow-sm flex flex-col justify-between hover:border-map-ink-blue transition-colors group">
                  <div>
                    <h3 className="font-bold text-lg text-map-ink-blue uppercase mb-1">{s.name}</h3>
                    <p className="text-[10px] text-gray-500 italic mb-2 line-clamp-2">{s.description || 'Bez popisu.'}</p>
                    <div className="text-[10px] space-y-1">
                      <div className="flex justify-between"><span>Rok:</span> <span className="font-bold">{s.year || '-'}</span></div>
                      <div className="flex justify-between gap-2"><span>Země:</span> <span className="font-bold text-right">{getScenarioCountryNames(s, countries) || '-'}</span></div>
                      <div className="flex justify-between"><span>Kampaň:</span> <span className="font-bold">{campaigns.find(c => c.id === s.campaignId)?.name || '-'}</span></div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
                    <button onClick={() => onEditScenario(s)} className="flex-1 flex items-center justify-center gap-1 bg-map-ink-green text-white py-2 rounded text-xs font-bold uppercase hover:bg-opacity-90 transition-all"><Edit2 size={12} /> Upravit</button>
                    {s.id !== 'default-1' && (
                      <button onClick={() => deleteItem('scenarios', setScenarios, scenarios, s.id)} className="bg-red-600 text-white p-2 rounded hover:bg-opacity-90 transition-all"><Trash2 size={14} /></button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'units' && (
          <section className="animate-in fade-in duration-300">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold uppercase text-map-ink-blue">Typy jednotek</h2>
              <button onClick={addUnit} className="bg-map-ink-green text-white px-4 py-2 rounded flex items-center gap-2 text-xs font-bold uppercase shadow-sm hover:scale-105 transition-transform"><Plus size={16} /> Přidat jednotku</button>
            </div>
            <div className="space-y-4">
              {units.map((u, idx) => (
                <div key={u.id} className="p-4 border-2 border-tan-border rounded-[12px] bg-parchment-card shadow-sm">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <div className="flex flex-col items-center justify-center bg-gray-50 rounded border-2 border-gray-100 p-2 cursor-pointer hover:border-map-ink-blue transition-all group relative" onClick={() => setSelectedUnitForSymbol(u)}>
                      <svg viewBox="-20 -15 40 30" className="w-16 h-12">
                         <NatoSymbol type={u.natoSymbol} owner="player1" />
                      </svg>
                      <div className="absolute inset-0 bg-map-ink-blue/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                         <Edit2 size={20} className="text-map-ink-blue" />
                      </div>
                      <span className="text-[8px] font-bold uppercase text-gray-400 mt-1 group-hover:text-map-ink-blue transition-colors">Změnit symbol</span>
                    </div>
                    <div className="md:col-span-1">
                      <label className="text-[10px] font-bold uppercase text-gray-400">Název jednotky</label>
                      <input className="w-full border-b-2 border-gray-100 focus:border-map-ink-blue outline-none py-1 font-bold text-lg" value={u.name} onChange={e => updateUnit({ ...u, name: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-gray-400">Typ (pro pravidla)</label>
                      <select className="w-full border-b-2 border-gray-100 focus:border-map-ink-blue outline-none py-1 font-bold" value={u.category || 'infantry'} onChange={e => updateUnit({ ...u, category: e.target.value })}>
                        <option value="infantry">Pěchota</option>
                        <option value="tank">Tank</option>
                        <option value="artillery">Dělostřelectvo</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-gray-400">Pohyb</label>
                      <input type="number" className="w-full border p-1 rounded mt-1" value={u.movement} onChange={e => updateUnit({ ...u, movement: parseInt(e.target.value) || 0 })} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-gray-400">Max Figurek</label>
                      <input type="number" className="w-full border p-1 rounded mt-1" value={u.maxFigures} onChange={e => updateUnit({ ...u, maxFigures: parseInt(e.target.value) || 0 })} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-gray-400">Max pohyb pro střelbu</label>
                      <input type="number" className="w-full border p-1 rounded mt-1" value={u.canShootAfterMovingMax} onChange={e => updateUnit({ ...u, canShootAfterMovingMax: parseInt(e.target.value) || 0 })} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-gray-400">Dostřel (oddělený čárkou)</label>
                      <input className="w-full border p-1 rounded mt-1" value={u.shootingRange.join(',')} onChange={e => updateUnit({ ...u, shootingRange: e.target.value.split(',').map(v => parseInt(v.trim()) || 0) })} />
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button onClick={() => deleteItem('units', setUnits, units, u.id)} className="text-red-600 hover:text-red-800 transition-colors flex items-center gap-1 text-[10px] font-bold uppercase"><Trash2 size={12} /> Smazat typ</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'terrains' && (
          <section className="animate-in fade-in duration-300">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold uppercase text-map-ink-blue">Typy terénu</h2>
              <button onClick={addTerrain} className="bg-map-ink-green text-white px-4 py-2 rounded flex items-center gap-2 text-xs font-bold uppercase shadow-sm hover:scale-105 transition-transform"><Plus size={16} /> Přidat terén</button>
            </div>
            <div className="space-y-4">
              {terrains.map((t, idx) => (
                <div key={t.id} className="p-4 border-2 border-tan-border rounded-[12px] bg-parchment-card shadow-sm">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <div className="md:col-span-2">
                      <label className="text-[10px] font-bold uppercase text-gray-400">Název terénu</label>
                      <input className="w-full border-b-2 border-gray-100 focus:border-map-ink-blue outline-none py-1 font-bold text-lg" value={t.name} onChange={e => updateTerrain({ ...t, name: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-gray-400">Barva (HEX)</label>
                      <div className="flex gap-2 items-center">
                        <div className="w-6 h-6 rounded border border-gray-300 shadow-inner" style={{ backgroundColor: t.color }}></div>
                        <input className="flex-1 border-b-2 border-gray-100 focus:border-map-ink-blue outline-none py-1 font-mono text-xs" value={t.color} onChange={e => updateTerrain({ ...t, color: e.target.value })} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-4">
                      <input type="checkbox" id={`los-${t.id}`} checked={t.blocksLOS} onChange={e => updateTerrain({ ...t, blocksLOS: e.target.checked })} />
                      <label htmlFor={`los-${t.id}`} className="text-[10px] font-bold uppercase text-gray-600">Blokuje viditelnost</label>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs mb-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-gray-400">Omezení pohybu</label>
                      <select className="w-full border p-1 rounded mt-1" value={t.movementRestriction || 'none'} onChange={e => updateTerrain({ ...t, movementRestriction: e.target.value as any })}>
                        <option value="none">Žádné</option>
                        <option value="stop">Zastavit při vstupu</option>
                        <option value="no-move">Neprůchodné</option>
                      </select>
                    </div>
                    <div className="space-y-2 border-l pl-4">
                      <label className="block text-[10px] font-bold uppercase text-gray-400">Obranný bonus (kostky)</label>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] w-12">Inf:</span>
                        <input type="number" className="w-full border p-1 rounded" value={t.diceModifierDefenseInfantry} onChange={e => updateTerrain({ ...t, diceModifierDefenseInfantry: parseInt(e.target.value) || 0 })} />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] w-12">Tank:</span>
                        <input type="number" className="w-full border p-1 rounded" value={t.diceModifierDefenseTank} onChange={e => updateTerrain({ ...t, diceModifierDefenseTank: parseInt(e.target.value) || 0 })} />
                      </div>
                    </div>
                    <div className="space-y-2 border-l pl-4">
                      <label className="block text-[10px] font-bold uppercase text-gray-400">Postih k útoku (kostky)</label>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] w-12">Inf:</span>
                        <input type="number" className="w-full border p-1 rounded" value={t.diceModifierAttackInfantry} onChange={e => updateTerrain({ ...t, diceModifierAttackInfantry: parseInt(e.target.value) || 0 })} />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] w-12">Tank:</span>
                        <input type="number" className="w-full border p-1 rounded" value={t.diceModifierAttackTank} onChange={e => updateTerrain({ ...t, diceModifierAttackTank: parseInt(e.target.value) || 0 })} />
                      </div>
                    </div>
                    <div className="space-y-2 border-l pl-4">
                      <label className="block text-[10px] font-bold uppercase text-gray-400">Speciální</label>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] w-12">Ign. vlajek:</span>
                        <input type="number" className="w-full border p-1 rounded" value={t.ignoreFlags || 0} onChange={e => updateTerrain({ ...t, ignoreFlags: parseInt(e.target.value) || 0 })} />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs mb-4">
                    <div className="border-l pl-4">
                      <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Neprůchodné pro jednotky</label>
                      <div className="flex flex-wrap gap-3">
                        {([['infantry', 'Pěchota'], ['tank', 'Tank'], ['artillery', 'Dělostřelectvo']] as const).map(([cat, label]) => (
                          <label key={cat} className="flex items-center gap-1">
                            <input type="checkbox" checked={(t.impassableForCategories || []).includes(cat)} onChange={e => {
                              const cats = t.impassableForCategories || [];
                              const next = e.target.checked ? [...cats, cat] : cats.filter(c => c !== cat);
                              updateTerrain({ ...t, impassableForCategories: next });
                            }} />
                            <span>{label}</span>
                          </label>
                        ))}
                      </div>
                      <label className="block text-[10px] font-bold uppercase text-gray-400 mt-3">Neprůchodné pro stranu</label>
                      <select className="w-full border p-1 rounded mt-1" value={t.impassableForPlayer || ''} onChange={e => updateTerrain({ ...t, impassableForPlayer: (e.target.value || undefined) as any })}>
                        <option value="">Žádnou</option>
                        <option value="player1">Strana 1</option>
                        <option value="player2">Strana 2</option>
                      </select>
                    </div>
                    <div className="border-l pl-4 space-y-2">
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={!!t.entryFromAdjacentOnly} onChange={e => updateTerrain({ ...t, entryFromAdjacentOnly: e.target.checked })} />
                        <span className="text-[10px] font-bold uppercase text-gray-600">Vstup jen z vedlejšího pole</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={!!t.exitToAdjacentOnly} onChange={e => updateTerrain({ ...t, exitToAdjacentOnly: e.target.checked })} />
                        <span className="text-[10px] font-bold uppercase text-gray-600">Výstup jen na vedlejší pole</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase text-gray-400">Popis</label>
                    <textarea className="w-full border p-2 rounded mt-1 text-xs" rows={2} value={t.description || ''} onChange={e => updateTerrain({ ...t, description: e.target.value })} />
                  </div>

                  <div className="mt-4 flex justify-end">
                    <button onClick={() => deleteItem('terrains', setTerrains, terrains, t.id)} className="text-red-600 hover:text-red-800 transition-colors flex items-center gap-1 text-[10px] font-bold uppercase"><Trash2 size={12} /> Smazat typ</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'overlays' && (
          <section className="animate-in fade-in duration-300">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold uppercase text-map-ink-blue">Typy překážek</h2>
              <button onClick={addOverlay} className="bg-map-ink-green text-white px-4 py-2 rounded flex items-center gap-2 text-xs font-bold uppercase shadow-sm hover:scale-105 transition-transform"><Plus size={16} /> Přidat překážku</button>
            </div>
            <div className="space-y-4">
              {overlays.map((o, idx) => (
                <div key={o.id} className="p-4 border-2 border-tan-border rounded-[12px] bg-parchment-card shadow-sm">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <div className="md:col-span-2">
                      <label className="text-[10px] font-bold uppercase text-gray-400">Název překážky</label>
                      <input className="w-full border-b-2 border-gray-100 focus:border-map-ink-blue outline-none py-1 font-bold text-lg" value={o.name} onChange={e => updateOverlay({ ...o, name: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-gray-400">Barva (HEX)</label>
                      <div className="flex gap-2 items-center">
                        <div className="w-6 h-6 rounded border border-gray-300 shadow-inner" style={{ backgroundColor: o.color }}></div>
                        <input className="flex-1 border-b-2 border-gray-100 focus:border-map-ink-blue outline-none py-1 font-mono text-xs" value={o.color} onChange={e => updateOverlay({ ...o, color: e.target.value })} />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-gray-400">Vzhled na mapě</label>
                      <select className="w-full border p-1 rounded mt-1 text-xs" value={o.mapStyle || 'outline'} onChange={e => updateOverlay({ ...o, mapStyle: e.target.value as any })}>
                        <option value="outline">Barevný obrys</option>
                        <option value="x">Křížky (X) – zátaras</option>
                        <option value="sandbags">Pytle s pískem (hnědé)</option>
                        <option value="bunker">Pytle s pískem (šedé) – bunkr</option>
                        <option value="wire">Ostnatý drát</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2 pt-4">
                      <input type="checkbox" id={`los-o-${o.id}`} checked={o.blocksLOS} onChange={e => updateOverlay({ ...o, blocksLOS: e.target.checked })} />
                      <label htmlFor={`los-o-${o.id}`} className="text-[10px] font-bold uppercase text-gray-600">Blokuje viditelnost</label>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs mb-4">
                    <div className="space-y-2">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-gray-400">Omezení pohybu</label>
                        <select className="w-full border p-1 rounded mt-1" value={o.movementRestriction || 'none'} onChange={e => updateOverlay({ ...o, movementRestriction: e.target.value as any })}>
                          <option value="none">Žádné</option>
                          <option value="stop">Zastavit při vstupu</option>
                          <option value="no-move">Neprůchodné</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="checkbox" id={`attack-stop-${o.id}`} checked={!!o.allowAttackAfterStop} onChange={e => updateOverlay({ ...o, allowAttackAfterStop: e.target.checked })} />
                        <label htmlFor={`attack-stop-${o.id}`} className="text-[10px] font-bold uppercase text-gray-600">Lze útočit po 'stop'</label>
                      </div>
                    </div>
                    <div className="space-y-2 border-l pl-4">
                      <label className="block text-[10px] font-bold uppercase text-gray-400">Obranný bonus (kostky)</label>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] w-12">Všechny:</span>
                        <input type="number" className="w-full border p-1 rounded" value={o.diceModifierDefense || 0} onChange={e => updateOverlay({ ...o, diceModifierDefense: parseInt(e.target.value) || 0 })} />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] w-12">Pěchota:</span>
                        <input type="number" className="w-full border p-1 rounded" value={o.diceModifierDefenseInfantry || 0} onChange={e => updateOverlay({ ...o, diceModifierDefenseInfantry: parseInt(e.target.value) || 0 })} />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] w-12">Tank:</span>
                        <input type="number" className="w-full border p-1 rounded" value={o.diceModifierDefenseTank || 0} onChange={e => updateOverlay({ ...o, diceModifierDefenseTank: parseInt(e.target.value) || 0 })} />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] w-12">Děl:</span>
                        <input type="number" className="w-full border p-1 rounded" value={o.diceModifierDefenseArtillery || 0} onChange={e => updateOverlay({ ...o, diceModifierDefenseArtillery: parseInt(e.target.value) || 0 })} />
                      </div>
                      <div className="flex items-center gap-2 pt-1 border-t">
                        <span className="text-[10px] w-12">Ign. vlajek:</span>
                        <input type="number" className="w-full border p-1 rounded" value={o.ignoreFlags || 0} onChange={e => updateOverlay({ ...o, ignoreFlags: parseInt(e.target.value) || 0 })} />
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="checkbox" id={`owner-only-${o.id}`} checked={!!o.onlyBonusForOwner} onChange={e => updateOverlay({ ...o, onlyBonusForOwner: e.target.checked })} />
                        <label htmlFor={`owner-only-${o.id}`} className="text-[10px] font-bold uppercase text-gray-600">Jen pro majitele</label>
                      </div>
                    </div>
                    <div className="space-y-2 border-l pl-4">
                      <label className="block text-[10px] font-bold uppercase text-gray-400">Postih k útoku (kostky)</label>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] w-12">Inf:</span>
                        <input type="number" className="w-full border p-1 rounded" value={o.diceModifierAttackInfantry || 0} onChange={e => updateOverlay({ ...o, diceModifierAttackInfantry: parseInt(e.target.value) || 0 })} />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] w-12">Tank:</span>
                        <input type="number" className="w-full border p-1 rounded" value={o.diceModifierAttackTank || 0} onChange={e => updateOverlay({ ...o, diceModifierAttackTank: parseInt(e.target.value) || 0 })} />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] w-12">Děl:</span>
                        <input type="number" className="w-full border p-1 rounded" value={o.diceModifierAttackArtillery || 0} onChange={e => updateOverlay({ ...o, diceModifierAttackArtillery: parseInt(e.target.value) || 0 })} />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs mb-4">
                    <div className="border-l pl-4 space-y-4">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Neprůchodné pro jednotky</label>
                        <div className="flex flex-wrap gap-3">
                          {([['infantry', 'Pěchota'], ['tank', 'Tank'], ['artillery', 'Dělostřelectvo']] as const).map(([cat, label]) => (
                            <label key={cat} className="flex items-center gap-1">
                              <input type="checkbox" checked={(o.impassableForCategories || []).includes(cat)} onChange={e => {
                                const cats = o.impassableForCategories || [];
                                const next = e.target.checked ? [...cats, cat] : cats.filter(c => c !== cat);
                                updateOverlay({ ...o, impassableForCategories: next });
                              }} />
                              <span>{label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Zákaz ústupu pro</label>
                        <div className="flex flex-wrap gap-3">
                          {([['infantry', 'Pěchota'], ['tank', 'Tank'], ['artillery', 'Dělostřelectvo']] as const).map(([cat, label]) => (
                            <label key={cat} className="flex items-center gap-1">
                              <input type="checkbox" checked={(o.noRetreatCategories || []).includes(cat)} onChange={e => {
                                const cats = o.noRetreatCategories || [];
                                const next = e.target.checked ? [...cats, cat] : cats.filter(c => c !== cat);
                                updateOverlay({ ...o, noRetreatCategories: next });
                              }} />
                              <span>{label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Zákaz vyjití (uvěznění) pro</label>
                        <div className="flex flex-wrap gap-3">
                          {([['infantry', 'Pěchota'], ['tank', 'Tank'], ['artillery', 'Dělostřelectvo']] as const).map(([cat, label]) => (
                            <label key={cat} className="flex items-center gap-1">
                              <input type="checkbox" checked={(o.cannotLeaveCategories || []).includes(cat)} onChange={e => {
                                const cats = o.cannotLeaveCategories || [];
                                const next = e.target.checked ? [...cats, cat] : cats.filter(c => c !== cat);
                                updateOverlay({ ...o, cannotLeaveCategories: next });
                              }} />
                              <span>{label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <label className="block text-[10px] font-bold uppercase text-gray-400 mt-3">Neprůchodné pro stranu</label>
                      <select className="w-full border p-1 rounded mt-1" value={o.impassableForPlayer || ''} onChange={e => updateOverlay({ ...o, impassableForPlayer: (e.target.value || undefined) as any })}>
                        <option value="">Žádnou</option>
                        <option value="player1">Strana 1</option>
                        <option value="player2">Strana 2</option>
                      </select>
                    </div>
                    <div className="border-l pl-4 space-y-2">
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={!!o.entryFromAdjacentOnly} onChange={e => updateOverlay({ ...o, entryFromAdjacentOnly: e.target.checked })} />
                        <span className="text-[10px] font-bold uppercase text-gray-600">Vstup jen z vedlejšího pole</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={!!o.exitToAdjacentOnly} onChange={e => updateOverlay({ ...o, exitToAdjacentOnly: e.target.checked })} />
                        <span className="text-[10px] font-bold uppercase text-gray-600">Výstup jen na vedlejší pole</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase text-gray-400">Popis</label>
                    <textarea className="w-full border p-2 rounded mt-1 text-xs" rows={2} value={o.description || ''} onChange={e => updateOverlay({ ...o, description: e.target.value })} />
                  </div>

                  <div className="mt-4 flex justify-end">
                    <button onClick={() => deleteItem('overlays', setOverlays, overlays, o.id)} className="text-red-600 hover:text-red-800 transition-colors flex items-center gap-1 text-[10px] font-bold uppercase"><Trash2 size={12} /> Smazat typ</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'countries' && (
          <section className="animate-in fade-in duration-300">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold uppercase text-map-ink-blue">Země</h2>
              <button onClick={addCountry} className="bg-map-ink-green text-white px-4 py-2 rounded flex items-center gap-2 text-xs font-bold uppercase shadow-sm hover:scale-105 transition-transform"><Plus size={16} /> Přidat zemi</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {countries.map((c, idx) => (
                <div key={c.id} className="flex gap-2 p-2 border-2 border-tan-border rounded-[11px] bg-parchment-card items-center shadow-sm">
                  <input className="flex-1 font-bold outline-none border-b-2 border-transparent focus:border-map-ink-blue" value={c.name} onChange={e => updateCountry({ ...c, name: e.target.value })} />
                  <button onClick={() => deleteItem('countries', setCountries, countries, c.id)} className="text-red-600 p-2"><Trash2 size={16} /></button>
                </div>
              ))}
            </div>
          </section>
        )}

        {selectedUnitForSymbol && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onClick={() => setSelectedUnitForSymbol(null)}>
            <div className="bg-white rounded-xl shadow-2xl border-4 border-slate-800 w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col animate-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
              <div className="p-4 border-b-2 border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-xl uppercase text-slate-800 tracking-tight">Katalog symbolů NATO</h3>
                <button onClick={() => setSelectedUnitForSymbol(null)} className="text-slate-400 hover:text-slate-600 transition-colors p-1">
                  <CloseIcon size={24} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {NATO_SYMBOLS.map(s => (
                    <button
                      key={s.id}
                      onClick={() => {
                        updateUnit({ ...selectedUnitForSymbol, natoSymbol: s.id });
                        setSelectedUnitForSymbol(null);
                      }}
                      className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all hover:scale-105 active:scale-95 ${selectedUnitForSymbol.natoSymbol === s.id ? 'border-map-ink-blue bg-blue-50' : 'border-gray-100 hover:border-map-ink-blue bg-white shadow-sm'}`}
                    >
                      <svg viewBox="-20 -15 40 30" className="w-12 h-10">
                        <NatoSymbol type={s.id} owner="player1" />
                      </svg>
                      <span className="text-[10px] font-bold text-center uppercase leading-tight">{s.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'campaigns' && (
          <section className="animate-in fade-in duration-300">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold uppercase text-map-ink-blue">Kampaně</h2>
              <button onClick={addCampaign} className="bg-map-ink-green text-white px-4 py-2 rounded flex items-center gap-2 text-xs font-bold uppercase shadow-sm hover:scale-105 transition-transform"><Plus size={16} /> Přidat kampaň</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {campaigns.map((c, idx) => (
                <div key={c.id} className="flex gap-2 p-2 border-2 border-tan-border rounded-[11px] bg-parchment-card items-center shadow-sm">
                  <input className="flex-1 font-bold outline-none border-b-2 border-transparent focus:border-map-ink-blue" value={c.name} onChange={e => updateCampaign({ ...c, name: e.target.value })} />
                  <button onClick={() => deleteItem('campaigns', setCampaigns, campaigns, c.id)} className="text-red-600 p-2"><Trash2 size={16} /></button>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};
export default Customization;
