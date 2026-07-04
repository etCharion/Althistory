import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, Sword, Settings, Plus, Info, Globe, Wifi, HelpCircle, Maximize2, X, ChevronDown, Target, Bot } from 'lucide-react';
import ScenarioEditor from './ClassicScenarioEditor';
import GameView from './ClassicGameView';
import Customization from './ClassicCustomization';
import { getAllScenarios, getAllCountries, getAllCampaigns, getScenarioCountryIds, getScenarioCountryNames } from '../data/typeUtils';
import { ThemeToggle } from '../theme';

// A dropdown that lets the user filter by one or more countries at once.
function MultiCountryFilter({ countries, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const label =
    selected.length === 0
      ? 'Všechny země'
      : selected.length === 1
        ? (countries.find(c => c.id === selected[0])?.name || '1 země')
        : `${selected.length} zemí`;
  const toggle = (id) =>
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full p-2 border rounded text-[10px] font-bold uppercase outline-none focus:border-map-ink-blue bg-white flex items-center justify-between gap-1"
      >
        <span className="truncate">{label}</span>
        <ChevronDown size={12} className="shrink-0" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-white border-2 border-map-ink-blue rounded-lg shadow-xl custom-scrollbar">
            <button
              type="button"
              onClick={() => onChange([])}
              className="w-full text-left px-3 py-2 text-[10px] font-bold uppercase hover:bg-map-ink-blue/10 border-b border-gray-100"
            >
              Všechny země
            </button>
            {countries.map(c => (
              <label
                key={c.id}
                className="flex items-center gap-2 px-3 py-2 text-[10px] font-bold uppercase hover:bg-map-ink-blue/10 cursor-pointer"
              >
                <input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggle(c.id)} />
                <span className="truncate">{c.name}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// A single operation/scenario card, reused in both the compact list and the
// full-screen browser overlay.
function ScenarioCard({ s, countries, campaigns, onLocal, onVsAi, onOnline }) {
  const [showOnlineHelp, setShowOnlineHelp] = useState(false);
  // Výběr strany hráče pro hru proti počítači (AI dostane tu druhou).
  const [showSidePick, setShowSidePick] = useState(false);
  // Volba pravidla pro tuto partii. Doplní se do scénáře až při spuštění hry.
  const [logisticsLimit, setLogisticsLimit] = useState(false);
  // Sloučení distribučních fází – pro stranu ovládanou jediným hráčem klik na
  // jednotku přidělí zdroj rovnou ze skladu (méně klikání).
  const [mergedDistribution, setMergedDistribution] = useState(false);
  const configured = { ...s, logisticsLimit, mergedDistribution };
  return (
    <div className="p-4 border-2 border-gray-100 rounded-xl bg-white hover:border-map-ink-blue transition-all group shadow-sm flex flex-col">
      <div className="flex justify-between items-start mb-2 gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold uppercase text-map-ink-blue">{s.name}</h3>
            {s.isRealBattle && <span className="bg-red-100 text-red-600 text-[8px] px-1 rounded font-bold uppercase">Historická</span>}
          </div>
          <div className="flex gap-2 text-[9px] text-gray-500 font-bold uppercase mt-1">
            <span>{getScenarioCountryNames(s, countries) || 'Neznámá země'}</span>
            <span>•</span>
            <span>{s.year || '????'}</span>
          </div>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <button
            onClick={() => onLocal(configured)}
            className="bg-map-ink-green text-white px-6 py-2 rounded-lg font-bold uppercase hover:bg-opacity-90 transition-transform active:scale-95 shadow-md flex items-center gap-2"
          >
            Místní hra
          </button>
          <div className="relative">
            <button
              onClick={() => setShowSidePick(o => !o)}
              title="Hra proti počítači — vyberte si stranu, té druhé velí počítač."
              className="w-full border-2 border-map-ink-green text-map-ink-green px-6 py-2 rounded-lg font-bold uppercase text-[10px] hover:bg-map-ink-green hover:text-white transition-all shadow-md flex items-center justify-center gap-2"
            >
              <Bot size={12} /> Proti PC
            </button>
            {showSidePick && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowSidePick(false)} />
                <div className="absolute top-full right-0 mt-1 w-44 p-2 bg-white border-2 border-map-ink-green rounded-lg shadow-2xl z-20 flex flex-col gap-1.5">
                  <div className="text-[9px] font-bold uppercase text-gray-500 text-center tracking-wide">Hrát za stranu</div>
                  <button
                    onClick={() => { setShowSidePick(false); onVsAi(configured, 'player2'); }}
                    className="w-full py-1.5 rounded border-2 border-blue-600 text-blue-700 font-bold uppercase text-[10px] hover:bg-blue-600 hover:text-white transition-all"
                  >
                    {s.player1?.name || 'Spojenci'}
                  </button>
                  <button
                    onClick={() => { setShowSidePick(false); onVsAi(configured, 'player1'); }}
                    className="w-full py-1.5 rounded border-2 border-red-600 text-red-700 font-bold uppercase text-[10px] hover:bg-red-600 hover:text-white transition-all"
                  >
                    {s.player2?.name || 'Osa'}
                  </button>
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onOnline(configured)}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg font-bold uppercase text-[10px] hover:bg-blue-700 transition-all shadow-md flex items-center justify-center gap-2"
            >
              <Wifi size={12} /> Online hra
            </button>
            <button
              onMouseEnter={() => setShowOnlineHelp(true)}
              onMouseLeave={() => setShowOnlineHelp(false)}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors relative"
            >
              <HelpCircle size={16} />
              {showOnlineHelp && (
                <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-white border-2 border-blue-600 rounded-xl shadow-2xl z-[100] normal-case font-bold text-xs text-slate-700 animate-in fade-in slide-in-from-bottom-2">
                  Online hra se ukládá do cloudu a synchronizuje v reálném čase. Po spuštění stačí zkopírovat URL adresu z prohlížeče a poslat ji spoluhráči.
                </div>
              )}
            </button>
          </div>
          <label className="flex items-center gap-1.5 cursor-pointer select-none mt-0.5" title="Každý zdroj do sekce, která už má 4 zdroje, stojí ze skladu 2 zdroje. Nadlimitní zdroje jsou barevně odlišené.">
            <input
              type="checkbox"
              className="w-3.5 h-3.5 accent-map-ink-blue flex-shrink-0"
              checked={logisticsLimit}
              onChange={e => setLogisticsLimit(e.target.checked)}
            />
            <span className="text-[9px] font-bold uppercase text-gray-600 tracking-wide">Logistické omezení</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer select-none mt-0.5" title="Fáze rozdělení do sekcí a přidělení jednotkám splynou v jednu: klik na jednotku jí přidělí zdroj rovnou ze skladu. Platí pro stranu ovládanou jediným hráčem; kde je na straně víc velitelů, zůstávají obě fáze.">
            <input
              type="checkbox"
              className="w-3.5 h-3.5 accent-map-ink-blue flex-shrink-0"
              checked={mergedDistribution}
              onChange={e => setMergedDistribution(e.target.checked)}
            />
            <span className="text-[9px] font-bold uppercase text-gray-600 tracking-wide">Sloučit distribuční fáze</span>
          </label>
        </div>
      </div>
      {s.campaignId && (
        <div className="text-[9px] bg-gray-50 p-1 rounded inline-flex items-center gap-1 font-bold text-gray-600 uppercase self-start">
          <Globe size={10} /> {campaigns.find(c => c.id === s.campaignId)?.name} (Fáze {s.campaignNumber})
        </div>
      )}
      {s.description && (
        <div className="mt-2 text-[10px] text-gray-400 italic line-clamp-1 group-hover:line-clamp-none transition-all">
          {s.description}
        </div>
      )}
      {s.victoryGoals && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <div className="text-[9px] font-bold uppercase text-map-ink-blue flex items-center gap-1 mb-1">
            <Target size={10} /> Cíle vítězství
          </div>
          <div className="text-[10px] text-gray-500 whitespace-pre-line line-clamp-2 group-hover:line-clamp-none transition-all">
            {s.victoryGoals}
          </div>
        </div>
      )}
    </div>
  );
}

function MainMenu() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('menu');
  const [scenarios, setScenarios] = useState([]);
  const [countries, setCountries] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [currentScenario, setCurrentScenario] = useState(null);
  const [editingScenario, setEditingScenario] = useState(null);

  // Filter & Sort State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCountries, setFilterCountries] = useState<string[]>([]);
  const [filterCampaign, setFilterCampaign] = useState('all');
  const [filterReal, setFilterReal] = useState('all');
  const [sortBy, setSortBy] = useState('name');

  useEffect(() => {
    const load = async () => {
      const [s, c, cp] = await Promise.all([
        getAllScenarios(),
        getAllCountries(),
        getAllCampaigns()
      ]);
      setScenarios(s);
      setCountries(c);
      setCampaigns(cp);
    };
    load();
  }, [mode]);

  const filteredScenarios = useMemo(() => {
    return scenarios
      .filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCountry = filterCountries.length === 0 || getScenarioCountryIds(s).some(id => filterCountries.includes(id));
        const matchesCampaign = filterCampaign === 'all' || s.campaignId === filterCampaign;
        const matchesReal = filterReal === 'all' || (filterReal === 'real' ? s.isRealBattle : !s.isRealBattle);
        return matchesSearch && matchesCountry && matchesCampaign && matchesReal;
      })
      .sort((a, b) => {
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        if (sortBy === 'year') return (a.year || 0) - (b.year || 0);
        if (sortBy === 'campaign') {
          const campA = a.campaignId || '';
          const campB = b.campaignId || '';
          if (campA !== campB) return campA.localeCompare(campB);
          return (a.campaignNumber || 0) - (b.campaignNumber || 0);
        }
        return 0;
      });
  }, [scenarios, searchTerm, filterCountries, filterCampaign, filterReal, sortBy]);

  const handleEditScenario = (s) => {
    setEditingScenario(s);
    setMode('editor');
  };

  const handleNewScenario = () => {
    setEditingScenario(null);
    setMode('editor');
  };

  const [showBrowser, setShowBrowser] = useState(false);

  // Hra proti počítači je lokální hra, kde jednu stranu řídí AI; hráč si
  // při spuštění vybírá, které straně velí.
  const [aiSide, setAiSide] = useState<'player1' | 'player2' | null>(null);

  const startLocalGame = (scenario, aiPlayerId: 'player1' | 'player2' | null = null) => {
    setCurrentScenario(scenario);
    setAiSide(aiPlayerId);
    setShowBrowser(false);
    setMode('game');
  };

  const startOnlineGame = (scenario) => {
    const gameId = `game-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    localStorage.setItem('lastGameId', gameId);
    navigate(`/game/${gameId}`, { state: { scenario } });
  };

  const [lastGameId, setLastGameId] = useState<string | null>(null);
  useEffect(() => {
    setLastGameId(localStorage.getItem('lastGameId'));
  }, []);

  if (mode === 'editor') return <ScenarioEditor onBack={() => setMode('menu')} initialScenario={editingScenario} />;
  if (mode === 'custom') return <Customization onBack={() => setMode('menu')} onEditScenario={handleEditScenario} />;
  if (mode === 'game' && currentScenario) return <GameView scenario={currentScenario} aiPlayerId={aiSide} onExit={() => setMode('menu')} />;

  // Search + filter controls, reused in the compact list and the full-screen browser.
  const filterControls = (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input
          className="w-full pl-10 pr-4 py-2 border-2 border-gray-100 rounded-lg focus:border-map-ink-blue outline-none font-bold"
          placeholder="Hledat operaci..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <MultiCountryFilter countries={countries} selected={filterCountries} onChange={setFilterCountries} />
        <select className="p-2 border rounded text-[10px] font-bold uppercase outline-none focus:border-map-ink-blue" value={filterCampaign} onChange={e => setFilterCampaign(e.target.value)}>
          <option value="all">Všechny kampaně</option>
          {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="p-2 border rounded text-[10px] font-bold uppercase outline-none focus:border-map-ink-blue" value={filterReal} onChange={e => setFilterReal(e.target.value)}>
          <option value="all">Typ bitvy</option>
          <option value="real">Reálná</option>
          <option value="fictional">Fiktivní</option>
        </select>
        <select className="p-2 border rounded text-[10px] font-bold uppercase outline-none focus:border-map-ink-blue" value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="name">Podle názvu</option>
          <option value="year">Podle roku</option>
          <option value="campaign">Podle kampaně</option>
        </select>
      </div>
    </div>
  );

  const emptyState = (
    <div className="text-center py-10 text-gray-400 italic">
      <Info className="mx-auto mb-2 opacity-20" size={32} />
      Žádné operace neodpovídají filtrům.
    </div>
  );

  return (
    <div className="min-h-screen bg-map-paper flex flex-col items-center justify-center p-4 font-military overflow-y-auto">
      <div className="max-w-2xl w-full bg-white/90 p-6 md:p-10 rounded-xl shadow-2xl border-2 border-map-ink-blue">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-map-ink-blue font-handwriting uppercase tracking-widest flex items-center justify-center gap-3">
            <Sword size={32} /> Memoir '44 Clone
          </h1>
          <p className="text-xs text-gray-500 uppercase tracking-tighter mt-2 font-bold">Generální štáb - Plánování operací</p>
          <div className="flex justify-center mt-4"><ThemeToggle /></div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <button
            onClick={handleNewScenario}
            className="bg-map-ink-blue text-white py-4 rounded-lg font-bold uppercase hover:bg-opacity-90 transition-all shadow-lg flex items-center justify-center gap-2 group"
          >
            <Plus className="group-hover:rotate-90 transition-transform" /> Nový scénář
          </button>
          <button
            onClick={() => setMode('custom')}
            className="border-2 border-map-ink-blue text-map-ink-blue py-4 rounded-lg font-bold uppercase hover:bg-map-ink-blue hover:text-white transition-all shadow-md flex items-center justify-center gap-2"
          >
            <Settings /> Nastavení
          </button>
        </div>

        {lastGameId && (
          <button
            onClick={() => navigate(`/game/${lastGameId}`)}
            className="w-full mb-8 bg-blue-50 text-blue-700 py-3 rounded-lg font-black uppercase border-2 border-blue-200 hover:bg-blue-100 transition-all flex items-center justify-center gap-2"
          >
            <Wifi size={18} /> Pokračovat v online hře
          </button>
        )}

        <div className="pt-6 border-t-2 border-map-ink-blue/20">
          <div className="mb-6">{filterControls}</div>

          <div className="flex items-center justify-between mb-4 gap-2">
            <h2 className="text-sm font-bold uppercase text-map-ink-blue tracking-widest flex items-center gap-2">
              <Filter size={14} /> Dostupné operace ({filteredScenarios.length}):
            </h2>
            <button
              onClick={() => setShowBrowser(true)}
              className="text-[10px] font-bold uppercase text-map-ink-blue border-2 border-map-ink-blue/30 px-3 py-1.5 rounded-lg hover:bg-map-ink-blue hover:text-white transition-all flex items-center gap-1.5 shrink-0"
            >
              <Maximize2 size={12} /> Velký přehled
            </button>
          </div>

          <div className="space-y-3 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
            {filteredScenarios.map(s => (
              <ScenarioCard key={s.id} s={s} countries={countries} campaigns={campaigns} onLocal={(sc) => startLocalGame(sc)} onVsAi={startLocalGame} onOnline={startOnlineGame} />
            ))}
            {filteredScenarios.length === 0 && emptyState}
          </div>
        </div>
      </div>

      {showBrowser && (
        <div className="fixed inset-0 z-50 bg-map-paper/95 backdrop-blur-sm flex flex-col font-military animate-in fade-in">
          <div className="border-b-2 border-map-ink-blue bg-white/90 shadow-md">
            <div className="max-w-7xl mx-auto w-full px-4 md:px-8 py-4 flex items-center justify-between gap-4">
              <h2 className="text-xl md:text-2xl font-bold text-map-ink-blue font-handwriting uppercase tracking-widest flex items-center gap-2 md:gap-3">
                <Sword size={24} /> Přehled operací
                <span className="text-xs font-military text-gray-500 normal-case tracking-normal">({filteredScenarios.length})</span>
              </h2>
              <button
                onClick={() => setShowBrowser(false)}
                className="p-2 rounded-full text-map-ink-blue hover:bg-map-ink-blue hover:text-white transition-colors border-2 border-map-ink-blue/30"
                aria-label="Zavřít přehled"
              >
                <X size={22} />
              </button>
            </div>
            <div className="max-w-7xl mx-auto w-full px-4 md:px-8 pb-4">{filterControls}</div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="max-w-7xl mx-auto w-full px-4 md:px-8 py-6">
              {filteredScenarios.length === 0 ? emptyState : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredScenarios.map(s => (
                    <ScenarioCard key={s.id} s={s} countries={countries} campaigns={campaigns} onLocal={(sc) => startLocalGame(sc)} onVsAi={startLocalGame} onOnline={startOnlineGame} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MainMenu;
