import React, { useState, useEffect } from 'react';
import { Trash2, Plus, Edit2 } from 'lucide-react';
import NatoSymbol from './NatoSymbol';
import { getAllUnitTypes, getAllTerrainTypes, getAllCountries, getAllCampaigns, getAllScenarios, getAllOverlayTypes, saveUnitType, deleteUnitType, saveTerrainType, deleteTerrainType, saveOverlayType, deleteOverlayType, saveCountry, deleteCountry, saveCampaign, deleteCampaign, saveScenario, deleteScenario } from '../data/typeUtils';

const Customization = ({ onBack, onEditScenario }) => {
  const [units, setUnits] = useState([]);
  const [terrains, setTerrains] = useState([]);
  const [overlays, setOverlays] = useState([]);
  const [countries, setCountries] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [scenarios, setScenarios] = useState([]);
  const [activeTab, setActiveTab] = useState('scenarios');

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

  // Updated saving logic to handle single item updates to Firestore
  const updateUnit = async (item) => { await saveUnitType(item); setUnits(prev => prev.map(u => u.id === item.id ? item : u)); };
  const updateTerrain = async (item) => { await saveTerrainType(item); setTerrains(prev => prev.map(t => t.id === item.id ? item : t)); };
  const updateOverlay = async (item) => { await saveOverlayType(item); setOverlays(prev => prev.map(o => o.id === item.id ? item : o)); };
  const updateCountry = async (item) => { await saveCountry(item); setCountries(prev => prev.map(c => c.id === item.id ? item : c)); };
  const updateCampaign = async (item) => { await saveCampaign(item); setCampaigns(prev => prev.map(cp => cp.id === item.id ? item : cp)); };

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
      <div className="max-w-6xl mx-auto bg-white/90 p-4 md:p-8 rounded shadow-2xl border-2 border-map-ink-blue">
        <div className="flex justify-between items-center mb-8 border-b-2 border-map-ink-blue pb-4">
          <h1 className="text-3xl font-bold font-handwriting uppercase tracking-widest text-map-ink-blue">Administrace</h1>
          <button onClick={onBack} className="bg-map-ink-blue text-white px-6 py-2 rounded uppercase font-bold text-sm hover:bg-opacity-90 transition-all shadow-md">Zpět</button>
        </div>

        <div className="flex flex-wrap gap-2 mb-8">
          {['scenarios', 'units', 'terrains', 'overlays', 'countries', 'campaigns'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded font-bold uppercase text-xs transition-all ${activeTab === tab ? 'bg-map-ink-blue text-white shadow-md scale-105' : 'bg-white text-map-ink-blue border border-map-ink-blue hover:bg-map-ink-blue/10'}`}
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
                <div key={s.id} className="p-4 border-2 border-gray-200 rounded bg-white shadow-sm flex flex-col justify-between hover:border-map-ink-blue transition-colors group">
                  <div>
                    <h3 className="font-bold text-lg text-map-ink-blue uppercase mb-1">{s.name}</h3>
                    <p className="text-[10px] text-gray-500 italic mb-2 line-clamp-2">{s.description || 'Bez popisu.'}</p>
                    <div className="text-[10px] space-y-1">
                      <div className="flex justify-between"><span>Rok:</span> <span className="font-bold">{s.year || '-'}</span></div>
                      <div className="flex justify-between"><span>Země:</span> <span className="font-bold">{countries.find(c => c.id === s.countryId)?.name || s.countryId || '-'}</span></div>
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
                <div key={u.id} className="p-4 border-2 border-gray-200 rounded bg-white shadow-sm">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <div className="flex items-center justify-center bg-gray-50 rounded border-2 border-gray-100 p-2">
                      <svg viewBox="-20 -15 40 30" className="w-16 h-12">
                         <NatoSymbol type={u.natoSymbol} owner="player1" />
                      </svg>
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
                    <div>
                      <label className="text-[10px] font-bold uppercase text-gray-400">NATO Symbol</label>
                      <select className="w-full border-b-2 border-gray-100 focus:border-map-ink-blue outline-none py-1 font-bold" value={u.natoSymbol} onChange={e => updateUnit({ ...u, natoSymbol: e.target.value })}>
                        <option value="infantry">Pěchota</option>
                        <option value="tank">Tank</option>
                        <option value="artillery">Dělostřelectvo</option>
                        <option value="sof">SOF (Speciální síly)</option>
                        <option value="engineers">Ženisté</option>
                        <option value="mortar">Minomet</option>
                        <option value="hmg">Těžký kulomet</option>
                        <option value="anti-tank">Protitanková jednotka</option>
                        <option value="sniper">Odstřelovač</option>
                        <option value="tank-destroyer">Stíhač tanků</option>
                        <option value="elite-tank">Elitní tank</option>
                        <option value="flame-tank">Plamenometný tank</option>
                        <option value="mobile-artillery">Mobilní dělostřelectvo</option>
                        <option value="rocket-artillery">Raketové dělostřelectvo</option>
                        <option value="long-range-artillery">Dalekonosné dělostřelectvo</option>
                        <option value="anti-aircraft">Protiletadlové dělo</option>
                        <option value="partisans">Partyzáni</option>
                        <option value="half-track">Polopás</option>
                        <option value="mobile-infantry">Mobilní pěchota</option>
                        <option value="command-vehicle">Řídicí vůz</option>
                        <option value="supply">Zásobování</option>
                        <option value="ambulance">Sanitka</option>
                        <option value="cavalry">Kavalérie</option>
                        <option value="mountain">Horské jednotky</option>
                        <option value="landing">Vyloďovací jednotky</option>
                        <option value="paratroopers">Parašutisté</option>
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
                <div key={t.id} className="p-4 border-2 border-gray-200 rounded bg-white shadow-sm">
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
                <div key={o.id} className="p-4 border-2 border-gray-200 rounded bg-white shadow-sm">
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
                    <div className="flex items-center gap-2 pt-4">
                      <input type="checkbox" id={`los-o-${o.id}`} checked={o.blocksLOS} onChange={e => updateOverlay({ ...o, blocksLOS: e.target.checked })} />
                      <label htmlFor={`los-o-${o.id}`} className="text-[10px] font-bold uppercase text-gray-600">Blokuje viditelnost</label>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs mb-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-gray-400">Omezení pohybu</label>
                      <select className="w-full border p-1 rounded mt-1" value={o.movementRestriction || 'none'} onChange={e => updateOverlay({ ...o, movementRestriction: e.target.value as any })}>
                        <option value="none">Žádné</option>
                        <option value="stop">Zastavit při vstupu</option>
                        <option value="no-move">Neprůchodné</option>
                      </select>
                    </div>
                    <div className="space-y-2 border-l pl-4">
                      <label className="block text-[10px] font-bold uppercase text-gray-400">Obranný bonus (kostky)</label>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] w-12">Všechny:</span>
                        <input type="number" className="w-full border p-1 rounded" value={o.diceModifierDefense || 0} onChange={e => updateOverlay({ ...o, diceModifierDefense: parseInt(e.target.value) || 0 })} />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] w-12">Ign. vlajek:</span>
                        <input type="number" className="w-full border p-1 rounded" value={o.ignoreFlags || 0} onChange={e => updateOverlay({ ...o, ignoreFlags: parseInt(e.target.value) || 0 })} />
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
                <div key={c.id} className="flex gap-2 p-2 border-2 border-gray-100 rounded bg-white items-center shadow-sm">
                  <input className="flex-1 font-bold outline-none border-b-2 border-transparent focus:border-map-ink-blue" value={c.name} onChange={e => updateCountry({ ...c, name: e.target.value })} />
                  <button onClick={() => deleteItem('countries', setCountries, countries, c.id)} className="text-red-600 p-2"><Trash2 size={16} /></button>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'campaigns' && (
          <section className="animate-in fade-in duration-300">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold uppercase text-map-ink-blue">Kampaně</h2>
              <button onClick={addCampaign} className="bg-map-ink-green text-white px-4 py-2 rounded flex items-center gap-2 text-xs font-bold uppercase shadow-sm hover:scale-105 transition-transform"><Plus size={16} /> Přidat kampaň</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {campaigns.map((c, idx) => (
                <div key={c.id} className="flex gap-2 p-2 border-2 border-gray-100 rounded bg-white items-center shadow-sm">
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
