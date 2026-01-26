import React, { useState, useMemo, useEffect } from 'react'; import { useGameLogic } from '../hooks/useGameLogic'; import HexGrid from './HexGrid'; import DiceAnimation from './DiceAnimation'; import { getAllTerrainTypes, getAllUnitTypes, getAllOverlayTypes } from '../data/typeUtils'; import { getUnitSections, axialToOffset, getSection } from '../logic/hexGrid';
import { Menu, Info, ChevronRight, X as CloseIcon } from 'lucide-react';

const ResourceCube = () => (
  <div className="w-3 h-3 bg-green-600 border border-green-800 rounded-sm shadow-sm animate-in zoom-in duration-300" />
);

const Misticka = ({ title, count, onAdd, buttons, active, warehouse = false }) => (
  <div className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${active ? 'scale-105' : 'opacity-40'}`}>
    {!warehouse && <span className="text-[10px] font-bold uppercase text-map-ink-blue">{title}</span>}
    <div className={`${warehouse ? 'w-48 h-20' : 'w-24 h-16'} border-2 ${active ? 'border-map-ink-blue' : 'border-gray-400'} rounded-2xl flex flex-wrap gap-1 p-2 items-start content-start overflow-hidden bg-white/40 shadow-inner relative`}>
       {Array.from({ length: Math.min(count, 50) }).map((_, i) => <ResourceCube key={i} />)}
       {count > 50 && <span className="absolute bottom-1 right-1 text-[8px] font-bold">+{count-50}</span>}
       {count === 0 && <span className="absolute inset-0 flex items-center justify-center text-[8px] uppercase opacity-20">Prázdno</span>}
    </div>
    {warehouse && <span className="text-[10px] font-bold uppercase text-map-ink-blue mt-1">Sklad: {count}</span>}
    {buttons && (
      <div className="flex gap-1 mt-1">
        {[1, 2, 3, 'Max'].map(v => (
          <button
            key={v}
            onClick={() => onAdd(v === 'Max' ? 'max' : v)}
            className="px-1.5 py-0.5 bg-white border border-map-ink-blue rounded text-[8px] font-bold hover:bg-map-ink-blue hover:text-white transition-colors uppercase"
          >
            {v}
          </button>
        ))}
      </div>
    )}
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
  const tTypes = getAllTerrainTypes(); const uTypes = getAllUnitTypes(); const oTypes = getAllOverlayTypes(); const activeP = gameState.activePlayerId; const res = gameState.sectionResources[activeP]; const wh = gameState.centralWarehouse[activeP];
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
          <div className="flex-1 relative overflow-auto">
          <HexGrid
            width={scenario.boardWidth} height={scenario.boardHeight} hexes={gameState.grid} units={gameState.units}
            terrainTypes={tTypes} unitTypes={uTypes} onHexClick={handleHexClick} onHexMouseEnter={(q,r) => setHovered(`${q},${r}`)} onHexMouseLeave={() => setHovered(null)}
            leftWidth={scenario.sections.leftWidth} centerWidth={scenario.sections.centerWidth} selectedUnitId={selected}
            highlightedHexes={highlightedHexes} hoveredHex={hovered} activePhase={gameState.phase}
            unitSections={currentUnitSections} onSectionSelect={(s) => assignResourceToUnit(selected, s)}
          />
          {retreatingUnitId && (
            <div className={`absolute left-1/2 -translate-x-1/2 z-50 text-center uppercase transition-all duration-300 ${dismissedOverlay ? 'top-2' : 'top-1/2 -translate-y-1/2'}`}>
              <div className={`bg-white border-4 border-red-600 rounded shadow-2xl ${dismissedOverlay ? 'p-2 flex items-center gap-4' : 'p-8'}`}>
                <h2 className={`${dismissedOverlay ? 'text-sm' : 'text-2xl'} font-bold text-red-600 font-handwriting`}>Ustupte!</h2>
                {!dismissedOverlay && <p>Zbývá: {retreatingUnitId.count}</p>}
                {!dismissedOverlay && <p className="text-[10px] mt-2 text-gray-500">Klikněte na stejné pole pro ztrátu života</p>}
                <button onClick={() => setDismissedOverlay(!dismissedOverlay)} className={`mt-2 bg-red-600 text-white px-4 py-1 text-xs font-bold rounded ${dismissedOverlay ? 'mt-0' : ''}`}>
                  {dismissedOverlay ? 'Zobrazit info' : 'Vyřešit'}
                </button>
              </div>
            </div>
          )}
          {takeGroundOption && (
            <div className={`absolute left-1/2 -translate-x-1/2 z-50 text-center uppercase transition-all duration-300 ${dismissedOverlay ? 'top-2' : 'top-1/2 -translate-y-1/2'}`}>
              <div className={`bg-white border-4 border-blue-600 rounded shadow-2xl ${dismissedOverlay ? 'p-2 flex items-center gap-4' : 'p-8'}`}>
                <h2 className={`${dismissedOverlay ? 'text-sm' : 'text-2xl'} font-bold text-blue-600 font-handwriting`}>Obsadit pozici?</h2>
                {!dismissedOverlay && <p>Klikněte na pole pro přesun, nebo kamkoliv jinam pro zrušení.</p>}
                <div className={`${dismissedOverlay ? 'flex gap-2' : 'mt-4 flex flex-col gap-2'}`}>
                  <button onClick={() => setDismissedOverlay(!dismissedOverlay)} className="bg-blue-600 text-white px-4 py-1 text-xs font-bold rounded">
                    {dismissedOverlay ? 'Zobrazit' : 'Vyřešit'}
                  </button>
                  <button onClick={() => setTakeGroundOption(null)} className="bg-gray-200 px-4 py-1 text-xs font-bold rounded">Zrušit</button>
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

        {/* Bottom controls */}
        <div className="absolute bottom-6 left-6 z-50 flex flex-col gap-2 pointer-events-none">
           <div className="flex gap-2 pointer-events-auto">
              <button onClick={onExit} title="Menu" className="p-3 bg-white border-2 border-map-ink-blue rounded-full shadow-lg hover:bg-gray-100 transition-colors">
                <Menu size={24} className="text-map-ink-blue" />
              </button>
              <button onClick={() => {
                  if (hasAvailableActions()) { setShowConfirm(true); }
                  else { if (gameState.phase === 'attack') endTurn(); else nextPhase(); setSelected(null); setActType('none'); }
                }} className={`px-6 py-2 rounded-full shadow-lg font-bold uppercase transition-colors border-2 ${gameState.phase === 'attack' ? 'bg-map-ink-red border-red-800 text-white hover:bg-red-700' : 'bg-map-ink-blue border-blue-900 text-white hover:bg-blue-800'}`}>
                {gameState.phase === 'attack' ? 'Konec tahu' : (gameState.phase === 'distribution-sections' ? 'Ukončit přidělování' : 'Další fáze')}
              </button>
           </div>

           <div className="relative pointer-events-auto group">
              <div
                onMouseEnter={() => setShowPhaseInfo(true)}
                onMouseLeave={() => setShowPhaseInfo(false)}
                className="bg-white/90 border-2 border-map-ink-blue px-4 py-2 rounded-lg shadow-md cursor-help flex items-center gap-2"
              >
                <Info size={16} className="text-map-ink-blue" />
                <span className="font-bold uppercase text-[10px]">
                  {PHASE_DESCRIPTIONS[gameState.phase].title}
                </span>
              </div>

              {showPhaseInfo && (
                <div className="absolute bottom-full left-0 mb-2 w-64 bg-white border-2 border-map-ink-blue p-4 shadow-xl rounded-xl animate-in fade-in slide-in-from-bottom-2 duration-200 z-50">
                   <h4 className="font-bold font-handwriting text-lg border-b border-map-ink-blue pb-1 mb-2">{PHASE_DESCRIPTIONS[gameState.phase].title}</h4>
                   <p className="text-[10px] text-gray-700 leading-relaxed italic">{PHASE_DESCRIPTIONS[gameState.phase].text}</p>
                </div>
              )}
           </div>
        </div>

        {/* Resource UI */}
        <div className="h-48 bg-white/30 border-t border-map-ink-blue/20 flex flex-col items-center justify-center relative overflow-visible pt-2">
            <div className="flex items-center gap-12 relative">
               {/* Warehouse at the bottom center */}
               <div className="absolute top-24 left-1/2 -translate-x-1/2">
                  <Misticka count={wh} active={gameState.phase === 'distribution-sections'} warehouse />
               </div>

               {/* Section bowls */}
               <div className="flex gap-4 mb-16">
                  <div className="relative">
                    <Misticka title="Levá" count={res.left} active={gameState.phase === 'distribution-sections' || (gameState.phase === 'distribution-units' && res.left > 0)} onAdd={(v) => distributeResource(activeP, 'left', v)} buttons={gameState.phase === 'distribution-sections' && wh > 0} />
                    {gameState.phase === 'distribution-sections' && wh > 0 && <ChevronRight className="absolute -bottom-4 left-1/2 -translate-x-1/2 rotate-[120deg] text-map-ink-blue/30" size={20} />}
                  </div>
                  <div className="relative">
                    <Misticka title="Střed" count={res.center} active={gameState.phase === 'distribution-sections' || (gameState.phase === 'distribution-units' && res.center > 0)} onAdd={(v) => distributeResource(activeP, 'center', v)} buttons={gameState.phase === 'distribution-sections' && wh > 0} />
                    {gameState.phase === 'distribution-sections' && wh > 0 && <ChevronRight className="absolute -bottom-6 left-1/2 -translate-x-1/2 -rotate-90 text-map-ink-blue/30" size={20} />}
                  </div>
                  <div className="relative">
                    <Misticka title="Pravá" count={res.right} active={gameState.phase === 'distribution-sections' || (gameState.phase === 'distribution-units' && res.right > 0)} onAdd={(v) => distributeResource(activeP, 'right', v)} buttons={gameState.phase === 'distribution-sections' && wh > 0} />
                    {gameState.phase === 'distribution-sections' && wh > 0 && <ChevronRight className="absolute -bottom-4 left-1/2 -translate-x-1/2 -rotate-[30deg] text-map-ink-blue/30" size={20} />}
                  </div>
               </div>
            </div>
            {gameState.phase === 'distribution-units' && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 text-[9px] font-bold text-map-ink-blue uppercase bg-white/50 px-3 py-1 rounded-full animate-pulse">
                Klikněte na jednotku pro přidělení zdrojů ze sekce
              </div>
            )}
        </div>
      {combatResult && <DiceAnimation dice={combatResult.dice} onComplete={() => setCombatResult(null)} />}
      {gameState.winner && <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100]"><div className="bg-white p-12 rounded-3xl text-center border-8 border-map-paper shadow-2xl"><h1 className="text-5xl font-bold font-handwriting mb-4 text-map-ink-blue uppercase">Vítězství!</h1><p className="mb-8">{gameState.winner === 'player1' ? scenario.player1.name : scenario.player2.name} vyhrál.</p><button onClick={onExit} className="bg-map-ink-red text-white px-8 py-3 rounded text-xl uppercase font-bold">Zpět</button></div></div>}
      {showConfirm && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] uppercase">
        <div className="bg-white p-6 rounded shadow-xl border-4 border-map-ink-blue text-center max-w-sm">
          <p className="mb-2 font-bold">Nevyužité možnosti:</p>
          <ul className="list-disc list-inside mb-6 text-left text-[10px] lowercase">
            {getUnusedActions().map((r, i) => <li key={i}>{r}</li>)}
          </ul>
          <p className="mb-6 font-bold uppercase">Opravdu chcete pokračovat?</p>
          <div className="flex gap-4 justify-center">
            <button onClick={() => setShowConfirm(false)} className="bg-gray-200 px-4 py-2 rounded font-bold">Zrušit</button>
            <button onClick={() => { setShowConfirm(false); if (gameState.phase === 'attack') endTurn(); else nextPhase(); setSelected(null); setActType('none'); }} className="bg-map-ink-blue text-white px-4 py-2 rounded font-bold">Pokračovat</button>
          </div>
        </div>
      </div>}
      </div>
    </div>
  );
};
export default GameView;
