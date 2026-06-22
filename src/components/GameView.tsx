import React, { useState, useMemo, useEffect } from 'react'; import { useGameLogic } from '../hooks/useGameLogic'; import HexGrid from './HexGrid'; import DiceAnimation from './DiceAnimation'; import { getAllTerrainTypes, getAllUnitTypes, getAllOverlayTypes } from '../data/typeUtils'; import { getUnitSections, axialToOffset, getSection, terrainColor } from '../logic/hexGrid';
import NatoSymbol from './NatoSymbol';
import { Info, Star, Trophy, Target, TrendingUp, Move, Skull, X as CloseIcon, Copy, Check, Crown, Shield, Eye, EyeOff, QrCode, Undo2, ArrowLeft, ArrowRight } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { getGameState } from '../logic/firebaseService';
import { controlsSection, isGeneral } from '../logic/gameReducer';

const ROLE_LABELS: Record<string, string> = { general: 'Generál', left: 'Levá sekce', center: 'Střed', right: 'Pravá sekce' };

const PHASE_ORDER = ['distribution-sections', 'distribution-units', 'movement', 'attack'];
const PHASE_STEPS = [
  { l: 'A', t: 'Zdroje' },
  { l: 'B', t: 'Přidělení' },
  { l: 'C', t: 'Pohyb' },
  { l: 'D', t: 'Útok' },
];
const PHASE_HINTS: Record<string, string> = {
  'distribution-sections': 'Rozděl příjem ze skladu do tří sekcí pomocí tácků dole.',
  'distribution-units': 'Klikni na svou jednotku a přiděl jí kostky ze sekce.',
  'movement': 'Vyber jednotku a klikni na zvýrazněné pole pro přesun.',
  'attack': 'Vyber jednotku, klikni na nepřítele v dosahu a hoď kostkami.',
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
  },
  'gameOver': { title: 'Konec hry', text: 'Bitva byla rozhodnuta.' }
};

// A single resource cube as drawn inside the trays / warehouse box.
const DockCube = ({ filled }: { filled: boolean }) => (
  <div className="w-[13px] h-[16px] rounded-[2px]" style={filled ? { background: '#3aa657', border: '1.5px solid #2c7d42' } : { background: 'transparent', border: '1.5px dashed #cbb98c' }} />
);

const CubeBox = ({ count, capacity = 12, className = '' }: { count: number; capacity?: number; className?: string }) => (
  <div className={`relative flex flex-wrap gap-[5px] items-center justify-center rounded-[10px] px-3 py-2.5 ${className}`} style={{ background: 'rgba(28,63,107,.05)', border: '1.5px solid #c4b289', boxShadow: 'inset 0 2px 5px rgba(60,45,20,.12)' }}>
    {Array.from({ length: Math.min(count, capacity) }).map((_, i) => <DockCube key={i} filled />)}
    {count === 0 && <span className="text-[10px] font-condensed font-extrabold uppercase tracking-[0.15em] text-[#a99c78]">Prázdné</span>}
    {count > capacity && <span className="absolute right-1 bg-ally text-white px-1.5 py-0.5 text-[8px] font-extrabold rounded">+{count - capacity}</span>}
  </div>
);

const StatisticsModal = ({ unitStats, scenario, unitTypes, onClose }) => {
  const stats = Object.values(unitStats) as any[];

  const sniper = stats.reduce((prev, curr) => (curr.damageDealt > (prev?.damageDealt || 0)) ? curr : prev, null);
  const legend = stats.reduce((prev, curr) => (curr.kills > (prev?.kills || 0)) ? curr : prev, null);
  const runner = stats.reduce((prev, curr) => (curr.distanceTraveled > (prev?.distanceTraveled || 0)) ? curr : prev, null);
  const ironWall = stats.reduce((prev, curr) => (curr.damageTaken > (prev?.damageTaken || 0)) ? curr : prev, null);

  const awards = [
    { id: 'sniper', title: 'Odstřelovač', description: 'Nejvíce udělených zásahů', unit: sniper, icon: <Target className="text-danger" /> },
    { id: 'legend', title: 'Legenda', description: 'Nejvíce zničených nepřátel', unit: legend, icon: <Trophy className="text-gold" /> },
    { id: 'runner', title: 'Maratonec', description: 'Největší uražená vzdálenost', unit: runner, icon: <Move className="text-ally-soft" /> },
    { id: 'ironwall', title: 'Železná zeď', description: 'Nejvíce utržených zásahů', unit: ironWall, icon: <TrendingUp className="text-army" /> },
  ];

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-8 overflow-hidden" style={{ background: 'rgba(22,32,46,.7)', backdropFilter: 'blur(6px)' }}>
      <div className="bg-parchment-card w-full max-w-5xl max-h-full flex flex-col rounded-[20px] shadow-2xl border-2 border-ally anim-fade-up">
        <div className="p-6 border-b-2 border-tan-border flex justify-between items-center bg-[#f7f0df] rounded-t-[18px]">
          <h2 className="text-3xl font-condensed font-extrabold uppercase tracking-tight text-ally flex items-center gap-3">
             <Trophy size={36} /> Závěrečné statistiky
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-full transition-colors text-tan-deep">
            <CloseIcon size={28} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-12">
           <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {awards.filter(a => a.unit && (a.id === 'runner' ? a.unit.distanceTraveled > 0 : (a.id === 'ironwall' ? a.unit.damageTaken > 0 : a.unit.damageDealt > 0 || a.unit.kills > 0))).map(award => (
                <div key={award.id} className="bg-[#f4ecd7] border-2 border-tan-border p-6 rounded-2xl flex flex-col items-center text-center relative overflow-hidden group">
                   <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:scale-110 transition-transform">
                      {award.icon}
                   </div>
                   <div className="mb-4 bg-white p-4 rounded-full shadow-lg border-2 border-tan-border">
                      {award.icon}
                   </div>
                   <h4 className="font-condensed font-extrabold uppercase text-sm mb-1 tracking-widest text-ink">{award.title}</h4>
                   <p className="text-[10px] text-tan mb-4 h-8">{award.description}</p>
                   <div className="mt-auto">
                      <p className="font-bold text-ink">{unitTypes.find(ut => ut.id === award.unit.unitTypeId)?.name}</p>
                      <p className={`text-[9px] font-extrabold uppercase ${award.unit.ownerId === 'player1' ? 'text-ally' : 'text-axis'}`}>
                         {award.unit.ownerId === 'player1' ? scenario.player1.name : scenario.player2.name}
                      </p>
                   </div>
                </div>
              ))}
           </div>

           <div className="space-y-4">
              <h3 className="text-xl font-condensed font-extrabold uppercase tracking-widest text-tan border-b-2 border-tan-border pb-2">Přehled jednotek</h3>
              <div className="grid grid-cols-1 gap-3">
                 {stats.sort((a,b) => b.damageDealt - a.damageDealt).map(s => (
                   <div key={s.unitId} className={`flex items-center gap-6 p-4 rounded-xl border-2 ${s.ownerId === 'player1' ? 'border-ally/20 bg-ally/[0.04]' : 'border-axis/20 bg-axis/[0.04]'} ${s.destroyedInRound ? 'opacity-60 saturate-50' : ''}`}>
                      <div className={`w-12 h-12 flex items-center justify-center rounded-lg border-2 ${s.ownerId === 'player1' ? 'bg-ally border-ally' : 'bg-axis border-axis'} text-white shadow-md flex-shrink-0 overflow-hidden`}>
                         <svg viewBox="-20 -15 40 30" className="w-full h-full p-1">
                            <NatoSymbol type={unitTypes.find(ut => ut.id === s.unitTypeId)?.natoSymbol || 'infantry'} owner={s.ownerId} />
                         </svg>
                      </div>

                      <div className="w-48">
                         <h4 className="font-condensed font-extrabold text-base uppercase text-ink">{unitTypes.find(ut => ut.id === s.unitTypeId)?.name}</h4>
                         <p className={`text-[10px] font-bold ${s.ownerId === 'player1' ? 'text-ally' : 'text-axis'}`}>
                            {s.ownerId === 'player1' ? scenario.player1.name : scenario.player2.name}
                         </p>
                      </div>

                      <div className="flex-1 grid grid-cols-5 gap-4">
                         <div className="flex flex-col">
                            <span className="text-[8px] font-extrabold text-tan uppercase">Zásahy</span>
                            <span className="font-extrabold text-lg text-ink">{s.damageDealt}</span>
                         </div>
                         <div className="flex flex-col">
                            <span className="text-[8px] font-extrabold text-tan uppercase">Zničení</span>
                            <span className="font-extrabold text-lg text-ink">{s.kills}</span>
                         </div>
                         <div className="flex flex-col">
                            <span className="text-[8px] font-extrabold text-tan uppercase">Vzdálenost</span>
                            <span className="font-extrabold text-lg text-ink">{s.distanceTraveled}</span>
                         </div>
                         <div className="flex flex-col">
                            <span className="text-[8px] font-extrabold text-tan uppercase">Utrženo</span>
                            <span className="font-extrabold text-lg text-ink">{s.damageTaken}</span>
                         </div>
                         <div className="flex flex-col justify-center">
                            {s.destroyedInRound ? (
                              <div className="bg-axis text-white px-2 py-1 rounded text-[8px] font-extrabold uppercase flex items-center gap-1 w-fit">
                                <Skull size={10} /> Zničena (Kolo {s.destroyedInRound})
                              </div>
                            ) : (
                              <div className="bg-army text-white px-2 py-1 rounded text-[8px] font-extrabold uppercase flex items-center gap-1 w-fit">
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

const VPItem = ({ vp, player, color, onMouseEnter }) => (
  <div
    onMouseEnter={(e) => onMouseEnter(vp, player, e)}
    className="cursor-help transition-transform hover:scale-125 hover:-translate-y-0.5 flex-shrink-0 flex items-center justify-center"
    style={{ width: 18, height: 18 }}
  >
    {vp.type === 'unit' ? (
      <div className="w-[18px] h-[18px] rounded-[4px] flex items-center justify-center" style={{ background: color }}>
        <svg width="11" height="9" viewBox="-9 -7 18 14"><path d="M-7,-5 L7,5 M7,-5 L-7,5" stroke="#fff" strokeWidth="2.4" /></svg>
      </div>
    ) : (
      <div className="w-[18px] h-[18px] rounded-[4px] flex items-center justify-center" style={{ background: color }}>
        <Star size={11} fill="#fff" stroke="#fff" strokeWidth={2} />
      </div>
    )}
  </div>
);

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

  const { gameState, combatResult, retreatingUnitId, dismissCombat, takeGroundOption, cancelTakeGround, takeGround, destroyOverlay, distributeResource, nextPhase, endTurn, assignResourceToUnit, moveUnit, attackUnit, retreatUnit, undoLastAction, canUndo, getSelectedReachable, getSelectedTargetable, getRetreatHexes, getUnitHex, hasAvailableActions, getUnusedActions } = useGameLogic(scenario, uTypes, tTypes, oTypes, gameId, clientId);
  const [selected, setSelected] = useState(null); const [actType, setActType] = useState('none'); const [hovered, setHovered] = useState(null);
  const [dismissedOverlay, setDismissedOverlay] = useState(false);
  const [showPhaseInfo, setShowPhaseInfo] = useState(false);
  const [showGoals, setShowGoals] = useState(false);
  // Režim zobrazení popisků políček: 'hidden' | 'below' (pod jednotkami) | 'above' (nad jednotkami)
  const [labelMode, setLabelMode] = useState('below');
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

  if (loading || !gameState || !gameState.scenario) return <div className="h-screen w-screen flex items-center justify-center uppercase font-condensed font-extrabold tracking-[0.2em] text-ally">Načítám bitevní pole…</div>;

  const sc = gameState.scenario;
  const activeP = gameState.activePlayerId;
  const res = gameState.sectionResources[activeP];
  const wh = gameState.centralWarehouse[activeP];
  const toWin = sc.victoryPointsToWin || 6;

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

  const phaseIndex = PHASE_ORDER.indexOf(gameState.phase);
  const sideName = (p) => (p === 'player1' ? sc.player1.name : sc.player2.name);
  const turnLabel = `TAH ${gameState.currentTurn} · ${sideName(activeP).toUpperCase()}`;

  const renderVPTokens = (player) => {
    const earned = gameState.victoryPoints[player] || [];
    const empties = Math.max(0, toWin - earned.length);
    const col = player === 'player1' ? '#2f6db0' : '#c0392b';
    const dash = player === 'player1' ? '#9fb3cc' : '#cc9f9f';
    const tokens = earned.map((vp) => (
      <VPItem key={vp.id} vp={vp} player={player} color={col} onMouseEnter={(vp, p, e) => setHoveredVP({ vp, player: p, x: e.clientX, y: e.clientY })} />
    ));
    const slots = Array.from({ length: empties }).map((_, i) => (
      <span key={`e${i}`} className="w-[18px] h-[18px] rounded-[4px] flex-shrink-0" style={{ background: 'rgba(255,255,255,.5)', border: `1.5px dashed ${dash}` }} />
    ));
    const count = (
      <span key="count" className="font-condensed font-extrabold text-[13px] px-0.5" style={{ color: player === 'player1' ? '#1c3f6b' : '#7c2018' }}>{earned.length}/{toWin}</span>
    );
    return player === 'player1' ? [...tokens, ...slots, count] : [count, ...tokens, ...slots];
  };

  // ---- Bottom dock (adapts per phase) ----
  const endButtonLabel = (() => {
    if (gameState.winner) return 'Ukončit hru';
    switch (gameState.phase) {
      case 'distribution-sections': return 'Konec fáze';
      case 'distribution-units': return 'Konec fáze';
      case 'movement': return 'Konec fáze';
      case 'attack': return 'Konec tahu';
      default: return 'Další';
    }
  })();
  const onEndClick = () => {
    if (gameState.winner) { onExit(); return; }
    if (hasAvailableActions()) { setShowConfirm(true); }
    else { if (gameState.phase === 'attack') endTurn(); else nextPhase(); setSelected(null); setActType('none'); }
  };
  const showEndButton = !!(gameState.winner || (isMyTurn && iAmGeneral));
  const EndButton = showEndButton ? (
    <button onClick={onEndClick} className="flex-shrink-0 self-stretch flex flex-col items-center justify-center gap-1 px-6 rounded-[14px] border-none text-white font-condensed font-extrabold text-[15px] tracking-[0.05em] uppercase cursor-pointer transition-opacity hover:opacity-90"
      style={{ background: gameState.winner ? '#c0392b' : (gameState.phase === 'attack' ? '#7c2018' : '#1c3f6b'), boxShadow: '0 6px 16px -6px rgba(28,40,60,.65)' }}>
      <ArrowRight size={20} strokeWidth={2.6} />
      <span>{endButtonLabel}</span>
    </button>
  ) : null;

  const SECTIONS: { id: 'left' | 'center' | 'right'; label: string }[] = [
    { id: 'left', label: 'Levá' }, { id: 'center', label: 'Střed' }, { id: 'right', label: 'Pravá' },
  ];

  const renderDock = () => {
    if (gameState.phase === 'distribution-sections') {
      return (
        <div className="p-[12px_20px] flex items-stretch gap-4">
          <div className="flex flex-col items-center gap-1.5 pr-4 border-r-[1.5px] border-dashed border-[#ccbc94]">
            <span className="font-condensed font-extrabold text-[11px] tracking-[0.1em] uppercase text-tan">Sklad · {wh}</span>
            <CubeBox count={wh} capacity={20} className="flex-1 w-[118px]" />
          </div>
          <div className="flex-1 flex gap-3.5">
            {SECTIONS.map(({ id, label }) => (
              <div key={id} className="flex-1 flex flex-col items-center justify-between gap-1.5 py-1.5 px-2 rounded-[13px]" style={{ background: 'rgba(255,253,247,.6)' }}>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 'Max'].map((v) => (
                    <button key={v} disabled={wh <= 0 || !canDistribute} onClick={() => distributeResource(activeP, id, v === 'Max' ? 'max' : (v as number))}
                      className="px-1.5 py-0.5 rounded-md text-[10px] font-condensed font-extrabold uppercase bg-ally text-white hover:opacity-90 disabled:opacity-30 transition-opacity">
                      {v}
                    </button>
                  ))}
                </div>
                <span className="font-condensed font-extrabold text-[12px] tracking-[0.1em] uppercase text-tan-deep">{label}</span>
                <CubeBox count={res[id]} />
                <div className="flex items-center gap-2.5">
                  <button onClick={() => distributeResource(activeP, id, -1)} disabled={!canDistribute || res[id] <= 0 || wh <= 0}
                    className="w-[30px] h-[30px] rounded-lg border-[1.5px] border-[#c4b289] bg-white text-ally text-[19px] leading-none font-bold flex items-center justify-center disabled:opacity-30 hover:bg-[#f7f0df] transition-colors">−</button>
                  <span className="font-condensed font-extrabold text-[20px] min-w-[22px] text-center text-ally">{res[id]}</span>
                  <button onClick={() => distributeResource(activeP, id, 1)} disabled={!canDistribute || wh <= 0}
                    className="w-[30px] h-[30px] rounded-lg border-none bg-ally text-white text-[19px] leading-none font-bold flex items-center justify-center disabled:opacity-30 hover:opacity-90 transition-opacity">+</button>
                </div>
              </div>
            ))}
          </div>
          {EndButton}
        </div>
      );
    }
    if (gameState.phase === 'distribution-units') {
      return (
        <div className="p-[12px_20px] flex items-stretch gap-4">
          <div className="flex flex-col justify-center gap-1.5 w-[118px] flex-shrink-0 pr-4 border-r-[1.5px] border-dashed border-[#ccbc94]">
            <span className="font-condensed font-extrabold text-[11px] tracking-[0.1em] uppercase text-tan">Přidělení</span>
            <span className="text-[11px] text-tan-text leading-[1.4]">Klikni na jednotku → kostka ze sekce.</span>
          </div>
          <div className="flex-1 flex gap-3.5">
            {SECTIONS.map(({ id, label }) => (
              <div key={id} className="flex-1 flex flex-col items-center justify-between gap-1.5 py-1.5 px-2 rounded-[13px]" style={{ background: 'rgba(255,253,247,.6)' }}>
                <span className="font-condensed font-extrabold text-[12px] tracking-[0.1em] uppercase text-tan-deep">{label}</span>
                <CubeBox count={res[id]} />
                <span className="font-condensed font-extrabold text-[15px]" style={{ color: res[id] > 0 ? '#2c7d42' : '#a99c78' }}>{res[id]} zbývá</span>
              </div>
            ))}
          </div>
          {EndButton}
        </div>
      );
    }
    // movement / attack / gameOver — slim bar
    const u = selected ? gameState.units[selected] : null;
    const ut = u ? uTypes.find(t => t.id === u.typeId) : null;
    const isAttack = gameState.phase === 'attack';
    const msg = isAttack
      ? (ut ? `Zvolena ${ut.name} — klikni na zvýrazněného nepřítele.` : 'Klikni na svou jednotku — zobrazí se cíle v dostřelu.')
      : (ut ? `Zvolena ${ut.name} — klikni na zvýrazněné pole (pohyb ${ut.movement}).` : 'Klikni na svou jednotku — zobrazí se pole pro přesun.');
    const barLabel = gameState.winner ? 'Konec' : (isAttack ? 'Útok' : 'Pohyb');
    return (
      <div className="p-[11px_20px] flex items-center gap-3.5">
        <span className="font-condensed font-extrabold text-[12px] tracking-[0.1em] uppercase flex-shrink-0" style={{ color: gameState.winner ? '#7c2018' : (isAttack ? '#c0392b' : '#2c7d42') }}>{barLabel}</span>
        <span className="flex-1 text-[13px] text-tan-text">{gameState.winner ? 'Bitva byla rozhodnuta.' : msg}</span>
        {EndButton && <div className="flex-shrink-0">{
          <button onClick={onEndClick} className="flex items-center gap-2 px-5 py-2.5 rounded-[10px] border-none text-white font-condensed font-extrabold text-[14px] tracking-[0.05em] uppercase cursor-pointer hover:opacity-90 transition-opacity"
            style={{ background: gameState.winner ? '#c0392b' : (isAttack ? '#7c2018' : '#1c3f6b'), boxShadow: '0 5px 13px -6px rgba(28,40,60,.65)' }}>
            <span>{endButtonLabel}</span><ArrowRight size={17} strokeWidth={2.6} />
          </button>
        }</div>}
      </div>
    );
  };

  const selUnit = selected ? gameState.units[selected] : null;
  const selType = selUnit ? uTypes.find(u => u.id === selUnit.typeId) : null;
  const hoverHex = hovered ? gameState.grid[hovered] : null;
  const hoverTerrain = hoverHex ? tTypes.find(t => t.id === hoverHex.terrainTypeId) : null;
  const idle = !selected && !hovered && !retreatingUnitId && !takeGroundOption;

  // Distinct unit types currently in play, for the idle legend.
  const legendUnits = (() => {
    const seen = new Set<string>();
    const list: { typeId: string; ownerId: string }[] = [];
    Object.values(gameState.units).forEach((u: any) => {
      if (u.figures <= 0) return;
      const key = `${u.typeId}-${u.ownerId}`;
      if (seen.has(key)) return;
      seen.add(key);
      list.push({ typeId: u.typeId, ownerId: u.ownerId });
    });
    return list;
  })();

  return (
    <div className="min-h-screen p-[24px_22px] box-border flex">
      <div className="w-[1440px] max-w-full flex-1 mx-auto min-h-[600px] max-h-[calc(100vh-48px)] rounded-[18px] overflow-hidden relative border border-[#cdbf9a] flex flex-col"
        style={{ background: '#efe4c9', backgroundImage: 'radial-gradient(circle at 18% 12%, rgba(255,255,255,.5), transparent 45%), radial-gradient(circle at 85% 88%, rgba(120,96,52,.12), transparent 50%)', boxShadow: '0 30px 70px -28px rgba(15,23,42,.55)' }}>

        {/* Top bar */}
        <div className="h-[60px] flex-shrink-0 flex items-center justify-between px-5 border-b border-tan-border-soft z-[5]" style={{ background: 'rgba(255,252,244,.86)', backdropFilter: 'blur(8px)' }}>
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={onExit} title="Hlavní menu" className="w-[38px] h-[38px] rounded-[10px] bg-ally flex items-center justify-center hover:opacity-90 transition-opacity flex-shrink-0">
              <ArrowLeft size={18} className="text-white" strokeWidth={2.4} />
            </button>
            <span className="font-condensed font-extrabold text-[17px] tracking-[0.04em] text-ally uppercase truncate">{sc.player1.name}</span>
            <div onMouseLeave={() => setHoveredVP(null)} className="flex items-center gap-1.5 bg-ally/[0.07] border border-ally/20 rounded-lg px-2 py-1.5">{renderVPTokens('player1')}</div>
          </div>

          <div className="flex flex-col items-center gap-0.5 whitespace-nowrap px-2">
            <span className="font-condensed font-bold text-[12px] tracking-[0.2em] text-tan">{turnLabel}</span>
            {gameId && (
              <div className="flex items-center gap-1">
                <button onClick={() => { navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                  className="flex items-center gap-1 text-[8px] font-condensed font-extrabold uppercase bg-ally/[0.08] text-ally px-2 py-0.5 rounded border border-ally/20 hover:bg-ally hover:text-white transition-colors">
                  {copied ? <Check size={8} /> : <Copy size={8} />}{copied ? 'Zkopírováno' : 'Sdílet'}
                </button>
                <button onClick={() => setShowQR(true)} className="flex items-center gap-1 text-[8px] font-condensed font-extrabold uppercase bg-ally/[0.08] text-ally px-2 py-0.5 rounded border border-ally/20 hover:bg-ally hover:text-white transition-colors">
                  <QrCode size={8} /> QR
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 min-w-0 justify-end">
            <div onMouseLeave={() => setHoveredVP(null)} className="flex items-center gap-1.5 bg-axis/[0.06] border border-axis/20 rounded-lg px-2 py-1.5">{renderVPTokens('player2')}</div>
            <span className="font-condensed font-extrabold text-[17px] tracking-[0.04em] text-axis uppercase truncate">{sc.player2.name}</span>
          </div>
        </div>

        {/* Phase strip */}
        <div className="h-[54px] flex-shrink-0 flex items-center justify-between px-5 border-b border-[#ddccaa]" style={{ background: 'rgba(247,240,223,.7)' }}>
          <div className="flex items-center gap-0.5">
            {PHASE_STEPS.map((s, i) => {
              const active = i === phaseIndex; const done = phaseIndex < 0 ? true : i < phaseIndex;
              return (
                <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[9px] font-condensed font-extrabold text-[14px] tracking-[0.04em] whitespace-nowrap"
                  style={{ background: active ? '#1c3f6b' : 'transparent', color: active ? '#fff' : (done ? '#7c8aa0' : '#a99c78') }}>
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-extrabold"
                    style={{ background: active ? '#f5c518' : (done ? '#1c3f6b' : '#e6dcc2'), color: active ? '#1c3f6b' : (done ? '#fff' : '#a99c78') }}>
                    {done ? '✓' : s.l}
                  </span>
                  <span className="hidden sm:inline">{s.t}</span>
                </div>
              );
            })}
          </div>
          <div className="relative" onMouseEnter={() => setShowPhaseInfo(true)} onMouseLeave={() => setShowPhaseInfo(false)}>
            <div className="flex items-center gap-2.5 bg-ally/[0.07] border border-ally/20 rounded-[9px] px-3 py-1.5 max-w-[560px] cursor-help">
              <Info size={15} className="text-ally flex-shrink-0" />
              <span className="font-semibold text-[13px] text-ally truncate">{PHASE_HINTS[gameState.phase] || PHASE_DESCRIPTIONS[gameState.phase]?.text}</span>
            </div>
            {showPhaseInfo && PHASE_DESCRIPTIONS[gameState.phase] && (
              <div className="absolute top-full right-0 mt-2 w-80 bg-parchment-card border-2 border-ally p-4 shadow-2xl rounded-lg z-50">
                <h4 className="font-condensed font-extrabold text-lg border-b-2 border-ally/30 pb-1 mb-2 text-ally uppercase">{PHASE_DESCRIPTIONS[gameState.phase].title}</h4>
                <p className="text-xs text-tan-text leading-relaxed italic">{PHASE_DESCRIPTIONS[gameState.phase].text}</p>
              </div>
            )}
          </div>
        </div>

        {/* Main row: board + floating panels */}
        <div className="flex-1 relative min-w-0 min-h-0 px-4 pt-3 pb-2.5">
          <div className="absolute inset-[12px_16px_10px_16px] flex items-center justify-center">
            <HexGrid
              width={sc.boardWidth} height={sc.boardHeight} hexes={gameState.grid} units={gameState.units}
              terrainTypes={tTypes} unitTypes={uTypes} onHexClick={handleHexClick} onHexMouseEnter={(q,r) => setHovered(`${q},${r}`)} onHexMouseLeave={() => setHovered(null)}
              leftWidth={sc.sections.leftWidth} centerWidth={sc.sections.centerWidth} selectedUnitId={selected}
              highlightedHexes={highlightedHexes} hoveredHex={hovered} activePhase={gameState.phase}
              unitSections={currentUnitSections} onSectionSelect={(s) => assignResourceToUnit(selected, s)}
              labelMode={labelMode}
            />
          </div>

          {retreatingUnitId && (
            <div className={`absolute left-1/2 -translate-x-1/2 z-40 text-center uppercase transition-all duration-300 ${dismissedOverlay ? 'top-2' : 'top-1/2 -translate-y-1/2'}`}>
              <div className={`bg-parchment-card border-[3px] border-axis rounded-2xl shadow-2xl ${dismissedOverlay ? 'p-3 flex items-center gap-4' : 'p-10'}`}>
                <h2 className={`${dismissedOverlay ? 'text-sm' : 'text-3xl'} font-condensed font-extrabold text-axis`}>Ustupte!</h2>
                {!dismissedOverlay && <p className="text-lg mt-2 font-bold text-ink">Zbývá: {retreatingUnitId.count}</p>}
                {!dismissedOverlay && <p className="text-[10px] mt-2 text-tan normal-case">Klikněte na stejné pole pro ztrátu života</p>}
                <button onClick={() => setDismissedOverlay(!dismissedOverlay)} className={`mt-4 bg-axis text-white px-6 py-2 text-sm font-condensed font-extrabold rounded-lg ${dismissedOverlay ? 'mt-0' : ''} hover:opacity-90 transition-opacity`}>
                  {dismissedOverlay ? 'Zobrazit info' : 'Vyřešit'}
                </button>
              </div>
            </div>
          )}
          {takeGroundOption && (
            <div className={`absolute left-1/2 -translate-x-1/2 z-40 text-center uppercase transition-all duration-300 ${dismissedOverlay ? 'top-2' : 'top-1/2 -translate-y-1/2'}`}>
              <div className={`bg-parchment-card border-[3px] border-ally rounded-2xl shadow-2xl ${dismissedOverlay ? 'p-3 flex items-center gap-4' : 'p-10'}`}>
                <h2 className={`${dismissedOverlay ? 'text-sm' : 'text-3xl'} font-condensed font-extrabold text-ally`}>Obsadit pozici?</h2>
                {!dismissedOverlay && <p className="text-sm mt-2 font-bold normal-case text-ink">Klikněte na pole pro přesun, nebo kamkoliv jinam pro zrušení.</p>}
                <div className={`${dismissedOverlay ? 'flex gap-2' : 'mt-6 flex flex-col gap-3'}`}>
                  <button onClick={() => setDismissedOverlay(!dismissedOverlay)} className="bg-ally text-white px-6 py-2 text-sm font-condensed font-extrabold rounded-lg hover:opacity-90 transition-opacity">
                    {dismissedOverlay ? 'Zobrazit' : 'Vyřešit'}
                  </button>
                  <button onClick={() => cancelTakeGround()} className="bg-[#e6dcc2] text-ink px-6 py-2 text-sm font-condensed font-extrabold rounded-lg hover:bg-[#dccfa8] transition-colors">Zrušit</button>
                </div>
              </div>
            </div>
          )}

          {/* Floating info cards (top-right) */}
          <div className="absolute top-3.5 right-4 w-[248px] max-w-[34%] flex flex-col gap-2.5 z-[6] pointer-events-none">
            {selUnit && !retreatingUnitId && (
              <div className="pointer-events-auto rounded-[14px] overflow-hidden" style={{ background: 'rgba(255,253,247,.98)', border: `2px solid ${selUnit.ownerId === 'player1' ? '#1c3f6b' : '#7c2018'}`, boxShadow: '0 16px 34px -16px rgba(28,40,60,.55)' }}>
                <div className="px-3.5 py-2.5 flex items-center justify-between" style={{ background: selUnit.ownerId === 'player1' ? '#1c3f6b' : '#7c2018' }}>
                  <span className="font-condensed font-extrabold text-[18px] text-white uppercase truncate">{selType?.name}</span>
                  <span className="text-[10px] font-bold text-white/70 uppercase tracking-[0.08em] flex-shrink-0">{selUnit.ownerId === 'player1' ? sc.player1.name : sc.player2.name}</span>
                </div>
                <div className="px-[15px] py-3">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-[54px] h-[38px] flex-shrink-0">
                      <svg viewBox="-22 -16 44 32" className="w-full h-full"><NatoSymbol type={selType?.natoSymbol || 'infantry'} owner={selUnit.ownerId} /></svg>
                    </div>
                    <div className="grid grid-cols-[auto_auto] gap-x-2.5 gap-y-1 text-[12px] flex-1">
                      <span className="font-semibold uppercase tracking-[0.04em] text-[#8593a6] text-[10px]">Pohyb</span><span className="font-bold text-right text-ink">{selType?.movement}</span>
                      <span className="font-semibold uppercase tracking-[0.04em] text-[#8593a6] text-[10px]">Dostřel</span><span className="font-bold text-right text-ink">{selType?.shootingRange.join('·')}</span>
                      <span className="font-semibold uppercase tracking-[0.04em] text-[#8593a6] text-[10px]">Zdroje</span><span className="font-bold text-right text-ink">{selUnit.resources} / 3</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between px-2.5 py-2 rounded-[9px] mb-2" style={{ background: '#f1ead6' }}>
                    <span className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#6b5d3a]">Stav</span>
                    <div className="flex gap-1">
                      {Array.from({ length: selType?.maxFigures || selUnit.figures }).map((_, i) => (
                        <div key={i} className="w-[12px] h-[15px] rounded-[2px]" style={i < selUnit.figures ? { background: '#3aa657', border: '1.5px solid #2c7d42' } : { background: '#e6dcc2', border: '1.5px solid #cdbf9a' }} />
                      ))}
                    </div>
                  </div>
                  {selType?.canShootAfterMovingMax === 0 && <p className="text-[9px] text-axis-soft font-bold uppercase mb-1">Nelze útočit po pohybu</p>}
                  {gameState.phase === 'movement' && (
                    <button disabled={selUnit.resources === 0 || (selUnit.movementUsed >= (selType?.movement || 0))} onClick={() => setActType('move')}
                      className={`w-full py-2 rounded-lg text-[11px] font-condensed font-extrabold uppercase tracking-wide transition-colors ${actType === 'move' ? 'bg-gold text-ally' : 'bg-white border border-tan-line text-ink disabled:opacity-40'}`}>Pohyb</button>
                  )}
                  {gameState.phase === 'attack' && (
                    <>
                      <button disabled={selUnit.resources === 0 || selUnit.hasAttacked} onClick={() => setActType('attack')}
                        className={`w-full py-2 rounded-lg text-[11px] font-condensed font-extrabold uppercase tracking-wide transition-colors ${actType === 'attack' ? 'bg-axis text-white' : 'bg-white border border-tan-line text-ink disabled:opacity-40'}`}>Útok</button>
                      {getUnitHex(selected)?.overlayTypeId === 'wire' && (() => {
                        const category = selType?.category || (selType?.id === 'tank' ? 'tank' : (selType?.id === 'artillery' ? 'artillery' : 'infantry'));
                        return category === 'infantry';
                      })() && !selUnit.hasAttacked && (
                        <button disabled={selUnit.resources === 0} onClick={() => destroyOverlay(selected)} className="w-full py-2 rounded-lg text-[11px] font-condensed font-extrabold uppercase tracking-wide bg-[#f4ecd7] text-[#a0764a] hover:bg-[#ece0c4] disabled:opacity-40 mt-2 transition-colors">Zničit ostnatý drát</button>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {hoverHex && (
              <div className="pointer-events-none rounded-[13px] px-3.5 py-3" style={{ background: 'rgba(255,253,247,.96)', border: '1.5px solid #b9a77a', boxShadow: '0 12px 26px -18px rgba(28,40,60,.45)' }}>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-3.5 h-3.5 rounded-full border border-[#5b4f37]" style={{ backgroundColor: terrainColor(hoverTerrain?.color) }} />
                  <span className="font-condensed font-bold text-[16px] text-ink">{hoverTerrain?.name || 'Tráva'}</span>
                </div>
                <p className="m-0 text-[11.5px] leading-[1.45] text-tan-text italic">{hoverTerrain?.description || 'Základní terén bez omezení.'}</p>
                {hoverHex.overlayTypeId && (
                  <div className="mt-2 pt-2 border-t border-tan-border/60">
                    <h4 className="text-[10px] font-extrabold uppercase text-tan-deep">{oTypes.find(o => o.id === hoverHex.overlayTypeId)?.name}</h4>
                    <p className="text-[9px] text-tan-text">
                      {oTypes.find(o => o.id === hoverHex.overlayTypeId)?.description}
                      {oTypes.find(o => o.id === hoverHex.overlayTypeId)?.diceModifierDefense ? ` (Obrana: +${oTypes.find(o => o.id === hoverHex.overlayTypeId).diceModifierDefense})` : ''}
                    </p>
                  </div>
                )}
                {hoverHex.unitId && (
                  <div className="mt-2.5 pt-2 border-t border-tan-border/60">
                    <p className="text-[9px] font-bold uppercase text-tan mb-0.5">Jednotka na poli:</p>
                    <p className="text-[11px] font-bold text-ink">{uTypes.find(u => u.id === gameState.units[hoverHex.unitId].typeId)?.name} ({gameState.units[hoverHex.unitId].ownerId === 'player1' ? sc.player1.name : sc.player2.name})</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Idle legend (bottom-right) */}
          {idle && legendUnits.length > 0 && (
            <div className="absolute bottom-3.5 right-4 z-[6] pointer-events-none rounded-[12px] px-3.5 py-3" style={{ background: 'rgba(255,253,247,.92)', border: '1px solid #cdbf9a', boxShadow: '0 12px 26px -18px rgba(28,40,60,.4)' }}>
              <div className="font-condensed font-bold text-[11px] tracking-[0.16em] uppercase text-tan mb-2">Jednotky ve hře</div>
              <div className="flex flex-wrap gap-2 max-w-[190px]">
                {legendUnits.map(({ typeId, ownerId }) => (
                  <div key={`${typeId}-${ownerId}`} title={uTypes.find(u => u.id === typeId)?.name} className="w-[30px] h-[21px]">
                    <svg viewBox="-22 -16 44 32" className="w-full h-full"><NatoSymbol type={uTypes.find(u => u.id === typeId)?.natoSymbol || typeId} owner={ownerId as any} /></svg>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Utility cluster (bottom-left) */}
          <div className="absolute bottom-3.5 left-4 z-[6] flex flex-col items-start gap-2 pointer-events-none [&>*]:pointer-events-auto">
            {online && (
              <div className="flex items-center gap-2 bg-parchment-card border border-tan-border-soft px-3 py-1.5 rounded-lg shadow-md text-[10px] font-condensed font-extrabold uppercase tracking-wide">
                {spectator ? <Eye size={14} /> : seat?.role === 'general' ? <Crown size={14} /> : <Shield size={14} />}
                <span className="text-ink">{myRoleLabel}{!spectator && ` · ${sc[myTeam!]?.name}`}</span>
                <span className={`ml-1 px-1.5 py-0.5 rounded ${isMyTurn ? 'bg-army text-white' : 'bg-[#e6dcc2] text-tan-deep'}`}>{isMyTurn ? 'VÁŠ TAH' : `NA TAHU: ${sideName(activeP)}`}</span>
                {onChangeSeat && <button onClick={onChangeSeat} className="ml-1 text-ally-soft hover:underline normal-case font-bold">změnit</button>}
              </div>
            )}
            <div className="flex items-center gap-2">
              <button onClick={() => setLabelMode(m => m === 'hidden' ? 'below' : m === 'below' ? 'above' : 'hidden')}
                title={labelMode === 'hidden' ? 'Popisky políček: skryté' : labelMode === 'below' ? 'Popisky: pod jednotkami' : 'Popisky: nad jednotkami'}
                className="w-[36px] h-[36px] rounded-[10px] bg-parchment-card border border-tan-border-soft shadow-md flex items-center justify-center hover:bg-[#f7f0df] transition-colors">
                {labelMode === 'hidden' ? <EyeOff size={18} className="text-tan-deep" /> : <Eye size={18} className={labelMode === 'above' ? 'text-gold' : 'text-tan-deep'} />}
              </button>
              {!gameState.winner && isMyTurn && canUndo() && (gameState.phase === 'movement' || (gameState.phase === 'distribution-sections' && iAmGeneral)) && (
                <button onClick={() => { undoLastAction(); setSelected(null); setActType('none'); }}
                  title={gameState.phase === 'movement' ? 'Vrátit poslední pohyb' : 'Vrátit poslední rozdělení'}
                  className="flex items-center gap-1.5 px-3 h-[36px] rounded-[10px] bg-parchment-card border border-tan-border-soft shadow-md text-tan-deep font-condensed font-extrabold uppercase text-[12px] hover:bg-[#f7f0df] transition-colors">
                  <Undo2 size={16} /> Vrátit
                </button>
              )}
              {gameState.winner && (
                <button onClick={() => setShowStats(true)} title="Statistiky" className="w-[36px] h-[36px] rounded-[10px] bg-parchment-card border border-tan-border-soft shadow-md flex items-center justify-center hover:bg-[#f7f0df] transition-colors">
                  <Trophy size={18} className="text-gold" />
                </button>
              )}
              {sc.victoryGoals && (
                <div className="relative" onMouseEnter={() => setShowGoals(true)} onMouseLeave={() => setShowGoals(false)}>
                  <button onClick={() => setShowGoals(g => !g)} className="flex items-center gap-1.5 px-3 h-[36px] rounded-[10px] bg-parchment-card border border-ally/40 shadow-md text-ally font-condensed font-extrabold uppercase text-[12px] hover:bg-ally/[0.06] transition-colors">
                    <Target size={15} /> Cíle
                  </button>
                  {showGoals && (
                    <div className="absolute bottom-full left-0 mb-2 w-80 bg-parchment-card border-2 border-ally p-4 shadow-2xl rounded-lg z-50">
                      <h4 className="font-condensed font-extrabold text-lg border-b-2 border-ally/30 pb-1 mb-2 flex items-center gap-2 text-ally uppercase"><Target size={18} /> Cíle vítězství</h4>
                      <p className="text-xs text-tan-text leading-relaxed whitespace-pre-line">{sc.victoryGoals}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom dock */}
        <div className="flex-shrink-0 border-t border-tan-border-soft" style={{ background: 'rgba(255,252,244,.92)' }}>{renderDock()}</div>
      </div>

      {/* Overlays & modals (rendered at root so they are never clipped) */}
      {combatResult && <DiceAnimation dice={combatResult.dice} onComplete={() => dismissCombat()} />}

      {gameState.winner && !victoryDismissed && (
        <div className="fixed inset-0 flex items-center justify-center z-[100] p-7" style={{ background: 'rgba(20,28,40,.7)' }}>
          <div className="w-[620px] max-w-full bg-parchment-card rounded-[20px] overflow-hidden shadow-2xl anim-fade-up" style={{ border: `2px solid ${gameState.winner === 'player2' ? '#7c2018' : '#1c3f6b'}` }}>
            <div className="px-7 py-8 text-center" style={{ background: gameState.winner === 'player2' ? '#7c2018' : '#1c3f6b' }}>
              <Trophy size={48} className="text-white mx-auto mb-2" strokeWidth={1.8} />
              <div className="font-condensed font-bold text-[13px] tracking-[0.3em] uppercase text-white/80">Bitva rozhodnuta · {gameState.currentTurn}. tah</div>
              <h1 className="m-0 mt-1 font-condensed font-extrabold text-[42px] text-white tracking-[0.02em]">{gameState.winner === 'player1' ? sc.player1.name : sc.player2.name} vítězí</h1>
            </div>
            <div className="px-7 py-6">
              <div className="flex flex-col gap-3">
                <button onClick={() => setShowStats(true)} className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-ally text-white font-condensed font-extrabold text-base uppercase tracking-[0.05em] hover:opacity-90 transition-opacity">
                  <Trophy size={17} /> Zobrazit statistiky
                </button>
                <button onClick={() => setVictoryDismissed(true)} className="py-3 rounded-xl border-2 border-ally bg-white/50 text-ally font-condensed font-extrabold text-sm uppercase tracking-[0.05em] hover:bg-ally hover:text-white transition-colors">
                  Prohlédnout mapu
                </button>
                <button onClick={onExit} className="text-tan hover:text-axis-soft transition-colors uppercase text-[10px] font-condensed font-extrabold tracking-[0.14em] mt-1">
                  Ukončit hru nyní
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showStats && (
        <StatisticsModal unitStats={gameState.unitStats} scenario={gameState.scenario} unitTypes={uTypes} onClose={() => setShowStats(false)} />
      )}

      {showQR && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-8" style={{ background: 'rgba(22,32,46,.7)', backdropFilter: 'blur(4px)' }} onClick={() => setShowQR(false)}>
          <div className="bg-parchment-card rounded-2xl shadow-2xl border-2 border-ally p-8 flex flex-col items-center gap-5 max-w-sm w-full anim-fade-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between w-full">
              <h3 className="font-condensed font-extrabold uppercase tracking-tight text-xl text-ally">Sdílet hru</h3>
              <button onClick={() => setShowQR(false)} className="text-tan hover:text-ink transition-colors" aria-label="Zavřít"><CloseIcon size={20} /></button>
            </div>
            <p className="text-xs text-tan-text text-center uppercase font-bold tracking-wide">Naskenujte QR kód a připojte se ke hře</p>
            <div className="bg-white p-3 rounded-lg border-2 border-tan-border"><QRCodeSVG value={window.location.href} size={232} level="M" /></div>
            <button onClick={() => { navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
              className="flex items-center gap-1.5 text-[10px] font-condensed font-extrabold uppercase bg-ally/[0.08] text-ally px-3 py-1.5 rounded border border-ally/20 hover:bg-ally hover:text-white transition-colors">
              {copied ? <Check size={12} /> : <Copy size={12} />}{copied ? 'Zkopírováno' : 'Kopírovat odkaz'}
            </button>
          </div>
        </div>
      )}

      {hoveredVP && (
        <div className="fixed z-[100] pointer-events-none bg-parchment-card border-2 border-ally p-4 shadow-2xl rounded-lg w-64"
          style={{ left: hoveredVP.x > window.innerWidth - 300 ? hoveredVP.x - 280 : hoveredVP.x + 20, top: hoveredVP.y + 20 }}>
          <div className="flex items-center gap-2 mb-2 border-b border-tan-border pb-2">
            {hoveredVP.vp.type === 'unit' ? <Skull className="text-tan-deep" size={18} /> : <Star className="text-gold" size={18} fill="currentColor" />}
            <h4 className="font-condensed font-extrabold text-lg text-ink uppercase">{hoveredVP.vp.type === 'unit' ? 'Zničená jednotka' : 'Obsazený cíl'}</h4>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between"><span className="text-tan uppercase font-extrabold text-[9px]">Kolo:</span><span className="font-bold text-ink">{hoveredVP.vp.round}</span></div>
            {hoveredVP.vp.type === 'unit' && hoveredVP.vp.unitStats && (
              <>
                <div className="flex justify-between"><span className="text-tan uppercase font-extrabold text-[9px]">Typ:</span><span className="font-bold text-ink">{uTypes.find(ut => ut.id === hoveredVP.vp.unitStats.unitTypeId)?.name}</span></div>
                <div className="mt-3 pt-2 border-t border-tan-border/60">
                  <p className="text-[9px] font-extrabold uppercase text-tan mb-1 tracking-widest text-center">Statistiky jednotky</p>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="bg-[#f4ecd7] p-1.5 rounded flex flex-col items-center"><Target size={12} className="text-danger mb-0.5" /><span className="font-extrabold text-[10px] text-ink">{hoveredVP.vp.unitStats.damageDealt}</span><span className="text-[8px] uppercase text-tan">Zásahy</span></div>
                    <div className="bg-[#f4ecd7] p-1.5 rounded flex flex-col items-center"><Skull size={12} className="text-ink mb-0.5" /><span className="font-extrabold text-[10px] text-ink">{hoveredVP.vp.unitStats.kills}</span><span className="text-[8px] uppercase text-tan">Zničení</span></div>
                  </div>
                  <div className="mt-2 text-[9px] bg-[#f4ecd7] p-2 rounded italic text-tan-text leading-tight">Tato jednotka byla napadena: {hoveredVP.vp.unitStats.attackers.map(tid => uTypes.find(ut => ut.id === tid)?.name).join(', ') || 'nikým'}</div>
                </div>
              </>
            )}
            {hoveredVP.vp.type === 'objective' && (
              <div className="flex justify-between"><span className="text-tan uppercase font-extrabold text-[9px]">Cíl:</span><span className="font-bold text-ink">{hoveredVP.vp.objectiveName}</span></div>
            )}
          </div>
        </div>
      )}

      {showConfirm && (
        <div className="fixed inset-0 flex items-center justify-center z-[100] uppercase" style={{ background: 'rgba(20,28,40,.5)' }}>
          <div className="bg-parchment-card p-8 rounded-2xl shadow-2xl border-2 border-ally text-center max-w-md anim-fade-up">
            <p className="mb-4 font-condensed font-extrabold text-lg text-ink">Nevyužité možnosti:</p>
            <ul className="list-disc list-inside mb-8 text-left text-xs lowercase leading-relaxed text-tan-text">
              {getUnusedActions().map((r, i) => <li key={i}>{r}</li>)}
            </ul>
            <p className="mb-8 font-condensed font-extrabold text-lg uppercase tracking-wide text-ink">Opravdu chcete pokračovat?</p>
            <div className="flex gap-4 justify-center">
              <button onClick={() => setShowConfirm(false)} className="bg-[#e6dcc2] px-8 py-3 rounded-lg font-condensed font-extrabold text-ink hover:bg-[#dccfa8] transition-colors">Zrušit</button>
              <button onClick={() => { setShowConfirm(false); if (gameState.phase === 'attack') endTurn(); else nextPhase(); setSelected(null); setActType('none'); }} className="bg-ally text-white px-8 py-3 rounded-lg font-condensed font-extrabold hover:opacity-90 transition-opacity">Pokračovat</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default GameView;
