import React, { useState, useMemo, useEffect } from 'react'; import { useGameLogic } from '../hooks/useGameLogic'; import HexGrid from './HexGrid'; import DiceAnimation from './DiceAnimation'; import { getAllTerrainTypes, getAllUnitTypes, getAllOverlayTypes } from '../data/typeUtils'; import { getUnitSections, axialToOffset, getSection } from '../logic/hexGrid';
import { Menu, Info } from 'lucide-react';

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

const GameView = ({ scenario, onExit }) => {
  const { gameState, combatResult, retreatingUnitId, setCombatResult, takeGroundOption, setTakeGroundOption, takeGround, destroyOverlay, distributeResource, nextPhase, endTurn, assignResourceToUnit, moveUnit, attackUnit, retreatUnit, getSelectedReachable, getSelectedTargetable, getRetreatHexes, getUnitHex, hasAvailableActions, getUnusedActions } = useGameLogic(scenario);
  const [selected, setSelected] = useState(null); const [actType, setActType] = useState('none'); const [hovered, setHovered] = useState(null);
  const [dismissedOverlay, setDismissedOverlay] = useState(false);
  const [showPhaseInfo, setShowPhaseInfo] = useState(false);

  useEffect(() => {
    if (retreatingUnitId || takeGroundOption) {
      setDismissedOverlay(false);
    }
  }, [retreatingUnitId?.unitId, takeGroundOption?.unitId]);
  const [showConfirm, setShowConfirm] = useState(false);

  const tTypes = getAllTerrainTypes();
  const uTypes = getAllUnitTypes();
  const oTypes = getAllOverlayTypes();

  const activeP = gameState.activePlayerId;
  const res = gameState.sectionResources[activeP];
  const wh = gameState.centralWarehouse[activeP];

  const highlightedHexes = useMemo(() => {
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
  }, [selected, actType, gameState.phase, gameState.units, gameState.grid, retreatingUnitId, takeGroundOption]);
  const currentUnitSections = useMemo(() => {
    if (!selected || gameState.phase !== 'distribution-units') return [];
    const hex = getUnitHex(selected); if (!hex) return [];
    return getUnitSections(hex.q, hex.r, gameState.scenario);
  }, [selected, gameState.phase]);

  const handleHexClick = (q, r) => {
    if (retreatingUnitId) { retreatUnit(retreatingUnitId.unitId, q, r); return; }
    if (takeGroundOption) { takeGround(takeGroundOption.unitId, q, r); return; }
    const hex = gameState.grid[`${q},${r}`];
    const unitAtHex = hex?.unitId ? gameState.units[hex.unitId] : null;

    if (gameState.phase === 'distribution-sections') {
      const { col } = axialToOffset(q, r);
      const section = getSection(col, gameState.scenario.sections.leftWidth, gameState.scenario.sections.centerWidth);
      distributeResource(activeP, section);
    } else if (gameState.phase === 'movement') {
      if (unitAtHex && unitAtHex.ownerId === activeP) {
        setSelected(hex.unitId);
        setActType('move');
      } else if (selected && !unitAtHex) {
        moveUnit(selected, q, r);
      } else {
        setSelected(null);
        setActType('none');
      }
    } else if (gameState.phase === 'attack') {
      if (unitAtHex && unitAtHex.ownerId === activeP) {
        setSelected(hex.unitId);
        setActType('attack');
      } else if (selected && unitAtHex && unitAtHex.ownerId !== activeP) {
        attackUnit(selected, hex.unitId);
      } else {
        setSelected(null);
        setActType('none');
      }
    } else if (gameState.phase === 'distribution-units') {
      if (unitAtHex && unitAtHex.ownerId === activeP) {
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
        <div className="bg-white/70 p-2 flex justify-center gap-8 font-bold border-b border-map-ink-blue z-20">
           <div className="text-blue-800 uppercase">{scenario.player1.name}: {gameState.victoryPoints.player1} VP</div>
           <div className="text-red-800 uppercase">{scenario.player2.name}: {gameState.victoryPoints.player2} VP</div>
           <div className="absolute right-4 top-2 text-[10px] uppercase opacity-50">Turn {gameState.currentTurn}</div>
        </div>
        <div className="flex-1 relative flex flex-col overflow-hidden">
          <div className="flex-1 relative overflow-auto pb-16">
          <HexGrid
            width={scenario.boardWidth} height={scenario.boardHeight} hexes={gameState.grid} units={gameState.units}
            terrainTypes={tTypes} unitTypes={uTypes} onHexClick={handleHexClick} onHexMouseEnter={(q,r) => setHovered(`${q},${r}`)} onHexMouseLeave={() => setHovered(null)}
            leftWidth={scenario.sections.leftWidth} centerWidth={scenario.sections.centerWidth} selectedUnitId={selected}
            highlightedHexes={highlightedHexes} hoveredHex={hovered} activePhase={gameState.phase}
            unitSections={currentUnitSections} onSectionSelect={(s) => assignResourceToUnit(selected, s)}
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
                  <button onClick={() => setTakeGroundOption(null)} className="bg-gray-200 text-slate-800 px-6 py-2 text-sm font-bold rounded-lg hover:bg-gray-300 transition-colors">Zrušit</button>
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
                      {getUnitHex(selected)?.overlayTypeId === 'wire' && gameState.units[selected].typeId === 'infantry' && !gameState.units[selected].hasAttacked && (
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
                     <p className="text-[11px] font-bold">{uTypes.find(u => u.id === gameState.units[gameState.grid[hovered].unitId].typeId)?.name} ({gameState.units[gameState.grid[hovered].unitId].ownerId === 'player1' ? scenario.player1.name : scenario.player2.name})</p>
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
                            disabled={wh <= 0}
                            onClick={() => distributeResource(activeP, section, v === 'Max' ? 'max' : v)}
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

              {gameState.phase === 'distribution-units' && (
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 text-[10px] font-black text-slate-900 uppercase bg-white/90 px-4 py-1.5 rounded-lg shadow-lg border border-slate-800 animate-bounce whitespace-nowrap tracking-widest z-50">
                  Přidělte zdroje jednotkám na mapě
                </div>
              )}
          </div>
        )}

        {/* Floating Controls */}
        <div className="fixed bottom-4 left-4 z-50 flex flex-col gap-2 pointer-events-none">
           <div className="flex gap-2 pointer-events-auto">
              <button onClick={onExit} title="Menu" className="p-2 bg-slate-800 border-2 border-slate-800 rounded-lg shadow-lg hover:bg-slate-700 transition-colors">
                <Menu size={20} className="text-white" />
              </button>
              <button onClick={() => {
                  if (hasAvailableActions()) { setShowConfirm(true); }
                  else { if (gameState.phase === 'attack') endTurn(); else nextPhase(); setSelected(null); setActType('none'); }
                }} className={`px-4 py-2 rounded-lg shadow-lg font-bold uppercase text-sm transition-colors border-2 ${gameState.phase === 'attack' ? 'bg-red-800 border-red-900 text-white hover:bg-red-700' : 'bg-slate-800 border-slate-900 text-white hover:bg-slate-700'}`}>
                {(() => {
                  switch (gameState.phase) {
                    case 'distribution-sections': return 'Ukončit rozdělování';
                    case 'distribution-units': return 'Ukončit přidělování';
                    case 'movement': return 'Ukončit pohyb';
                    case 'attack': return 'Konec tahu';
                    default: return 'Další';
                  }
                })()}
              </button>
           </div>

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
        </div>
      {combatResult && <DiceAnimation dice={combatResult.dice} onComplete={() => setCombatResult(null)} />}
      {gameState.winner && <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100]"><div className="bg-white p-12 rounded-3xl text-center border-8 border-map-paper shadow-2xl"><h1 className="text-5xl font-bold font-handwriting mb-4 text-map-ink-blue uppercase">Vítězství!</h1><p className="mb-8">{gameState.winner === 'player1' ? scenario.player1.name : scenario.player2.name} vyhrál.</p><button onClick={onExit} className="bg-map-ink-red text-white px-8 py-3 rounded text-xl uppercase font-bold">Zpět</button></div></div>}
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
