import React, { useState, useMemo, useEffect } from 'react'; import { useGameLogic } from '../hooks/useGameLogic'; import HexGrid from './HexGrid'; import DiceAnimation from './DiceAnimation'; import { getAllTerrainTypes, getAllUnitTypes, getAllOverlayTypes } from '../data/typeUtils'; import { getUnitSections, axialToOffset, getSection } from '../logic/hexGrid';
import NatoSymbol from './NatoSymbol';
import { Menu, Info, Star, Trophy, Target, TrendingUp, Move, Skull, X as CloseIcon, Copy, Check, Crown, Shield, Eye, EyeOff, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { getGameState } from '../logic/firebaseService';
import { controlsSection, isGeneral } from '../logic/gameReducer';

const ROLE_LABELS: Record<string, string> = { general: 'Generál', left: 'Levá sekce', center: 'Střed', right: 'Pravá sekce' };

const ResourceCube = () => (
  <div className="w-4 h-5 bg-green-600 border-2 border-green-800 rounded shadow-[0_2px_0_0_rgba(0,0,0,0.2)] animate-in zoom-in duration-300 flex-shrink-0" />
);

const Misticka = ({ count, active, warehouse = false, capacity = 12 }) => (
  <div className={`transition-all duration-500 ${active ? 'scale-105' : 'opacity-40'}`}>
    <div className={`${warehouse ? 'w-[240px]' : 'w-[140px]'} h-8 border-2 border-slate-800 rounded-lg flex items-center justify-center gap-1 px-2 bg-slate-100/50 backdrop-blur-sm shadow-inner overflow-hidden relative`}>
       <div className="flex gap-1 flex-wrap justify-center max-h-full py-0.5">
         {Array.from({ length: Math.min(count, capacity) }).map((_, i) => <ResourceCube key={i} />)}
       </div>
       {count > capacity && <span className="absolute right-1 bg-slate-800 text-white px-1.5 py-0.5 text-[8px] font-black rounded shadow-md border border-white">+{count-capacity}</span>}
       {count === 0 && <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black opacity-10 uppercase tracking-widest text-slate-900">PRÁZDNÉ</span>}
    </div>
  </div>
);

const StatisticsModal = ({ unitStats, scenario, unitTypes, onClose }) => {
  const stats = Object.values(unitStats) as any[];

  const sniper = stats.reduce((prev, curr) => (curr.damageDealt > (prev?.damageDealt || 0)) ? curr : prev, null);
  const legend = stats.reduce((prev, curr) => (curr.kills > (prev?.kills || 0)) ? curr : prev, null);
  const runner = stats.reduce((prev, curr) => (curr.distanceTraveled > (prev?.distanceTraveled || 0)) ? curr : prev, null);
  const ironWall = stats.reduce((prev, curr) => (curr.damageTaken > (prev?.damageTaken || 0)) ? curr : prev, null);

  const awards = [
    { id: 'sniper', title: 'Odstřelovač', description: 'Nejvíce udělených zásahů', unit: sniper, icon: <Target className="text-red-500" /> },
    { id: 'legend', title: 'Legenda', description: 'Nejvíce zničených nepřátel', unit: legend, icon: <Trophy className="text-yellow-500" /> },
    { id: 'runner', title: 'Maratonec', description: 'Největší uražená vzdálenost', unit: runner, icon: <Move className="text-blue-500" /> },
    { id: 'ironwall', title: 'Železná zeď', description: 'Nejvíce utržených zásahů', unit: ironWall, icon: <TrendingUp className="text-green-500" /> },
  ];

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[150] flex items-center justify-center p-8 overflow-hidden font-military">
      <div className="bg-white w-full max-w-5xl max-h-full flex flex-col rounded-3xl shadow-2xl border-4 border-slate-800 animate-in zoom-in duration-300">
        <div className="p-6 border-b-4 border-slate-800 flex justify-between items-center bg-slate-50 rounded-t-[1.4rem]">
          <h2 className="text-4xl font-black font-handwriting uppercase tracking-tighter text-slate-800 flex items-center gap-3">
             <Trophy size={40} /> Závěrečné Statistiky
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <CloseIcon size={32} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-12">
           <div className="grid grid-cols-4 gap-6">
              {awards.filter(a => a.unit && (a.id === 'runner' ? a.unit.distanceTraveled > 0 : (a.id === 'ironwall' ? a.unit.damageTaken > 0 : a.unit.damageDealt > 0 || a.unit.kills > 0))).map(award => (
                <div key={award.id} className="bg-slate-50 border-2 border-slate-200 p-6 rounded-2xl flex flex-col items-center text-center relative overflow-hidden group">
                   <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:scale-110 transition-transform">
                      {award.icon}
                   </div>
                   <div className="mb-4 bg-white p-4 rounded-full shadow-lg border-2 border-slate-100">
                      {award.icon}
                   </div>
                   <h4 className="font-black uppercase text-sm mb-1 tracking-widest">{award.title}</h4>
                   <p className="text-[10px] text-gray-400 mb-4 h-8">{award.description}</p>
                   <div className="mt-auto">
                      <p className="font-bold text-slate-800">{unitTypes.find(ut => ut.id === award.unit.unitTypeId)?.name}</p>
                      <p className={`text-[9px] font-black uppercase ${award.unit.ownerId === 'player1' ? 'text-blue-600' : 'text-red-600'}`}>
                         {award.unit.ownerId === 'player1' ? scenario.player1.name : scenario.player2.name}
                      </p>
                   </div>
                </div>
              ))}
           </div>

           <div className="space-y-4">
              <h3 className="text-xl font-black uppercase tracking-widest text-slate-400 border-b-2 border-slate-100 pb-2">Přehled jednotek</h3>
              <div className="grid grid-cols-1 gap-3">
                 {stats.sort((a,b) => b.damageDealt - a.damageDealt).map(s => (
                   <div key={s.unitId} className={`flex items-center gap-6 p-4 rounded-xl border-2 ${s.ownerId === 'player1' ? 'border-blue-100 bg-blue-50/30' : 'border-red-100 bg-red-50/30'} ${s.destroyedInRound ? 'opacity-60 saturate-50 grayscale-[0.3]' : ''}`}>
                      <div className={`w-12 h-12 flex items-center justify-center rounded-lg border-2 ${s.ownerId === 'player1' ? 'bg-blue-600 border-blue-800' : 'bg-red-600 border-red-800'} text-white shadow-md flex-shrink-0 overflow-hidden`}>
                         <svg viewBox="-20 -15 40 30" className="w-full h-full p-1">
                            <NatoSymbol type={unitTypes.find(ut => ut.id === s.unitTypeId)?.natoSymbol || 'infantry'} owner={s.ownerId} />
                         </svg>
                      </div>

                      <div className="w-48">
                         <h4 className="font-black text-sm uppercase">{unitTypes.find(ut => ut.id === s.unitTypeId)?.name}</h4>
                         <p className={`text-[10px] font-bold ${s.ownerId === 'player1' ? 'text-blue-600' : 'text-red-600'}`}>
                            {s.ownerId === 'player1' ? scenario.player1.name : scenario.player2.name}
                         </p>
                      </div>

                      <div className="flex-1 grid grid-cols-5 gap-4">
                         <div className="flex flex-col">
                            <span className="text-[8px] font-black text-gray-400 uppercase">Zásahy</span>
                            <span className="font-black text-lg">{s.damageDealt}</span>
                         </div>
                         <div className="flex flex-col">
                            <span className="text-[8px] font-black text-gray-400 uppercase">Zničení</span>
                            <span className="font-black text-lg">{s.kills}</span>
                         </div>
                         <div className="flex flex-col">
                            <span className="text-[8px] font-black text-gray-400 uppercase">Vzdálenost</span>
                            <span className="font-black text-lg">{s.distanceTraveled}</span>
                         </div>
                         <div className="flex flex-col">
                            <span className="text-[8px] font-black text-gray-400 uppercase">Utrženo</span>
                            <span className="font-black text-lg">{s.damageTaken}</span>
                         </div>
                         <div className="flex flex-col justify-center">
                            {s.destroyedInRound ? (
                              <div className="bg-slate-800 text-white px-2 py-1 rounded text-[8px] font-black uppercase flex items-center gap-1 w-fit">
                                <Skull size={10} /> Zničena (Kolo {s.destroyedInRound})
                              </div>
                            ) : (
                              <div className="bg-green-600 text-white px-2 py-1 rounded text-[8px] font-black uppercase flex items-center gap-1 w-fit">
                                 Přežila
                              </div>
                            )}
                         </div>
                      </div>
                   </div>
                 ))}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

const VPItem = ({ vp, player, onMouseEnter }) => {
  return (
    <div
      onMouseEnter={(e) => onMouseEnter(vp, player, e)}
      className="cursor-help transition-all hover:scale-125 hover:-translate-y-1 active:scale-95 flex-shrink-0"
    >
      {vp.type === 'unit' ? (
        <div className={`w-4 h-5 border-2 border-slate-800 rounded shadow-[0_1px_0_0_rgba(0,0,0,0.3)] ${player === 'player1' ? 'bg-blue-600 shadow-blue-900/20' : 'bg-red-600 shadow-red-900/20'}`} />
      ) : (
        <div className="text-yellow-500 drop-shadow-sm filter saturate-150">
          <Star size={16} fill="currentColor" strokeWidth={3} />
        </div>
      )}
    </div>
  );
};

const PHASE_DESCRIPTIONS = {
  'distribution-sections': {
    title: 'A) Zdroje do sekcí',
    text: 'Hráč rozděluje zdroje z centrálního skladu do jednotlivých sekcí (Levá, Střed, Pravá). Tyto zdroje budou v dalším kroku přiděleny konkrétním jednotkám. Kliknutím na sekci nebo použitím tlačítek přidělíte zdroje. Nevyužité zdroje na konci propadají.'
  },
  'distribution-units': {
    title: 'B) Zdroje jednotkám',
    text: 'Hráč přiděluje zdroje ze sekcí konkrétním jednotkám v těchto sekcích. Každá jednotka může mít max. 3 zdroje. Zdroje slouží pro pohyb, útok a jako "životy".'
  },
  'movement': {
    title: 'C) Pohyb jednotek',
    text: 'Vybraná jednotka se může pohnout. Každý krok stojí 1 zdroj (pokud jednotka ještě tento tah nestála). Některé terény pohyb zastavují.'
  },
  'attack': {
    title: 'D) Útoky jednotek',
    text: 'Jednotky mohou útočit na nepřátelské cíle v dostřelu a viditelnosti. Útok stojí 1 zdroj.'
  }
};

const GameView = ({ scenario: initialScenario, gameId = undefined, onExit, clientId = 'local', seat = null, onChangeSeat = null }) => {
  const online = !!gameId;
  const spectator = !!seat?.spectator;
  const [uTypes, setUTypes] = useState([]);
  const [tTypes, setTTypes] = useState([]);
  const [oTypes, setOTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scenario, setScenario] = useState(initialScenario);
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [u, t, o] = await Promise.all([
        getAllUnitTypes(),
        getAllTerrainTypes(),
        getAllOverlayTypes()
      ]);
      setUTypes(u);
      setTTypes(t);
      setOTypes(o);

      if (!scenario && gameId) {
        const remoteState = await getGameState(gameId);
        if (remoteState) {
          setScenario(remoteState.scenario);
        }
      }
      setLoading(false);
    };
    load();
  }, [gameId, initialScenario]);

  const { gameState, combatResult, retreatingUnitId, dismissCombat, takeGroundOption, cancelTakeGround, takeGround, destroyOverlay, distributeResource, nextPhase, endTurn, assignResourceToUnit, moveUnit, attackUnit, retreatUnit, getSelectedReachable, getSelectedTargetable, getRetreatHexes, getUnitHex, hasAvailableActions, getUnusedActions } = useGameLogic(scenario, uTypes, tTypes, oTypes, gameId, clientId);
  const [selected, setSelected] = useState(null); const [actType, setActType] = useState('none'); const [hovered, setHovered] = useState(null);
  const [dismissedOverlay, setDismissedOverlay] = useState(false);
  const [showPhaseInfo, setShowPhaseInfo] = useState(false);
  const [showGoals, setShowGoals] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [hoveredVP, setHoveredVP] = useState(null);
  const [showStats, setShowStats] = useState(false);
  const [victoryDismissed, setVictoryDismissed] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (retreatingUnitId || takeGroundOption) {
      setDismissedOverlay(false);
    }
  }, [retreatingUnitId?.unitId, takeGroundOption?.unitId]);

  // Clear the shared dice animation after a short delay so it disappears for everyone.
  const combatSig = combatResult ? `${combatResult.attackerId}-${combatResult.targetId}-${combatResult.dice.length}` : '';
  useEffect(() => {
    if (!combatResult) return;
    const t = setTimeout(() => dismissCombat(), 2500);
    return () => clearTimeout(t);
  }, [combatSig]);

  const highlightedHexes = useMemo(() => {
    if (!gameState || !gameState.scenario) return {};
    const h = {};
    if (retreatingUnitId) {
      getRetreatHexes(retreatingUnitId.unitId).forEach(k => h[k] = 'move');
      return h;
    }
    if (takeGroundOption) {
      h[`${takeGroundOption.hex.q},${takeGroundOption.hex.r}`] = 'move';
      return h;
    }
    if (!selected) return {};
    if (gameState.phase === 'movement' && (actType === 'move' || !gameState.units[selected].hasMoved)) {
      getSelectedReachable(selected).forEach(k => h[k] = 'move');
    } else if (gameState.phase === 'attack' && (actType === 'attack')) {
      getSelectedTargetable(selected).forEach(uid => { const hex = getUnitHex(uid); if (hex) h[`${hex.q},${hex.r}`] = 'attack'; });
    }
    return h;
  }, [selected, actType, gameState?.phase, gameState?.units, gameState?.grid, retreatingUnitId, takeGroundOption, gameState?.scenario]);

  const currentUnitSections = useMemo(() => {
    if (!gameState || !selected || gameState.phase !== 'distribution-units' || !gameState.scenario) return [];
    const hex = getUnitHex(selected); if (!hex) return [];
    return getUnitSections(hex.q, hex.r, gameState.scenario);
  }, [selected, gameState?.phase, gameState?.scenario]);

  if (loading || !gameState || !gameState.scenario) return <div className="h-screen w-screen flex items-center justify-center bg-map-paper font-military uppercase font-bold text-map-ink-blue">Načítám bitevní pole...</div>;

  const sc = gameState.scenario;
  const activeP = gameState.activePlayerId;
  const res = gameState.sectionResources[activeP];
  const wh = gameState.centralWarehouse[activeP];

  // --- Role-based permissions (local hot-seat games grant full control) ---
  const myTeam: 'player1' | 'player2' | null = online && !spectator ? seat?.team : null;
  const isMyTurn = !online || (!spectator && myTeam === activeP);
  const iAmGeneral = !online || (!spectator && isGeneral(gameState, clientId, activeP));
  const canDistribute = isMyTurn && iAmGeneral;
  const canControlUnit = (uid: string) => {
    if (!online) return true;
    if (spectator) return false;
    const unit = gameState.units[uid]; if (!unit) return false;
    const hex = getUnitHex(uid); if (!hex) return false;
    const secs = getUnitSections((hex as any).q, (hex as any).r, gameState.scenario);
    return secs.some((s: any) => controlsSection(gameState, clientId, unit.ownerId, s));
  };
  const myRoleLabel = spectator ? 'Divák' : seat?.role ? ROLE_LABELS[seat.role] : null;

  const handleHexClick = (q, r) => {
    if (retreatingUnitId) { if (canControlUnit(retreatingUnitId.unitId)) retreatUnit(retreatingUnitId.unitId, q, r); return; }
    if (takeGroundOption) { if (canControlUnit(takeGroundOption.unitId)) takeGround(takeGroundOption.unitId, q, r); return; }
    if (spectator) return;
    const hex = gameState.grid[`${q},${r}`];
    const unitAtHex = hex?.unitId ? gameState.units[hex.unitId] : null;

    if (gameState.phase === 'distribution-sections') {
      if (!canDistribute) return;
      const { col } = axialToOffset(q, r);
      const section = getSection(col, gameState.scenario.sections.leftWidth, gameState.scenario.sections.centerWidth);
      distributeResource(activeP, section);
    } else if (gameState.phase === 'movement') {
      if (unitAtHex && unitAtHex.ownerId === activeP && canControlUnit(hex.unitId)) {
        setSelected(hex.unitId);
        setActType('move');
      } else if (selected && !unitAtHex && canControlUnit(selected)) {
        moveUnit(selected, q, r);
      } else {
        setSelected(null);
        setActType('none');
      }
    } else if (gameState.phase === 'attack') {
      if (unitAtHex && unitAtHex.ownerId === activeP && canControlUnit(hex.unitId)) {
        setSelected(hex.unitId);
        setActType('attack');
      } else if (selected && unitAtHex && unitAtHex.ownerId !== activeP && canControlUnit(selected)) {
        attackUnit(selected, hex.unitId);
      } else {
        setSelected(null);
        setActType('none');
      }
    } else if (gameState.phase === 'distribution-units') {
      if (unitAtHex && unitAtHex.ownerId === activeP && canControlUnit(hex.unitId)) {
        setSelected(hex.unitId);
        assignResourceToUnit(hex.unitId);
      } else {
        setSelected(null);
      }
    }
  };
  return (
    <div className="flex h-screen bg-map-paper overflow-hidden font-military">
      <div className="flex-1 relative flex flex-col">
        <div className="bg-white/70 p-2 flex justify-between items-center border-b border-map-ink-blue z-20 px-8">
           <div className="flex items-center gap-4">
             <div className="text-blue-800 uppercase font-black text-sm tracking-tighter">{gameState.scenario.player1.name}</div>
             <div
               onMouseLeave={() => setHoveredVP(null)}
               className="flex gap-1.5 h-10 items-center px-4 bg-slate-200/50 rounded-lg border border-slate-300 shadow-inner min-w-[160px]"
             >
                {gameState.victoryPoints.player1.map((vp) => (
                   <VPItem key={vp.id} vp={vp} player="player1" onMouseEnter={(vp, p, e) => setHoveredVP({ vp, player: p, x: e.clientX, y: e.clientY })} />
                ))}
             </div>
           </div>

           <div className="flex flex-col items-center gap-1">
             <div className="text-[11px] uppercase opacity-40 font-black tracking-[0.2em]">Turn {gameState.currentTurn}</div>
             {gameId && (
               <div className="flex items-center gap-1">
                 <button
                   onClick={() => {
                     navigator.clipboard.writeText(window.location.href);
                     setCopied(true);
                     setTimeout(() => setCopied(false), 2000);
                   }}
                   className="flex items-center gap-1 text-[8px] font-black uppercase bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-200 hover:bg-blue-100 transition-colors"
                 >
                   {copied ? <Check size={8} /> : <Copy size={8} />}
                   {copied ? 'Zkopírováno' : 'Sdílet odkaz'}
                 </button>
                 <button
                   onClick={() => setShowQR(true)}
                   className="flex items-center gap-1 text-[8px] font-black uppercase bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-200 hover:bg-blue-100 transition-colors"
                 >
                   <QrCode size={8} />
                   Zobrazit QR kód
                 </button>
               </div>
             )}
           </div>

           <div className="flex items-center gap-4">
             <div
               onMouseLeave={() => setHoveredVP(null)}
               className="flex gap-1.5 h-10 items-center px-4 bg-slate-200/50 rounded-lg border border-slate-300 shadow-inner min-w-[160px] justify-end"
             >
                {gameState.victoryPoints.player2.map((vp) => (
                   <VPItem key={vp.id} vp={vp} player="player2" onMouseEnter={(vp, p, e) => setHoveredVP({ vp, player: p, x: e.clientX, y: e.clientY })} />
                ))}
             </div>
             <div className="text-red-800 uppercase font-black text-sm tracking-tighter text-right">{gameState.scenario.player2.name}</div>
           </div>
        </div>
        <div className="flex-1 relative flex flex-col overflow-hidden">
          <div className="flex-1 relative overflow-auto pb-16">
          <HexGrid
            width={sc.boardWidth} height={sc.boardHeight} hexes={gameState.grid} units={gameState.units}
            terrainTypes={tTypes} unitTypes={uTypes} onHexClick={handleHexClick} onHexMouseEnter={(q,r) => setHovered(`${q},${r}`)} onHexMouseLeave={() => setHovered(null)}
            leftWidth={sc.sections.leftWidth} centerWidth={sc.sections.centerWidth} selectedUnitId={selected}
            highlightedHexes={highlightedHexes} hoveredHex={hovered} activePhase={gameState.phase}
            unitSections={currentUnitSections} onSectionSelect={(s) => assignResourceToUnit(selected, s)}
            showLabels={showLabels}
          />
          {retreatingUnitId && (
            <div className={`absolute left-1/2 -translate-x-1/2 z-50 text-center uppercase transition-all duration-300 ${dismissedOverlay ? 'top-2' : 'top-1/2 -translate-y-1/2'}`}>
              <div className={`bg-white border-4 border-red-600 rounded-xl shadow-2xl ${dismissedOverlay ? 'p-3 flex items-center gap-4' : 'p-10'}`}>
                <h2 className={`${dismissedOverlay ? 'text-sm' : 'text-3xl'} font-bold text-red-600 font-handwriting`}>Ustupte!</h2>
                {!dismissedOverlay && <p className="text-lg mt-2 font-bold">Zbývá: {retreatingUnitId.count}</p>}
                {!dismissedOverlay && <p className="text-[10px] mt-2 text-gray-500 normal-case">Klikněte na stejné pole pro ztrátu života</p>}
                <button onClick={() => setDismissedOverlay(!dismissedOverlay)} className={`mt-4 bg-red-600 text-white px-6 py-2 text-sm font-bold rounded-lg ${dismissedOverlay ? 'mt-0' : ''} hover:bg-red-700 transition-colors`}>
                  {dismissedOverlay ? 'Zobrazit info' : 'Vyřešit'}
                </button>
              </div>
            </div>
          )}
          {takeGroundOption && (
            <div className={`absolute left-1/2 -translate-x-1/2 z-50 text-center uppercase transition-all duration-300 ${dismissedOverlay ? 'top-2' : 'top-1/2 -translate-y-1/2'}`}>
              <div className={`bg-white border-4 border-blue-600 rounded-xl shadow-2xl ${dismissedOverlay ? 'p-3 flex items-center gap-4' : 'p-10'}`}>
                <h2 className={`${dismissedOverlay ? 'text-sm' : 'text-3xl'} font-bold text-blue-600 font-handwriting`}>Obsadit pozici?</h2>
                {!dismissedOverlay && <p className="text-sm mt-2 font-bold normal-case">Klikněte na pole pro přesun, nebo kamkoliv jinam pro zrušení.</p>}
                <div className={`${dismissedOverlay ? 'flex gap-2' : 'mt-6 flex flex-col gap-3'}`}>
                  <button onClick={() => setDismissedOverlay(!dismissedOverlay)} className="bg-blue-600 text-white px-6 py-2 text-sm font-bold rounded-lg hover:bg-blue-700 transition-colors">
                    {dismissedOverlay ? 'Zobrazit' : 'Vyřešit'}
                  </button>
                  <button onClick={() => cancelTakeGround()} className="bg-gray-200 text-slate-800 px-6 py-2 text-sm font-bold rounded-lg hover:bg-gray-300 transition-colors">Zrušit</button>
                </div>
              </div>
            </div>
          )}
          <div className="absolute top-4 right-4 flex flex-col gap-4 w-56 z-40">
            {selected && !retreatingUnitId && (
              <div className="bg-white/95 p-4 border-2 border-map-ink-blue shadow-lg rounded">
                <h3 className="font-bold mb-1 font-handwriting text-lg border-b border-map-ink-blue pb-1">{uTypes.find(u => u.id === gameState.units[selected].typeId)?.name}</h3>
                <div className="flex flex-col gap-2 mt-2">
                  <div className="text-[10px] grid grid-cols-2 gap-x-2 gap-y-1 uppercase font-bold text-gray-700 mb-2">
                    <span>Pohyb:</span> <span>{uTypes.find(u => u.id === gameState.units[selected].typeId)?.movement}</span>
                    <span>Dostřel:</span> <span>{uTypes.find(u => u.id === gameState.units[selected].typeId)?.shootingRange.join('-')}</span>
                    {uTypes.find(u => u.id === gameState.units[selected].typeId)?.canShootAfterMovingMax === 0 && <span className="col-span-2 text-[8px] text-red-600">Nelze útočit po pohybu</span>}
                  </div>

                  <div className="border-t border-gray-200 pt-2 mb-2">
                    <div className="text-[9px] uppercase flex justify-between">
                      <span>Zdroje:</span> <span className="font-bold">{gameState.units[selected].resources} / 3</span>
                    </div>
                    <div className="text-[9px] uppercase flex justify-between">
                      <span>Figurky:</span> <span className="font-bold">{gameState.units[selected].figures}</span>
                    </div>
                    <div className="text-[9px] uppercase flex justify-between">
                      <span>Využitý pohyb:</span> <span className="font-bold">{gameState.units[selected].movementUsed}</span>
                    </div>
                  </div>

                  {gameState.phase === 'movement' && <button disabled={gameState.units[selected].resources === 0 || (gameState.units[selected].movementUsed >= (uTypes.find(ut => ut.id === gameState.units[selected].typeId)?.movement || 0))} onClick={() => setActType('move')} className={`w-full p-2 rounded border text-[10px] font-bold ${actType === 'move' ? 'bg-yellow-200' : 'bg-white disabled:opacity-50 uppercase'}`}>POHYB</button>}
                  {gameState.phase === 'attack' && (
                    <>
                      <button disabled={gameState.units[selected].resources === 0 || gameState.units[selected].hasAttacked} onClick={() => setActType('attack')} className={`w-full p-2 rounded border text-[10px] font-bold ${actType === 'attack' ? 'bg-red-200' : 'bg-white disabled:opacity-50 uppercase'}`}>ÚTOK</button>
                      {getUnitHex(selected)?.overlayTypeId === 'wire' && (() => {
                        const ut = uTypes.find(ut => ut.id === gameState.units[selected].typeId);
                        const category = ut?.category || (ut?.id === 'tank' ? 'tank' : (ut?.id === 'artillery' ? 'artillery' : 'infantry'));
                        return category === 'infantry';
                      })() && !gameState.units[selected].hasAttacked && (
                        <button disabled={gameState.units[selected].resources === 0} onClick={() => destroyOverlay(selected)} className="w-full p-2 rounded border text-[10px] font-bold bg-orange-100 hover:bg-orange-200 disabled:opacity-50 uppercase mt-2">Zničit ostnatý drát</button>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {hovered && (
              <div className="bg-white/95 p-4 border-2 border-gray-400 shadow-lg rounded animate-in fade-in slide-in-from-right-2 duration-200">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-4 h-4 rounded-full border border-black" style={{ backgroundColor: tTypes.find(t => t.id === gameState.grid[hovered]?.terrainTypeId)?.color || '#91b94d' }}></div>
                  <h3 className="font-bold font-handwriting text-lg">{tTypes.find(t => t.id === gameState.grid[hovered]?.terrainTypeId)?.name || 'Tráva'}</h3>
                </div>
                <p className="text-[10px] text-gray-700 italic">
                  {tTypes.find(t => t.id === gameState.grid[hovered]?.terrainTypeId)?.description || 'Základní terén bez omezení.'}
                </p>
                {gameState.grid[hovered]?.overlayTypeId && (
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <h4 className="text-[10px] font-bold uppercase text-gray-600">{oTypes.find(o => o.id === gameState.grid[hovered].overlayTypeId)?.name}</h4>
                    <p className="text-[9px] text-gray-600">
                      {oTypes.find(o => o.id === gameState.grid[hovered].overlayTypeId)?.description}
                      {oTypes.find(o => o.id === gameState.grid[hovered].overlayTypeId)?.diceModifierDefense && ` (Obrana: +${oTypes.find(o => o.id === gameState.grid[hovered].overlayTypeId).diceModifierDefense})`}
                    </p>
                  </div>
                )}
                {gameState.grid[hovered]?.unitId && (
                  <div className="mt-3 pt-2 border-t border-gray-200">
                     <p className="text-[9px] font-bold uppercase text-gray-500 mb-1">Jednotka na poli:</p>
                     <p className="text-[11px] font-bold">{uTypes.find(u => u.id === gameState.units[gameState.grid[hovered].unitId].typeId)?.name} ({gameState.units[gameState.grid[hovered].unitId].ownerId === 'player1' ? gameState.scenario.player1.name : gameState.scenario.player2.name})</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

        {/* Resource UI area */}
        {(gameState.phase === 'distribution-sections' || gameState.phase === 'distribution-units') && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-1.5 pointer-events-none transition-all duration-500">
              <div className="flex w-[90vw] max-w-[800px] pointer-events-auto gap-12 items-end justify-center mb-1">
                {(['left', 'center', 'right'] as const).map((section) => (
                  <div key={section} className="flex flex-col items-center gap-1">
                    {gameState.phase === 'distribution-sections' && (
                      <div className="flex gap-1 mb-0.5">
                        {[1, 2, 3, 'Max'].map(v => (
                          <button
                            key={v}
                            disabled={wh <= 0 || !canDistribute}
                            onClick={() => distributeResource(activeP, section, v === 'Max' ? 'max' : (v as number))}
                            className="px-2 py-1 bg-slate-800 text-white border border-slate-900 rounded-md text-[10px] font-black hover:bg-slate-700 hover:scale-105 active:scale-95 transition-all shadow-md uppercase disabled:opacity-30 disabled:hover:scale-100"
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    )}
                    <Misticka count={res[section]} active={gameState.phase === 'distribution-sections' || (gameState.phase === 'distribution-units' && res[section] > 0)} />
                  </div>
                ))}
              </div>

              <div className="flex flex-col items-center relative pointer-events-auto group">
                <div className="absolute -top-3 text-[9px] font-black uppercase text-slate-800 bg-white border border-slate-800 px-2 py-0.5 rounded-full shadow-md z-10 tracking-widest group-hover:scale-110 transition-transform">
                  ({wh})
                </div>
                <Misticka count={wh} warehouse capacity={20} active={gameState.phase === 'distribution-sections'} />
              </div>

          </div>
        )}

        {/* Floating Controls */}
        <div className="fixed bottom-4 left-4 z-50 flex flex-col gap-2 pointer-events-none">
           <div className="flex gap-2 pointer-events-auto">
              <button onClick={onExit} title="Menu" className="p-2 bg-slate-800 border-2 border-slate-800 rounded-lg shadow-lg hover:bg-slate-700 transition-colors">
                <Menu size={20} className="text-white" />
              </button>
              <button onClick={() => setShowLabels(v => !v)} title={showLabels ? 'Skrýt popisky políček' : 'Zobrazit popisky políček'} className="p-2 bg-slate-800 border-2 border-slate-800 rounded-lg shadow-lg hover:bg-slate-700 transition-colors">
                {showLabels ? <Eye size={20} className="text-white" /> : <EyeOff size={20} className="text-white" />}
              </button>
              {gameState.winner && (
                <button onClick={() => setShowStats(true)} title="Statistiky" className="p-2 bg-slate-800 border-2 border-slate-800 rounded-lg shadow-lg hover:bg-slate-700 transition-colors">
                  <Trophy size={20} className="text-white" />
                </button>
              )}
              {(gameState.winner || (isMyTurn && iAmGeneral)) && <button onClick={() => {
                  if (gameState.winner) { onExit(); return; }
                  if (hasAvailableActions()) { setShowConfirm(true); }
                  else { if (gameState.phase === 'attack') endTurn(); else nextPhase(); setSelected(null); setActType('none'); }
                }} className={`px-4 py-2 rounded-lg shadow-lg font-bold uppercase text-sm transition-colors border-2 ${gameState.winner ? 'bg-red-600 border-red-800 text-white hover:bg-red-700' : (gameState.phase === 'attack' ? 'bg-red-800 border-red-900 text-white hover:bg-red-700' : 'bg-slate-800 border-slate-900 text-white hover:bg-slate-700')}`}>
                {(() => {
                  if (gameState.winner) return 'Ukončit hru';
                  switch (gameState.phase) {
                    case 'distribution-sections': return 'Ukončit rozdělování';
                    case 'distribution-units': return 'Ukončit přidělování';
                    case 'movement': return 'Ukončit pohyb';
                    case 'attack': return 'Konec tahu';
                    default: return 'Další';
                  }
                })()}
              </button>}
           </div>

           {online && (
             <div className="pointer-events-auto bg-white/90 border-2 border-slate-800 px-3 py-1.5 rounded-lg shadow-md flex items-center gap-2 text-[10px] font-black uppercase tracking-wide">
               {spectator ? <Eye size={14} /> : seat?.role === 'general' ? <Crown size={14} /> : <Shield size={14} />}
               <span className="text-slate-800">{myRoleLabel}{!spectator && ` · ${gameState.scenario[myTeam!]?.name}`}</span>
               <span className={`ml-1 px-1.5 py-0.5 rounded ${isMyTurn ? 'bg-map-ink-green text-white' : 'bg-slate-200 text-slate-600'}`}>
                 {isMyTurn ? 'VÁŠ TAH' : `NA TAHU: ${gameState.scenario[activeP]?.name}`}
               </span>
               {onChangeSeat && <button onClick={onChangeSeat} className="ml-1 text-blue-600 hover:underline normal-case font-bold">změnit</button>}
             </div>
           )}

           <div className="relative pointer-events-auto group">
              <div
                onMouseEnter={() => setShowPhaseInfo(true)}
                onMouseLeave={() => setShowPhaseInfo(false)}
                className="bg-white/80 border-2 border-slate-800 px-3 py-1.5 rounded-lg shadow-md cursor-help flex items-center gap-2"
              >
                <Info size={14} className="text-slate-800" />
                <span className="font-bold uppercase text-[10px] whitespace-nowrap text-slate-800">
                  {PHASE_DESCRIPTIONS[gameState.phase].title}
                </span>
              </div>

              {showPhaseInfo && (
                <div className="absolute bottom-full left-0 mb-3 w-72 bg-white border-2 border-slate-800 p-4 shadow-2xl rounded-lg animate-in fade-in slide-in-from-bottom-2 duration-200 z-50 pointer-events-none">
                   <h4 className="font-bold font-handwriting text-xl border-b-2 border-slate-800 pb-1 mb-2">{PHASE_DESCRIPTIONS[gameState.phase].title}</h4>
                   <p className="text-xs text-gray-700 leading-relaxed italic">{PHASE_DESCRIPTIONS[gameState.phase].text}</p>
                </div>
              )}
           </div>

           {sc.victoryGoals && (
             <div className="relative pointer-events-auto group">
                <div
                  onClick={() => setShowGoals(g => !g)}
                  onMouseEnter={() => setShowGoals(true)}
                  className="bg-white/80 border-2 border-map-ink-blue px-3 py-1.5 rounded-lg shadow-md cursor-help flex items-center gap-2"
                >
                  <Target size={14} className="text-map-ink-blue" />
                  <span className="font-bold uppercase text-[10px] whitespace-nowrap text-map-ink-blue">Cíle vítězství</span>
                </div>
                {showGoals && (
                  <div
                    onMouseLeave={() => setShowGoals(false)}
                    className="absolute bottom-full left-0 mb-3 w-80 bg-white border-2 border-map-ink-blue p-4 shadow-2xl rounded-lg animate-in fade-in slide-in-from-bottom-2 duration-200 z-50"
                  >
                     <h4 className="font-bold font-handwriting text-xl border-b-2 border-map-ink-blue pb-1 mb-2 flex items-center gap-2"><Target size={18} /> Cíle vítězství</h4>
                     <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-line">{sc.victoryGoals}</p>
                  </div>
                )}
             </div>
           )}
        </div>
      {combatResult && <DiceAnimation dice={combatResult.dice} onComplete={() => dismissCombat()} />}
      {gameState.winner && !victoryDismissed && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] animate-in fade-in duration-500">
          <div className="bg-white p-12 rounded-3xl text-center border-8 border-map-paper shadow-2xl max-w-lg w-full">
            <div className="mb-6 flex justify-center">
               <Trophy size={80} className="text-yellow-500 drop-shadow-lg" />
            </div>
            <h1 className="text-6xl font-black font-handwriting mb-2 text-map-ink-blue uppercase tracking-tighter">Vítězství!</h1>
            <p className="text-2xl font-bold mb-10 text-slate-700 uppercase tracking-widest">
              {gameState.winner === 'player1' ? gameState.scenario.player1.name : gameState.scenario.player2.name} vyhrál
            </p>
            <div className="flex flex-col gap-4">
               <button onClick={() => setShowStats(true)} className="bg-slate-800 text-white px-8 py-4 rounded-xl text-xl uppercase font-black hover:bg-slate-700 transition-all shadow-lg active:scale-95">
                 Zobrazit statistiky
               </button>
               <button onClick={() => setVictoryDismissed(true)} className="bg-white text-slate-800 border-2 border-slate-200 px-8 py-3 rounded-xl text-sm uppercase font-black hover:bg-slate-50 transition-all">
                 Prohlédnout mapu
               </button>
               <button onClick={onExit} className="text-gray-400 hover:text-red-600 transition-colors uppercase text-[10px] font-black tracking-widest mt-4">
                 Ukončit hru nyní
               </button>
            </div>
          </div>
        </div>
      )}
      {showStats && (
        <StatisticsModal
          unitStats={gameState.unitStats}
          scenario={gameState.scenario}
          unitTypes={uTypes}
          onClose={() => setShowStats(false)}
        />
      )}
      {showQR && (
        <div
          className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[150] flex items-center justify-center p-8 font-military"
          onClick={() => setShowQR(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border-2 border-slate-800 p-8 flex flex-col items-center gap-5 max-w-sm w-full animate-in fade-in zoom-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between w-full">
              <h3 className="font-black uppercase tracking-tighter text-lg text-slate-800">Sdílet hru</h3>
              <button
                onClick={() => setShowQR(false)}
                className="text-slate-400 hover:text-slate-800 transition-colors"
                aria-label="Zavřít"
              >
                <CloseIcon size={20} />
              </button>
            </div>
            <p className="text-xs text-slate-500 text-center uppercase font-bold tracking-wide">
              Naskenujte QR kód a připojte se ke hře
            </p>
            <div className="bg-white p-3 rounded-lg border-2 border-slate-200">
              <QRCodeSVG value={window.location.href} size={232} level="M" />
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="flex items-center gap-1.5 text-[10px] font-black uppercase bg-blue-50 text-blue-600 px-3 py-1.5 rounded border border-blue-200 hover:bg-blue-100 transition-colors"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? 'Zkopírováno' : 'Kopírovat odkaz'}
            </button>
          </div>
        </div>
      )}
      {hoveredVP && (
        <div
          className="fixed z-[100] pointer-events-none bg-white border-2 border-slate-800 p-4 shadow-2xl rounded-lg w-64 animate-in fade-in zoom-in duration-150"
          style={{
            left: hoveredVP.x > window.innerWidth - 300 ? hoveredVP.x - 280 : hoveredVP.x + 20,
            top: hoveredVP.y + 20
          }}
        >
          <div className="flex items-center gap-2 mb-2 border-b border-slate-200 pb-2">
            {hoveredVP.vp.type === 'unit' ? <Skull className="text-slate-600" size={18} /> : <Star className="text-yellow-500" size={18} fill="currentColor" />}
            <h4 className="font-bold font-handwriting text-xl">
              {hoveredVP.vp.type === 'unit' ? 'Zničená jednotka' : 'Obsazený cíl'}
            </h4>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500 uppercase font-black text-[9px]">Kolo:</span>
              <span className="font-bold">{hoveredVP.vp.round}</span>
            </div>

            {hoveredVP.vp.type === 'unit' && hoveredVP.vp.unitStats && (
              <>
                <div className="flex justify-between">
                  <span className="text-gray-500 uppercase font-black text-[9px]">Typ:</span>
                  <span className="font-bold">{uTypes.find(ut => ut.id === hoveredVP.vp.unitStats.unitTypeId)?.name}</span>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100">
                  <p className="text-[9px] font-black uppercase text-slate-400 mb-1 tracking-widest text-center">Statistiky jednotky</p>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="bg-slate-50 p-1.5 rounded flex flex-col items-center">
                      <Target size={12} className="text-red-500 mb-0.5" />
                      <span className="font-black text-[10px]">{hoveredVP.vp.unitStats.damageDealt}</span>
                      <span className="text-[8px] uppercase text-gray-400">Zásahy</span>
                    </div>
                    <div className="bg-slate-50 p-1.5 rounded flex flex-col items-center">
                      <Skull size={12} className="text-slate-800 mb-0.5" />
                      <span className="font-black text-[10px]">{hoveredVP.vp.unitStats.kills}</span>
                      <span className="text-[8px] uppercase text-gray-400">Zničení</span>
                    </div>
                  </div>
                  <div className="mt-2 text-[9px] bg-slate-50 p-2 rounded italic text-gray-600 leading-tight">
                    Tato jednotka byla napadena: {hoveredVP.vp.unitStats.attackers.map(tid => uTypes.find(ut => ut.id === tid)?.name).join(', ') || 'nikým'}
                  </div>
                </div>
              </>
            )}

            {hoveredVP.vp.type === 'objective' && (
              <div className="flex justify-between">
                <span className="text-gray-500 uppercase font-black text-[9px]">Cíl:</span>
                <span className="font-bold">{hoveredVP.vp.objectiveName}</span>
              </div>
            )}
          </div>
        </div>
      )}
      {showConfirm && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] uppercase">
        <div className="bg-white p-8 rounded-xl shadow-2xl border-4 border-slate-800 text-center max-w-md">
          <p className="mb-4 font-bold text-lg">Nevyužité možnosti:</p>
          <ul className="list-disc list-inside mb-8 text-left text-xs lowercase leading-relaxed">
            {getUnusedActions().map((r, i) => <li key={i}>{r}</li>)}
          </ul>
          <p className="mb-8 font-bold text-lg uppercase tracking-wide">Opravdu chcete pokračovat?</p>
          <div className="flex gap-6 justify-center">
            <button onClick={() => setShowConfirm(false)} className="bg-gray-200 px-8 py-3 rounded-lg font-bold text-slate-800 hover:bg-gray-300 transition-colors">Zrušit</button>
            <button onClick={() => { setShowConfirm(false); if (gameState.phase === 'attack') endTurn(); else nextPhase(); setSelected(null); setActType('none'); }} className="bg-slate-800 text-white px-8 py-3 rounded-lg font-bold hover:bg-slate-700 transition-colors">Pokračovat</button>
          </div>
        </div>
      </div>}
      </div>
    </div>
  );
};
export default GameView;
