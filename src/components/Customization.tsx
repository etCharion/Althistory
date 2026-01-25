import React, { useState, useEffect } from 'react';
import { Trash2, Plus, Edit2 } from 'lucide-react';
import { DEFAULT_UNIT_TYPES, DEFAULT_TERRAIN_TYPES, DEFAULT_COUNTRIES } from '../data/defaults';
import { getAllUnitTypes, getAllTerrainTypes, getAllCountries, getAllCampaigns, getAllScenarios } from '../data/typeUtils';

const Customization = ({ onBack, onEditScenario }) => {
  const [units, setUnits] = useState([]);
  const [terrains, setTerrains] = useState([]);
  const [countries, setCountries] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [scenarios, setScenarios] = useState([]);
  const [activeTab, setActiveTab] = useState('scenarios');

  useEffect(() => {
    setUnits(getAllUnitTypes());
    setTerrains(getAllTerrainTypes());
    setCountries(getAllCountries());
    setCampaigns(getAllCampaigns());
    setScenarios(getAllScenarios());
  }, []);

  const saveUnits = (val) => { setUnits(val); localStorage.setItem('customUnitTypes', JSON.stringify(val)); };
  const saveTerrains = (val) => { setTerrains(val); localStorage.setItem('customTerrainTypes', JSON.stringify(val)); };
  const saveCountries = (val) => { setCountries(val); localStorage.setItem('customCountries', JSON.stringify(val)); };
  const saveCampaigns = (val) => { setCampaigns(val); localStorage.setItem('customCampaigns', JSON.stringify(val)); };
  const saveScenarios = (val) => { setScenarios(val); localStorage.setItem('scenarios', JSON.stringify(val)); };

  const addUnit = () => {
    const newUnit = { id: `unit-${Date.now()}`, name: 'Nová jednotka', movement: 2, shootingRange: [3, 2, 1], canShootAfterMovingMax: 1, maxFigures: 4, natoSymbol: 'infantry' };
    saveUnits([...units, newUnit]);
  };

  const addTerrain = () => {
    const newTerrain = { id: `terrain-${Date.now()}`, name: 'Nový terén', blocksLOS: false, diceModifierDefenseInfantry: 0, diceModifierDefenseTank: 0, diceModifierAttackInfantry: 0, diceModifierAttackTank: 0, color: '#cccccc', description: '' };
    saveTerrains([...terrains, newTerrain]);
  };

  const addCountry = () => {
    const newCountry = { id: `country-${Date.now()}`, name: 'Nová země' };
    saveCountries([...countries, newCountry]);
  };

  const addCampaign = () => {
    const newCampaign = { id: `campaign-${Date.now()}`, name: 'Nová kampaň' };
    saveCampaigns([...campaigns, newCampaign]);
  };

  const deleteItem = (setter, list, id, storageKey, isScenario = false) => {
    if (isScenario && id === 'default-1') {
      alert('Výchozí scénář nelze smazat.');
      return;
    }
    if (!confirm('Opravdu smazat?')) return;
    const newList = list.filter(item => item.id !== id);
    setter(newList);
    localStorage.setItem(storageKey, JSON.stringify(newList));
  };

  return (
    <div className="min-h-screen bg-map-paper p-4 md:p-8 font-military overflow-y-auto">
      <div className="max-w-6xl mx-auto bg-white/90 p-4 md:p-8 rounded shadow-2xl border-2 border-map-ink-blue">
        <div className="flex justify-between items-center mb-8 border-b-2 border-map-ink-blue pb-4">
          <h1 className="text-3xl font-bold font-handwriting uppercase tracking-widest text-map-ink-blue">Administrace</h1>
          <button onClick={onBack} className="bg-map-ink-blue text-white px-6 py-2 rounded uppercase font-bold text-sm hover:bg-opacity-90 transition-all shadow-md">Zpět</button>
        </div>

        <div className="flex flex-wrap gap-2 mb-8">
          {['scenarios', 'units', 'terrains', 'countries', 'campaigns'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded font-bold uppercase text-xs transition-all ${activeTab === tab ? 'bg-map-ink-blue text-white shadow-md scale-105' : 'bg-white text-map-ink-blue border border-map-ink-blue hover:bg-map-ink-blue/10'}`}
            >
              {tab === 'scenarios' ? 'Scénáře' : tab === 'units' ? 'Jednotky' : tab === 'terrains' ? 'Terén' : tab === 'countries' ? 'Země' : 'Kampaně'}
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
                      <button onClick={() => deleteItem(setScenarios, scenarios, s.id, 'scenarios', true)} className="bg-red-600 text-white p-2 rounded hover:bg-opacity-90 transition-all"><Trash2 size={14} /></button>
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
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="md:col-span-2">
                      <label className="text-[10px] font-bold uppercase text-gray-400">Název jednotky</label>
                      <input className="w-full border-b-2 border-gray-100 focus:border-map-ink-blue outline-none py-1 font-bold text-lg" value={u.name} onChange={e => { const n = [...units]; n[idx].name = e.target.value; saveUnits(n); }} />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-gray-400">NATO Symbol</label>
                      <select className="w-full border-b-2 border-gray-100 focus:border-map-ink-blue outline-none py-1 font-bold" value={u.natoSymbol} onChange={e => { const n = [...units]; n[idx].natoSymbol = e.target.value; saveUnits(n); }}>
                        <option value="infantry">Pěchota</option>
                        <option value="tank">Tank</option>
                        <option value="artillery">Dělostřelectvo</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-gray-400">Pohyb</label>
                      <input type="number" className="w-full border p-1 rounded mt-1" value={u.movement} onChange={e => { const n = [...units]; n[idx].movement = parseInt(e.target.value) || 0; saveUnits(n); }} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-gray-400">Max Figurek</label>
                      <input type="number" className="w-full border p-1 rounded mt-1" value={u.maxFigures} onChange={e => { const n = [...units]; n[idx].maxFigures = parseInt(e.target.value) || 0; saveUnits(n); }} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-gray-400">Max pohyb pro střelbu</label>
                      <input type="number" className="w-full border p-1 rounded mt-1" value={u.canShootAfterMovingMax} onChange={e => { const n = [...units]; n[idx].canShootAfterMovingMax = parseInt(e.target.value) || 0; saveUnits(n); }} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-gray-400">Dostřel (oddělený čárkou)</label>
                      <input className="w-full border p-1 rounded mt-1" value={u.shootingRange.join(',')} onChange={e => { const n = [...units]; n[idx].shootingRange = e.target.value.split(',').map(v => parseInt(v.trim()) || 0); saveUnits(n); }} />
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button onClick={() => deleteItem(setUnits, units, u.id, 'customUnitTypes')} className="text-red-600 hover:text-red-800 transition-colors flex items-center gap-1 text-[10px] font-bold uppercase"><Trash2 size={12} /> Smazat typ</button>
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
                      <input className="w-full border-b-2 border-gray-100 focus:border-map-ink-blue outline-none py-1 font-bold text-lg" value={t.name} onChange={e => { const n = [...terrains]; n[idx].name = e.target.value; saveTerrains(n); }} />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-gray-400">Barva (HEX)</label>
                      <div className="flex gap-2 items-center">
                        <div className="w-6 h-6 rounded border border-gray-300 shadow-inner" style={{ backgroundColor: t.color }}></div>
                        <input className="flex-1 border-b-2 border-gray-100 focus:border-map-ink-blue outline-none py-1 font-mono text-xs" value={t.color} onChange={e => { const n = [...terrains]; n[idx].color = e.target.value; saveTerrains(n); }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-4">
                      <input type="checkbox" id={`los-${t.id}`} checked={t.blocksLOS} onChange={e => { const n = [...terrains]; n[idx].blocksLOS = e.target.checked; saveTerrains(n); }} />
                      <label htmlFor={`los-${t.id}`} className="text-[10px] font-bold uppercase text-gray-600">Blokuje viditelnost</label>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs mb-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-gray-400">Omezení pohybu</label>
                      <select className="w-full border p-1 rounded mt-1" value={t.movementRestriction || 'none'} onChange={e => { const n = [...terrains]; n[idx].movementRestriction = e.target.value; saveTerrains(n); }}>
                        <option value="none">Žádné</option>
                        <option value="stop">Zastavit při vstupu</option>
                        <option value="no-move">Neprůchodné</option>
                      </select>
                    </div>
                    <div className="space-y-2 border-l pl-4">
                      <label className="block text-[10px] font-bold uppercase text-gray-400">Obranný bonus (kostky)</label>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] w-12">Inf:</span>
                        <input type="number" className="w-full border p-1 rounded" value={t.diceModifierDefenseInfantry} onChange={e => { const n = [...terrains]; n[idx].diceModifierDefenseInfantry = parseInt(e.target.value) || 0; saveTerrains(n); }} />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] w-12">Tank:</span>
                        <input type="number" className="w-full border p-1 rounded" value={t.diceModifierDefenseTank} onChange={e => { const n = [...terrains]; n[idx].diceModifierDefenseTank = parseInt(e.target.value) || 0; saveTerrains(n); }} />
                      </div>
                    </div>
                    <div className="space-y-2 border-l pl-4">
                      <label className="block text-[10px] font-bold uppercase text-gray-400">Postih k útoku (kostky)</label>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] w-12">Inf:</span>
                        <input type="number" className="w-full border p-1 rounded" value={t.diceModifierAttackInfantry} onChange={e => { const n = [...terrains]; n[idx].diceModifierAttackInfantry = parseInt(e.target.value) || 0; saveTerrains(n); }} />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] w-12">Tank:</span>
                        <input type="number" className="w-full border p-1 rounded" value={t.diceModifierAttackTank} onChange={e => { const n = [...terrains]; n[idx].diceModifierAttackTank = parseInt(e.target.value) || 0; saveTerrains(n); }} />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase text-gray-400">Popis</label>
                    <textarea className="w-full border p-2 rounded mt-1 text-xs" rows={2} value={t.description || ''} onChange={e => { const n = [...terrains]; n[idx].description = e.target.value; saveTerrains(n); }} />
                  </div>

                  <div className="mt-4 flex justify-end">
                    <button onClick={() => deleteItem(setTerrains, terrains, t.id, 'customTerrainTypes')} className="text-red-600 hover:text-red-800 transition-colors flex items-center gap-1 text-[10px] font-bold uppercase"><Trash2 size={12} /> Smazat typ</button>
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
                  <input className="flex-1 font-bold outline-none border-b-2 border-transparent focus:border-map-ink-blue" value={c.name} onChange={e => { const n = [...countries]; n[idx].name = e.target.value; saveCountries(n); }} />
                  <button onClick={() => deleteItem(setCountries, countries, c.id, 'customCountries')} className="text-red-600 p-2"><Trash2 size={16} /></button>
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
                  <input className="flex-1 font-bold outline-none border-b-2 border-transparent focus:border-map-ink-blue" value={c.name} onChange={e => { const n = [...campaigns]; n[idx].name = e.target.value; saveCampaigns(n); }} />
                  <button onClick={() => deleteItem(setCampaigns, campaigns, c.id, 'customCampaigns')} className="text-red-600 p-2"><Trash2 size={16} /></button>
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
