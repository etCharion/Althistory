import { useState, useMemo } from 'react';
import { getDistance, getLine, axialToOffset, getSection } from '../logic/hexGrid';
import { DEFAULT_TERRAIN_TYPES, DEFAULT_UNIT_TYPES } from '../data/defaults';
import { rollDice } from '../logic/dice';
export function useGameLogic(scenario) {
  const [combatResult, setCombatResult] = useState(null);
  const [retreatingUnitId, setRetreatingUnitId] = useState(null);
  const initialGrid = useMemo(() => {
    const grid = {}; scenario.initialHexes.forEach(h => { grid[`${h.q},${h.r}`] = { ...h }; });
    for (let r = 0; r < scenario.boardHeight; r++) { for (let col = 0; col < scenario.boardWidth; col++) { const q = col - Math.floor(r / 2); const key = `${q},${r}`; if (!grid[key]) grid[key] = { q, r, s: -q - r, terrainTypeId: 'grass' }; } }
    return grid;
  }, [scenario]);
  const initialUnits = useMemo(() => { const units = {}; scenario.initialUnits.forEach(u => { units[u.id] = { ...u }; }); return units; }, [scenario]);
  const [gameState, setGameState] = useState({ scenario, currentTurn: 1, activePlayerId: scenario.firstPlayerId, phase: 'distribution', sectionResources: { player1: { left: 0, center: 0, right: 0 }, player2: { left: 0, center: 0, right: 0 } }, centralWarehouse: { player1: scenario.player1.income, player2: scenario.player2.income }, units: initialUnits, grid: initialGrid, victoryPoints: { player1: 0, player2: 0 } });
  const getUnitHex = (uid) => Object.values(gameState.grid).find(h => h.unitId === uid) || null;
  const getTerrainAt = (q, r) => { const hex = gameState.grid[`${q},${r}`]; return DEFAULT_TERRAIN_TYPES.find(t => t.id === hex?.terrainTypeId) || DEFAULT_TERRAIN_TYPES[0]; };
  const checkLOS = (from, to) => {
    const line = getLine(from, to); if (line.length <= 2) return true;
    for (let i = 1; i < line.length - 1; i++) { const h = gameState.grid[`${line[i].q},${line[i].r}`]; if (h?.unitId || DEFAULT_TERRAIN_TYPES.find(t => t.id === h?.terrainTypeId)?.blocksLOS) return false; }
    return true;
  };
  const distributeResource = (pid, sec) => {
    if (gameState.phase !== 'distribution' || gameState.activePlayerId !== pid || gameState.centralWarehouse[pid] <= 0) return;
    setGameState(prev => ({ ...prev, centralWarehouse: { ...prev.centralWarehouse, [pid]: prev.centralWarehouse[pid] - 1 }, sectionResources: { ...prev.sectionResources, [pid]: { ...prev.sectionResources[pid], [sec]: prev.sectionResources[pid][sec] + 1 } } }));
  };
  const startActionPhase = () => { if (gameState.phase === 'distribution' && gameState.centralWarehouse[gameState.activePlayerId] === 0) setGameState(prev => ({ ...prev, phase: 'actions' })); };
  const endTurn = () => {
    setGameState(prev => {
      const next = prev.activePlayerId === 'player1' ? 'player2' : 'player1'; const newUnits = { ...prev.units };
      Object.keys(newUnits).forEach(id => { if (newUnits[id].ownerId === prev.activePlayerId) newUnits[id] = { ...newUnits[id], resources: Math.min(newUnits[id].resources, 1), hasMoved: false, hasAttacked: false }; });
      return { ...prev, activePlayerId: next, phase: 'distribution', currentTurn: prev.activePlayerId === 'player2' ? prev.currentTurn + 1 : prev.currentTurn, centralWarehouse: { ...prev.centralWarehouse, [next]: prev.scenario[next].income }, units: newUnits };
    });
  };
  const assignResourceToUnit = (uid) => {
    const unit = gameState.units[uid]; if (gameState.phase !== 'actions' || !unit || unit.ownerId !== gameState.activePlayerId || unit.resources >= 3) return;
    const hex = getUnitHex(uid); if (!hex) return; const { col } = axialToOffset(hex.q, hex.r); const sec = getSection(col, gameState.scenario.sections.leftWidth, gameState.scenario.sections.centerWidth);
    if (gameState.sectionResources[gameState.activePlayerId][sec] <= 0) return;
    setGameState(prev => ({ ...prev, sectionResources: { ...prev.sectionResources, [prev.activePlayerId]: { ...prev.sectionResources[prev.activePlayerId], [sec]: prev.sectionResources[prev.activePlayerId][sec] - 1 } }, units: { ...prev.units, [uid]: { ...unit, resources: unit.resources + 1 } } }));
  };
  const moveUnit = (uid, tq, tr) => {
    const unit = gameState.units[uid]; if (!unit || unit.resources <= 0 || unit.hasMoved) return;
    const fHex = getUnitHex(uid); if (!fHex) return; const dist = getDistance(fHex, { q: tq, r: tr }); const utype = DEFAULT_UNIT_TYPES.find(ut => ut.id === unit.typeId);
    if (!utype || dist > utype.movement || gameState.grid[`${tq},${tr}`]?.unitId) return;
    setGameState(prev => { const nGrid = { ...prev.grid }; nGrid[`${fHex.q},${fHex.r}`].unitId = undefined; nGrid[`${tq},${tr}`].unitId = uid; return { ...prev, grid: nGrid, units: { ...prev.units, [uid]: { ...unit, resources: unit.resources - 1, hasMoved: true, hasAttacked: dist > utype.canShootAfterMovingMax ? true : unit.hasAttacked } } }; });
  };
  const attackUnit = (aid, tid) => {
    const att = gameState.units[aid]; const tar = gameState.units[tid]; if (!att || !tar || att.resources <= 0 || att.hasAttacked) return;
    const fH = getUnitHex(aid); const tH = getUnitHex(tid); if (!fH || !tH) return; const dist = getDistance(fH, tH); const utype = DEFAULT_UNIT_TYPES.find(u => u.id === att.typeId);
    if (!utype || dist > utype.shootingRange.length || !checkLOS(fH, tH)) return;
    let dC = utype.shootingRange[dist-1] - getTerrainAt(tH.q, tH.r).diceModifierDefense;
    const dice = rollDice(Math.max(0, dC)); let h = 0, f = 0; dice.forEach(s => { if (s==='grenade' || s===tar.typeId) h++; if (s==='flag') f++; });
    setCombatResult({ attackerId: aid, targetId: tid, dice, hits: h, flags: f });
    setGameState(prev => {
      const nU = { ...prev.units }; const nG = { ...prev.grid }; const nVP = { ...prev.victoryPoints }; let upT = { ...nU[tid] };
      for (let i=0; i<h; i++) { if (upT.resources > 0) upT.resources--; else upT.figures--; }
      if (upT.figures <= 0) { delete nU[tid]; nG[`${tH.q},${tH.r}`].unitId = undefined; nVP[att.ownerId]++; }
      else { nU[tid] = upT; if (f>0) setTimeout(() => setRetreatingUnitId({ unitId: tid, count: f }), 1000); }
      nU[aid] = { ...nU[aid], resources: nU[aid].resources-1, hasAttacked: true };
      return { ...prev, units: nU, grid: nG, victoryPoints: nVP, winner: nVP[att.ownerId] >= prev.scenario.victoryPointsToWin ? att.ownerId : undefined };
    });
  };
  const retreatUnit = (uid, tq, tr) => {
    if (!retreatingUnitId || retreatingUnitId.unitId !== uid) return;
    const fH = getUnitHex(uid); if (!fH) return; if (getDistance(fH, {q:tq, r:tr}) !== 1 || gameState.grid[`${tq},${tr}`]?.unitId) return;
    const unit = gameState.units[uid]; if (unit.ownerId === 'player1' ? tr <= fH.r : tr >= fH.r) return;
    setGameState(prev => { const nG = { ...prev.grid }; nG[`${fH.q},${fH.r}`].unitId = undefined; nG[`${tq},${tr}`].unitId = uid; return { ...prev, grid: nG }; });
    if (retreatingUnitId.count > 1) setRetreatingUnitId({ unitId: uid, count: retreatingUnitId.count-1 }); else setRetreatingUnitId(null);
  };
  return { gameState, combatResult, retreatingUnitId, setCombatResult, setRetreatingUnitId, distributeResource, startActionPhase, endTurn, assignResourceToUnit, moveUnit, attackUnit, retreatUnit };
}
