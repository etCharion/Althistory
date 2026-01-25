import React, { useState, useMemo } from 'react'; import { useGameLogic } from '../hooks/useGameLogic'; import HexGrid from './HexGrid'; import DiceAnimation from './DiceAnimation'; import { getAllTerrainTypes, getAllUnitTypes } from '../data/typeUtils'; import { getUnitSections } from '../logic/hexGrid';
const GameView = ({ scenario, onExit }) => {
  const { gameState, combatResult, retreatingUnitId, setCombatResult, distributeResource, nextPhase, endTurn, assignResourceToUnit, moveUnit, attackUnit, retreatUnit, getSelectedReachable, getSelectedTargetable, getUnitHex, hasAvailableActions, getUnusedActions } = useGameLogic(scenario);
  const [selected, setSelected] = useState(null); const [actType, setActType] = useState('none'); const [hovered, setHovered] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const tTypes = getAllTerrainTypes(); const uTypes = getAllUnitTypes(); const activeP = gameState.activePlayerId; const res = gameState.sectionResources[activeP]; const wh = gameState.centralWarehouse[activeP];
  const highlightedHexes = useMemo(() => {
    if (!selected) return {};
    const h = {};
    if (gameState.phase === 'movement' && (actType === 'move' || !gameState.units[selected].hasMoved)) {
      getSelectedReachable(selected).forEach(k => h[k] = 'move');
    } else if (gameState.phase === 'attack' && (actType === 'attack')) {
      getSelectedTargetable(selected).forEach(uid => { const hex = getUnitHex(uid); if (hex) h[`${hex.q},${hex.r}`] = 'attack'; });
    }
    return h;
  }, [selected, actType, gameState.phase, gameState.units, gameState.grid]);
  const currentUnitSections = useMemo(() => {
    if (!selected || gameState.phase !== 'distribution-units') return [];
    const hex = getUnitHex(selected); if (!hex) return [];
    return getUnitSections(hex.q, hex.r, gameState.scenario);
  }, [selected, gameState.phase]);

  const handleHexClick = (q, r) => {
    if (retreatingUnitId) { retreatUnit(retreatingUnitId.unitId, q, r); return; }
    const hex = gameState.grid[`${q},${r}`];
    const unitAtHex = hex?.unitId ? gameState.units[hex.unitId] : null;

    if (gameState.phase === 'movement') {
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
      <div className="w-64 border-r-2 border-map-ink-blue p-4 flex flex-col bg-white/30">
        <h2 className={`text-xl font-bold font-handwriting mb-2 ${activeP === 'player1' ? 'text-blue-800' : 'text-red-800'}`}>{activeP === 'player1' ? scenario.player1.name : scenario.player2.name}</h2>
        <div className="mb-2 p-2 border border-black rounded bg-amber-100 text-center font-bold uppercase text-[10px]">
          {gameState.phase === 'distribution-sections' && 'A) Zdroje do sekcí'}
          {gameState.phase === 'distribution-units' && 'B) Zdroje jednotkám'}
          {gameState.phase === 'movement' && 'C) Pohyb jednotek'}
          {gameState.phase === 'attack' && 'D) Útoky jednotek'}
        </div>
        <div className="mb-4 p-2 border border-black rounded bg-white/50 text-xs"><p className="font-bold border-b border-black mb-1">SKLAD: {wh}</p>
          {gameState.phase === 'distribution-sections' && <div className="grid grid-cols-3 gap-1 mt-1">{['left', 'center', 'right'].map(s => <button key={s} onClick={() => distributeResource(activeP, s)} className="border bg-white p-1 uppercase">{s[0]}</button>)}</div>}
        </div>
        <div className="space-y-1 mb-4 text-xs uppercase">{['left', 'center', 'right'].map(s => <div key={s} className="p-1 border border-black">SEKCE {s}: {res[s]}</div>)}</div>
        <div className="mt-auto space-y-2">
          <button onClick={() => {
            if (hasAvailableActions()) {
              setShowConfirm(true);
            } else {
              if (gameState.phase === 'attack') endTurn(); else nextPhase();
              setSelected(null);
              setActType('none');
            }
          }} className={`w-full ${gameState.phase === 'attack' ? 'bg-map-ink-red' : 'bg-map-ink-blue'} text-white py-2 rounded font-bold uppercase`}>
            {gameState.phase === 'distribution-sections' && 'Rozdělit jednotkám'}
            {gameState.phase === 'distribution-units' && 'Pohyb'}
            {gameState.phase === 'movement' && 'Útok'}
            {gameState.phase === 'attack' && 'Konec tahu'}
          </button>
          <button onClick={onExit} className="w-full border border-black py-1 rounded text-sm uppercase">Menu</button>
        </div>
      </div>
      <div className="flex-1 relative flex flex-col">
        <div className="bg-white/70 p-2 flex justify-center gap-8 font-bold border-b border-map-ink-blue">
           <div className="text-blue-800 uppercase">{scenario.player1.name}: {gameState.victoryPoints.player1} VP</div>
           <div className="text-red-800 uppercase">{scenario.player2.name}: {gameState.victoryPoints.player2} VP</div>
        </div>
        <div className="flex-1 relative overflow-auto">
          <HexGrid
            width={scenario.boardWidth} height={scenario.boardHeight} hexes={gameState.grid} units={gameState.units}
            terrainTypes={tTypes} unitTypes={uTypes} onHexClick={handleHexClick} onHexMouseEnter={(q,r) => setHovered(`${q},${r}`)} onHexMouseLeave={() => setHovered(null)}
            leftWidth={scenario.sections.leftWidth} centerWidth={scenario.sections.centerWidth} selectedUnitId={selected}
            highlightedHexes={highlightedHexes} hoveredHex={hovered} activePhase={gameState.phase}
            unitSections={currentUnitSections} onSectionSelect={(s) => assignResourceToUnit(selected, s)}
          />
          {retreatingUnitId && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white border-4 border-red-600 p-8 rounded shadow-2xl z-50 text-center uppercase"><h2 className="text-2xl font-bold text-red-600 font-handwriting">Ustupte!</h2><p>Zbývá: {retreatingUnitId.count}</p></div>}
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
                  {gameState.phase === 'attack' && <button disabled={gameState.units[selected].resources === 0 || gameState.units[selected].hasAttacked} onClick={() => setActType('attack')} className={`w-full p-2 rounded border text-[10px] font-bold ${actType === 'attack' ? 'bg-red-200' : 'bg-white disabled:opacity-50 uppercase'}`}>ÚTOK</button>}
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
  );
};
export default GameView;
