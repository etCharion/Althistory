import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Sword, Settings, Plus, Info, Globe, Wifi, HelpCircle, ChevronDown, Target, Play, Bot } from 'lucide-react';
import ScenarioEditor from './ScenarioEditor';
import GameView from './GameView';
import Customization from './Customization';
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
        className="w-full px-3 py-2.5 border-2 border-tan-line rounded-[10px] text-[12px] font-condensed font-bold uppercase tracking-wide outline-none focus:border-ally bg-white flex items-center justify-between gap-1 text-ink"
      >
        <span className="truncate">{label}</span>
        <ChevronDown size={14} className="shrink-0 text-tan" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-white border-2 border-ally rounded-lg shadow-xl custom-scrollbar">
            <button
              type="button"
              onClick={() => onChange([])}
              className="w-full text-left px-3 py-2 text-[11px] font-condensed font-bold uppercase hover:bg-ally/10 border-b border-tan-border/50"
            >
              Všechny země
            </button>
            {countries.map(c => (
              <label
                key={c.id}
                className="flex items-center gap-2 px-3 py-2 text-[11px] font-condensed font-bold uppercase hover:bg-ally/10 cursor-pointer"
              >
                <input type="checkbox" className="accent-ally" checked={selected.includes(c.id)} onChange={() => toggle(c.id)} />
                <span className="truncate">{c.name}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const SELECT_CLASS =
  "px-3 py-2.5 border-2 border-tan-line rounded-[10px] text-[12px] font-condensed font-bold uppercase tracking-wide outline-none focus:border-ally bg-white text-ink cursor-pointer";

// A single operation/scenario card in the field-map menu grid.
function ScenarioCard({ s, countries, campaigns, onLocal, onVsAi, onOnline }) {
  const [showOnlineHelp, setShowOnlineHelp] = useState(false);
  // Výběr strany hráče pro hru proti počítači (AI dostane tu druhou).
  const [showSidePick, setShowSidePick] = useState(false);
  // Volba pravidla pro tuto partii. Doplní se do scénáře až při spuštění hry.
  const [logisticsLimit, setLogisticsLimit] = useState(false);
  const configured = { ...s, logisticsLimit };
  return (
    <div className="bg-parchment-card border-2 border-tan-border rounded-[15px] p-[18px_19px] flex flex-col shadow-[0_12px_30px_-22px_rgba(60,45,20,0.55)] hover:border-ally transition-colors">
      <div className="flex items-start justify-between gap-2.5 mb-[7px]">
        <h3 className="m-0 font-condensed font-extrabold text-[23px] leading-tight tracking-tight text-ally uppercase">{s.name}</h3>
        {s.isRealBattle && (
          <span className="shrink-0 bg-[#f3dada] text-[#a3382b] font-condensed font-extrabold text-[10px] tracking-[0.1em] uppercase px-2 py-1 rounded-md">Historická</span>
        )}
      </div>
      <div className="flex gap-2 font-condensed font-bold text-[12px] tracking-[0.08em] uppercase text-tan mb-2.5">
        <span>{getScenarioCountryNames(s, countries) || 'Neznámá země'}</span>
        <span>·</span>
        <span>{s.year || '????'}</span>
      </div>
      {s.campaignId && (
        <div className="text-[10px] mb-2 bg-[#f4ecd7] px-2 py-1 rounded-md inline-flex items-center gap-1 font-condensed font-bold text-tan-text uppercase self-start">
          <Globe size={11} /> {campaigns.find(c => c.id === s.campaignId)?.name} (Fáze {s.campaignNumber})
        </div>
      )}
      {s.description && (
        <p className="m-0 mb-3 text-[13px] leading-[1.5] text-tan-text">{s.description}</p>
      )}
      {s.victoryGoals && (
        <div className="mt-auto p-[10px_12px] bg-[#f4ecd7] rounded-[10px] mb-[13px]">
          <div className="flex items-center gap-1.5 font-condensed font-extrabold text-[11px] tracking-[0.1em] uppercase text-ally mb-1">
            <Target size={12} /> Cíle vítězství
          </div>
          <span className="text-[12px] leading-[1.4] text-[#7a6f55] whitespace-pre-line">{s.victoryGoals}</span>
        </div>
      )}
      <label className={`flex items-center gap-2.5 mb-2.5 cursor-pointer select-none ${s.victoryGoals ? '' : 'mt-auto'}`}>
        <input
          type="checkbox"
          className="w-4 h-4 accent-ally flex-shrink-0"
          checked={logisticsLimit}
          onChange={e => setLogisticsLimit(e.target.checked)}
        />
        <span className="font-condensed font-bold text-[12px] uppercase tracking-[0.04em] text-tan-deep" title="Každý zdroj do sekce, která už má 4 zdroje, stojí ze skladu 2 zdroje. Nadlimitní zdroje jsou barevně odlišené.">
          Logistické omezení
        </span>
      </label>
      <div className="flex gap-2.5">
        <button
          onClick={() => onLocal(configured)}
          className="flex-1 flex items-center justify-center gap-1.5 py-[11px] rounded-[10px] bg-army text-white font-condensed font-extrabold text-[14px] tracking-[0.05em] uppercase hover:bg-opacity-90 transition-all active:scale-95"
        >
          <Play size={15} fill="currentColor" strokeWidth={0} /> Místní hra
        </button>
        <div className="relative">
          <button
            onClick={() => setShowSidePick(o => !o)}
            title="Hra proti počítači — vyberte si stranu, té druhé velí počítač."
            className="h-full flex items-center justify-center gap-1.5 py-[11px] px-[13px] rounded-[10px] border-2 border-army bg-army/[0.08] text-army font-condensed font-extrabold text-[13px] tracking-[0.04em] uppercase hover:bg-army hover:text-white transition-colors"
          >
            <Bot size={15} /> Proti PC
          </button>
          {showSidePick && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowSidePick(false)} />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2.5 bg-white border-2 border-army rounded-xl shadow-2xl z-20 flex flex-col gap-1.5">
                <div className="text-[10px] font-condensed font-extrabold uppercase tracking-[0.12em] text-tan text-center mb-0.5">Hrát za stranu</div>
                <button
                  onClick={() => { setShowSidePick(false); onVsAi(configured, 'player2'); }}
                  className="w-full py-2 rounded-lg border-2 border-ally text-ally font-condensed font-extrabold text-[12px] uppercase tracking-[0.04em] hover:bg-ally hover:text-white transition-colors"
                >
                  {s.player1?.name || 'Spojenci'}
                </button>
                <button
                  onClick={() => { setShowSidePick(false); onVsAi(configured, 'player1'); }}
                  className="w-full py-2 rounded-lg border-2 border-army text-army font-condensed font-extrabold text-[12px] uppercase tracking-[0.04em] hover:bg-army hover:text-white transition-colors"
                >
                  {s.player2?.name || 'Osa'}
                </button>
              </div>
            </>
          )}
        </div>
        <button
          onClick={() => onOnline(configured)}
          className="flex items-center justify-center gap-1.5 py-[11px] px-[15px] rounded-[10px] border-2 border-ally-soft bg-ally-soft/[0.08] text-ally-soft font-condensed font-extrabold text-[13px] tracking-[0.04em] uppercase hover:bg-ally-soft hover:text-white transition-colors"
        >
          <Wifi size={15} /> Online
        </button>
        <button
          onMouseEnter={() => setShowOnlineHelp(true)}
          onMouseLeave={() => setShowOnlineHelp(false)}
          className="p-2 text-ally-soft hover:bg-ally-soft/10 rounded-full transition-colors relative"
          aria-label="Nápověda k online hře"
        >
          <HelpCircle size={16} />
          {showOnlineHelp && (
            <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-white border-2 border-ally-soft rounded-xl shadow-2xl z-[100] normal-case font-semibold text-xs text-slate-700 text-left">
              Online hra se ukládá do cloudu a synchronizuje v reálném čase. Po spuštění stačí zkopírovat URL adresu z prohlížeče a poslat ji spoluhráči.
            </div>
          )}
        </button>
      </div>
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

  // Hra proti počítači je lokální hra, kde jednu stranu řídí AI (viz
  // docs/AI-STRATEGY.md); hráč si při spuštění vybírá, které straně velí.
  // Volba se drží mimo scénář, aby se neukládala.
  const [aiSide, setAiSide] = useState<'player1' | 'player2' | null>(null);

  const startLocalGame = (scenario, aiPlayerId: 'player1' | 'player2' | null = null) => {
    setCurrentScenario(scenario);
    setAiSide(aiPlayerId);
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

  return (
    <div className="min-h-screen text-ink">
      <div className="max-w-[1180px] mx-auto px-7 pt-[38px] pb-[72px]">
        {/* Header */}
        <div className="flex items-center gap-[15px] mb-[30px] flex-wrap">
          <div className="w-[54px] h-[54px] rounded-[14px] bg-ally flex items-center justify-center shadow-[0_10px_24px_-10px_rgba(28,40,60,0.6)] shrink-0">
            <Sword size={30} className="text-white" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <div className="font-condensed font-extrabold text-[12px] tracking-[0.34em] uppercase text-tan">Generální štáb · Plánování operací</div>
            <h1 className="m-0 font-condensed font-extrabold text-[42px] leading-none tracking-tight text-ink">ALTHISTORY</h1>
          </div>
          <ThemeToggle />
          <div className="flex gap-3">
            <button
              onClick={handleNewScenario}
              className="flex items-center gap-2 px-5 py-[13px] rounded-[12px] bg-ally text-white font-condensed font-extrabold text-[15px] tracking-[0.05em] uppercase hover:opacity-90 transition-opacity shadow-[0_8px_20px_-10px_rgba(28,40,60,0.65)]"
            >
              <Plus size={17} strokeWidth={2.4} /> Nový scénář
            </button>
            <button
              onClick={() => setMode('custom')}
              className="flex items-center gap-2 px-5 py-[13px] rounded-[12px] border-2 border-ally bg-white/50 text-ally font-condensed font-extrabold text-[15px] tracking-[0.05em] uppercase hover:bg-ally hover:text-white transition-colors"
            >
              <Settings size={17} /> Nastavení
            </button>
          </div>
        </div>

        {/* Search + filters */}
        <div className="bg-[rgba(255,253,247,0.85)] border border-tan-border-soft rounded-[15px] p-[16px_18px] mb-[22px] shadow-[0_14px_34px_-22px_rgba(60,45,20,0.5)]">
          <div className="flex gap-3 flex-wrap items-center">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-[13px] top-1/2 -translate-y-1/2 text-tan" size={17} />
              <input
                className="w-full pl-[38px] pr-[14px] py-[11px] border-2 border-tan-line rounded-[10px] bg-white font-semibold text-[14px] text-ink outline-none focus:border-ally"
                placeholder="Hledat operaci…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <MultiCountryFilter countries={countries} selected={filterCountries} onChange={setFilterCountries} />
            <select className={SELECT_CLASS} value={filterCampaign} onChange={e => setFilterCampaign(e.target.value)}>
              <option value="all">Všechny kampaně</option>
              {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className={SELECT_CLASS} value={filterReal} onChange={e => setFilterReal(e.target.value)}>
              <option value="all">Typ bitvy</option>
              <option value="real">Reálná</option>
              <option value="fictional">Fiktivní</option>
            </select>
            <select className={SELECT_CLASS} value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="name">Podle názvu</option>
              <option value="year">Podle roku</option>
              <option value="campaign">Podle kampaně</option>
            </select>
            <div className="flex items-center gap-2.5 font-condensed font-bold text-[13px] tracking-[0.06em] uppercase text-tan-deep">
              <Target size={15} />
              <span className="bg-ally/[0.08] text-ally rounded-lg px-3 py-1.5">{filteredScenarios.length} operací</span>
            </div>
          </div>
        </div>

        {lastGameId && (
          <button
            onClick={() => navigate(`/game/${lastGameId}`)}
            className="w-full mb-[22px] flex items-center justify-center gap-2 py-3 rounded-[12px] bg-ally-soft/[0.08] border-2 border-ally-soft/30 text-ally-soft font-condensed font-extrabold uppercase tracking-[0.05em] hover:bg-ally-soft hover:text-white transition-colors"
          >
            <Wifi size={18} /> Pokračovat v online hře
          </button>
        )}

        {/* Scenario grid */}
        {filteredScenarios.length === 0 ? (
          <div className="text-center py-16 text-tan italic font-medium">
            <Info className="mx-auto mb-2 opacity-30" size={32} />
            Žádné operace neodpovídají filtrům.
          </div>
        ) : (
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
            {filteredScenarios.map(s => (
              <ScenarioCard key={s.id} s={s} countries={countries} campaigns={campaigns} onLocal={(sc) => startLocalGame(sc)} onVsAi={startLocalGame} onOnline={startOnlineGame} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default MainMenu;
