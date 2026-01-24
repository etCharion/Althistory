import React, { useState } from 'react'; import { useGameLogic } from '../hooks/useGameLogic'; import HexGrid from './HexGrid'; import DiceAnimation from './DiceAnimation'; import { getAllTerrainTypes, getAllUnitTypes } from '../data/typeUtils';
const GameView = ({ scenario, onExit }) => {
  const { gameState, combatResult, retreatingUnitId, setCombatResult, distributeResource, startActionPhase, endTurn, assignResourceToUnit, moveUnit, attackUnit, retreatUnit } = useGameLogic(scenario);
  const [selected, setSelected] = useState(null); const [actType, setActType] = useState('none');
  const tTypes = getAllTerrainTypes(); const uTypes = getAllUnitTypes(); const activeP = gameState.activePlayerId; const res = gameState.sectionResources[activeP]; const wh = gameState.centralWarehouse[activeP];
  const handleHexClick = (q, r) => {
    if (retreatingUnitId) { retreatUnit(retreatingUnitId.unitId, q, r); return; }
    const hex = gameState.grid[`${q},${r}`];
    if (gameState.phase === 'actions') {
      if (selected) {
        if (actType === 'move') { moveUnit(selected, q, r); setSelected(null); setActType('none'); }
        else if (actType === 'attack' && hex?.unitId) { attackUnit(selected, hex.unitId); setSelected(null); setActType('none'); }
        else if (hex?.unitId && gameState.units[hex.unitId].ownerId === activeP) setSelected(hex.unitId);
        else setSelected(null);
      } else if (hex?.unitId && gameState.units[hex.unitId].ownerId === activeP) setSelected(hex.unitId);
    }
  };
  return (
    <div className="flex h-screen bg-map-paper overflow-hidden font-military">
      <div className="w-64 border-r-2 border-map-ink-blue p-4 flex flex-col bg-white/30">
        <h2 className={`text-xl font-bold font-handwriting mb-2 ${activeP === 'player1' ? 'text-blue-800' : 'text-red-800'}`}>{activeP === 'player1' ? scenario.player1.name : scenario.player2.name}</h2>
        <div className="mb-4 p-2 border border-black rounded bg-white/50 text-xs"><p className="font-bold border-b border-black mb-1">SKLAD: {wh}</p>
          {gameState.phase === 'distribution' && <div className="grid grid-cols-3 gap-1 mt-1">{['left', 'center', 'right'].map(s => <button key={s} onClick={() => distributeResource(activeP, s)} className="border bg-white p-1 uppercase">{s[0]}</button>)}</div>}
        </div>
        <div className="space-y-1 mb-4 text-xs uppercase">{['left', 'center', 'right'].map(s => <div key={s} className="p-1 border border-black">SEKCE {s}: {res[s]}</div>)}</div>
        <div className="mt-auto space-y-2">
          {gameState.phase === 'distribution' ? <button onClick={startActionPhase} disabled={wh > 0} className="w-full bg-map-ink-blue text-white py-2 rounded font-bold disabled:opacity-50 uppercase">Akce</button>
          : <button onClick={endTurn} className="w-full bg-map-ink-red text-white py-2 rounded font-bold uppercase">Konec tahu</button>}
          <button onClick={onExit} className="w-full border border-black py-1 rounded text-sm uppercase">Menu</button>
        </div>
      </div>
      <div className="flex-1 relative flex flex-col">
        <div className="bg-white/70 p-2 flex justify-center gap-8 font-bold border-b border-map-ink-blue">
           <div className="text-blue-800 uppercase">{scenario.player1.name}: {gameState.victoryPoints.player1} VP</div>
           <div className="text-red-800 uppercase">{scenario.player2.name}: {gameState.victoryPoints.player2} VP</div>
        </div>
        <div className="flex-1 relative overflow-auto">
          <HexGrid width={scenario.boardWidth} height={scenario.boardHeight} hexes={gameState.grid} units={gameState.units} terrainTypes={tTypes} onHexClick={handleHexClick} leftWidth={scenario.sections.leftWidth} centerWidth={scenario.sections.centerWidth} />
          {retreatingUnitId && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white border-4 border-red-600 p-8 rounded shadow-2xl z-50 text-center uppercase"><h2 className="text-2xl font-bold text-red-600 font-handwriting">Ustupte!</h2><p>Zbývá: {retreatingUnitId.count}</p></div>}
          {selected && !retreatingUnitId && <div className="absolute top-4 right-4 bg-white/90 p-4 border-2 border-map-ink-blue shadow rounded w-48 z-40">
            <h3 className="font-bold mb-2 font-handwriting">{uTypes.find(u => u.id === gameState.units[selected].typeId)?.name}</h3>
            <div className="flex flex-col gap-2">
              <button disabled={gameState.units[selected].resources >= 3} onClick={() => assignResourceToUnit(selected)} className="bg-map-ink-blue text-white p-2 rounded text-[10px] font-bold uppercase">Přidat zdroj</button>
              <div className="grid grid-cols-2 gap-1">
                <button disabled={gameState.units[selected].resources === 0 || gameState.units[selected].hasMoved} onClick={() => setActType('move')} className={`p-1 rounded border text-[10px] font-bold ${actType === 'move' ? 'bg-yellow-200' : 'bg-white disabled:opacity-50'}`}>POHYB</button>
                <button disabled={gameState.units[selected].resources === 0 || gameState.units[selected].hasAttacked} onClick={() => setActType('attack')} className={`p-1 rounded border text-[10px] font-bold ${actType === 'attack' ? 'bg-red-200' : 'bg-white disabled:opacity-50'}`}>ÚTOK</button>
              </div>
            </div>
          </div>}
        </div>
      </div>
      {combatResult && <DiceAnimation dice={combatResult.dice} onComplete={() => setCombatResult(null)} />}
      {gameState.winner && <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100]"><div className="bg-white p-12 rounded-3xl text-center border-8 border-map-paper shadow-2xl"><h1 className="text-5xl font-bold font-handwriting mb-4 text-map-ink-blue uppercase">Vítězství!</h1><p className="mb-8">{gameState.winner === 'player1' ? scenario.player1.name : scenario.player2.name} vyhrál.</p><button onClick={onExit} className="bg-map-ink-red text-white px-8 py-3 rounded text-xl uppercase font-bold">Zpět</button></div></div>}
    </div>
  );
};
export default GameView;
