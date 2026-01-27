import { useState, useMemo, useEffect, useRef } from 'react';
import { getDistance, axialToOffset, getUnitSections, getNeighbors, getReachableHexes, getTargetableUnits, areOnSameRidge, checkLOS as calcLOS, getDiceCount } from '../logic/hexGrid';
import { rollDice } from '../logic/dice';
import { saveGameState, subscribeToGame } from '../logic/firebaseService';

export function useGameLogic(scenario, unitTypes, terrainTypes, overlayTypes, gameId?: string) {

  const [combatResult, setCombatResult] = useState(null);
  const [retreatingUnitId, setRetreatingUnitId] = useState(null);
  const [takeGroundOption, setTakeGroundOption] = useState(null);
  const initialGrid = useMemo(() => {
    if (!scenario) return {};
    const grid = {};
    for (let r = 0; r < scenario.boardHeight; r++) {
      const width = r % 2 === 0 ? scenario.boardWidth : scenario.boardWidth - 1;
      for (let col = 0; col < width; col++) {
        const q = col - Math.floor(r / 2);
        const key = `${q},${r}`;
        const initial = scenario.initialHexes.find(h => h.q === q && h.r === r);
        if (initial) {
          grid[key] = { ...initial };
        } else {
          grid[key] = { q, r, s: -q - r, terrainTypeId: 'grass' };
        }
      }
    }
    return grid;
  }, [scenario]);
  const initialUnits = useMemo(() => {
    if (!scenario) return {};
    const units = {};
    scenario.initialUnits.forEach(u => {
      units[u.id] = { ...u, movementUsed: 0, resourceOrigins: [] };
    });
    return units;
  }, [scenario]);
  const initialStats = useMemo(() => {
    if (!scenario) return {};
    const stats = {};
    scenario.initialUnits.forEach(u => {
      stats[u.id] = {
        unitId: u.id,
        unitTypeId: u.typeId,
        ownerId: u.ownerId,
        damageDealt: 0,
        damageTaken: 0,
        kills: 0,
        distanceTraveled: 0,
        attackers: []
      };
    });
    return stats;
  }, [scenario]);
  const [gameState, setGameState] = useState(() => ({
    scenario,
    currentTurn: 1,
    activePlayerId: scenario?.firstPlayerId || 'player1',
    phase: 'distribution-sections' as any,
    sectionResources: { player1: { left: 0, center: 0, right: 0 }, player2: { left: 0, center: 0, right: 0 } },
    centralWarehouse: { player1: scenario?.player1.income || 0, player2: scenario?.player2.income || 0 },
    units: initialUnits,
    grid: initialGrid,
    victoryPoints: { player1: [], player2: [] },
    unitStats: initialStats
  }));

  const isSyncingRef = useRef(false);

  // Sync FROM Firestore
  useEffect(() => {
    if (!gameId) return;
    const unsubscribe = subscribeToGame(gameId, (remoteState) => {
      isSyncingRef.current = true;
      setGameState(remoteState);
      setTimeout(() => { isSyncingRef.current = false; }, 100);
    });
    return () => unsubscribe();
  }, [gameId]);

  // Sync TO Firestore
  useEffect(() => {
    if (!gameId || isSyncingRef.current || !gameState.scenario) return;
    saveGameState(gameId, gameState);
  }, [gameState, gameId]);
  const getUnitHex = (uid) => Object.values(gameState.grid).find(h => h.unitId === uid) || null;
  const getTerrainAt = (q, r) => { const hex = gameState.grid[`${q},${r}`]; return terrainTypes.find(t => t.id === hex?.terrainTypeId) || terrainTypes[0]; };
  const getOverlayAt = (q, r) => { const hex = gameState.grid[`${q},${r}`]; return overlayTypes.find(o => o.id === hex?.overlayTypeId) || null; };
  const distributeResource = (pid, sec, amount: number | 'max' = 1) => {
    if (gameState.phase !== 'distribution-sections' || gameState.activePlayerId !== pid || gameState.centralWarehouse[pid] <= 0) return;
    setGameState(prev => {
      const actualAmount = amount === 'max' ? prev.centralWarehouse[pid] : Math.min(amount, prev.centralWarehouse[pid]);
      const newState = {
        ...prev,
        centralWarehouse: { ...prev.centralWarehouse, [pid]: prev.centralWarehouse[pid] - actualAmount },
        sectionResources: { ...prev.sectionResources, [pid]: { ...prev.sectionResources[pid], [sec]: prev.sectionResources[pid][sec] + actualAmount } }
      };
      return newState;
    });
  };
  const endTurn = () => {
    setGameState(prev => {
      const next = prev.activePlayerId === 'player1' ? 'player2' : 'player1';
      const newUnits = { ...prev.units };
      Object.keys(newUnits).forEach(id => {
        const u = newUnits[id];
        if (u.ownerId === next) {
          // Reset resources and flags for the player who is about to start their turn
          newUnits[id] = {
            ...u,
            resources: 0,
            resourceOrigins: [],
            hasMoved: false,
            hasAttacked: false,
            movementUsed: 0
          };
        } else {
          // Reset flags for the defending player who just finished their turn
          // Cap resources at 1 during opponent's turn
          newUnits[id] = {
            ...u,
            resources: Math.min(u.resources, 1),
            resourceOrigins: u.resourceOrigins ? u.resourceOrigins.slice(0, Math.min(u.resources, 1)) : [],
            hasMoved: false,
            hasAttacked: false,
            movementUsed: 0
          };
        }
      });

      const { nVP, newGrid: updatedGrid } = checkObjectives(prev.grid, newUnits, next, 'startOfTurn', prev.currentTurn, prev.victoryPoints);

      return {
        ...prev,
        activePlayerId: next,
        phase: 'distribution-sections',
        currentTurn: prev.activePlayerId === 'player2' ? prev.currentTurn + 1 : prev.currentTurn,
        centralWarehouse: { ...prev.centralWarehouse, [next]: prev.scenario[next].income },
        units: newUnits,
        grid: updatedGrid,
        victoryPoints: nVP,
        winner: (nVP.player1.length >= prev.scenario.victoryPointsToWin || !Object.values(newUnits).some(u => u.ownerId === 'player2')) ? 'player1' : ((nVP.player2.length >= prev.scenario.victoryPointsToWin || !Object.values(newUnits).some(u => u.ownerId === 'player1')) ? 'player2' : undefined)
      };
    });
  };
  const assignResourceToUnit = (uid, sectionId) => {
    setGameState(prev => {
      const unit = prev.units[uid];
      if (prev.phase !== 'distribution-units' || !unit || unit.ownerId !== prev.activePlayerId) return prev;

      const hex = Object.values(prev.grid).find(h => h.unitId === uid);
      if (!hex) return prev;

      const isAtMax = unit.resources >= 3;
      const clickedUnitBody = !sectionId;
      const sections = getUnitSections(hex.q, hex.r, prev.scenario);
      const isBoundaryUnit = sections.length > 1;

      // Determine section for potential addition
      let sec = sectionId;
      if (!sec && !isBoundaryUnit) {
        sec = sections[0];
      }

      const canAdd = sec && prev.sectionResources[prev.activePlayerId][sec] > 0 && unit.resources < 3;

      // Reset logic:
      // 1. Any click when at max resources resets everything.
      // 2. Clicking unit body of a boundary unit resets everything (as they must use arrows to add).
      // 3. Clicking unit body of a single-section unit resets everything IF it has resources but we can't add more (e.g. section empty).
      if (isAtMax || (clickedUnitBody && isBoundaryUnit && unit.resources > 0) || (clickedUnitBody && !isBoundaryUnit && unit.resources > 0 && !canAdd)) {
        const origins = unit.resourceOrigins || [];
        const newSecRes = { ...prev.sectionResources[prev.activePlayerId] };
        origins.forEach(o => {
          if (newSecRes[o] !== undefined) newSecRes[o]++;
        });
        return {
          ...prev,
          sectionResources: { ...prev.sectionResources, [prev.activePlayerId]: newSecRes },
          units: { ...prev.units, [uid]: { ...unit, resources: 0, resourceOrigins: [] } }
        };
      }

      // Add resource if possible
      if (canAdd) {
        const newSecRes = { ...prev.sectionResources[prev.activePlayerId], [sec]: prev.sectionResources[prev.activePlayerId][sec] - 1 };
        const newOrigins = [...(unit.resourceOrigins || []), sec];
        const newState = {
          ...prev,
          sectionResources: { ...prev.sectionResources, [prev.activePlayerId]: newSecRes },
          units: { ...prev.units, [uid]: { ...unit, resources: unit.resources + 1, resourceOrigins: newOrigins } }
        };

        // Auto-transition phase if all resources spent
        if (newSecRes.left === 0 && newSecRes.center === 0 && newSecRes.right === 0) {
          newState.phase = 'movement';
        }
        return newState;
      }

      return prev;
    });
  };
  const checkObjectives = (grid, units, playerId, timing, round, currentVP) => {
    const newGrid = { ...grid };
    const nVP = { player1: [...currentVP.player1], player2: [...currentVP.player2] };

    Object.keys(newGrid).forEach(key => {
      const hex = newGrid[key];
      if (!hex.objective) return;

      const occupyingUnitId = hex.unitId;
      const occupyingUnit = occupyingUnitId ? units[occupyingUnitId] : null;
      const obj = { ...hex.objective };
      const isValidForPlayer = (pid) => !obj.validFor || obj.validFor === 'both' || obj.validFor === pid;

      if (timing === 'immediate' || timing === 'startOfTurn') {
        if (occupyingUnit && occupyingUnit.ownerId === playerId && obj.timing === timing) {
          if (obj.controllingPlayerId !== playerId) {
            // Player captured objective
            if (obj.controllingPlayerId) {
              // Other player lost it
              const other = obj.controllingPlayerId;
              nVP[other] = nVP[other].filter(vp => vp.objectiveHexKey !== key);
            }
            obj.controllingPlayerId = playerId;
            // New controller gains points
            if (isValidForPlayer(playerId)) {
              for (let i = 0; i < obj.points; i++) {
                nVP[playerId].push({
                  id: `obj-${key}-${i}-${round}`,
                  type: 'objective',
                  round: round,
                  objectiveName: obj.name || 'Cíl',
                  objectiveHexKey: key
                });
              }
            }
            newGrid[key] = { ...hex, objective: obj };
          }
        }
      }

      // Handle Temporary Objectives loss when leaving
      if (obj.type === 'temporary' && obj.controllingPlayerId && (!occupyingUnit || occupyingUnit.ownerId !== obj.controllingPlayerId)) {
        const prevController = obj.controllingPlayerId;
        nVP[prevController] = nVP[prevController].filter(vp => vp.objectiveHexKey !== key);
        obj.controllingPlayerId = undefined;
        newGrid[key] = { ...hex, objective: obj };
      }
    });

    return { nVP, newGrid };
  };

  const moveUnit = (uid, tq, tr) => {
    const unit = gameState.units[uid]; if (gameState.phase !== 'movement' || !unit || unit.ownerId !== gameState.activePlayerId) return;
    if (!unit.hasMoved && unit.resources <= 0) return;
    const fHex = getUnitHex(uid); if (!fHex) return; const dist = getDistance(fHex, { q: tq, r: tr }); const utype = unitTypes.find(ut => ut.id === unit.typeId);
    if (!utype || (unit.movementUsed + dist) > utype.movement || gameState.grid[`${tq},${tr}`]?.unitId) return;
    setGameState(prev => {
      const nGrid = { ...prev.grid };
      const fromHex = nGrid[`${fHex.q},${fHex.r}`];
      const targetHex = nGrid[`${tq},${tr}`];

      // Sandbags destroyed when leaving
      if (fromHex.overlayTypeId === 'sandbags') {
        fromHex.overlayTypeId = undefined;
      }

      fromHex.unitId = undefined;
      targetHex.unitId = uid;

      const totalDist = unit.movementUsed + dist;
      const newResources = unit.hasMoved ? unit.resources : unit.resources - 1;
      const targetTerrain = terrainTypes.find(t => t.id === targetHex?.terrainTypeId);
      const targetOverlayId = targetHex?.overlayTypeId;

      let isStopTerrain = targetTerrain?.movementRestriction === 'stop' || targetOverlayId === 'wire';
      let allowAttackAfterStop = false;

      if (targetOverlayId === 'wire') {
        allowAttackAfterStop = true; // All units can attack from wire (with penalty)
        if (utype.category === 'tank') {
          targetHex.overlayTypeId = undefined;
        }
      }

      const finalMovementUsed = isStopTerrain ? utype.movement : totalDist;
      const hasAttacked = (isStopTerrain && !allowAttackAfterStop) || (totalDist > utype.canShootAfterMovingMax ? true : unit.hasAttacked);

      const newStats = { ...prev.unitStats };
      newStats[uid] = { ...newStats[uid], distanceTraveled: newStats[uid].distanceTraveled + dist };

      const { nVP, newGrid: updatedGrid } = checkObjectives(nGrid, prev.units, prev.activePlayerId, 'immediate', prev.currentTurn, prev.victoryPoints);

      return {
        ...prev,
        grid: updatedGrid,
        units: { ...prev.units, [uid]: { ...unit, resources: newResources, hasMoved: true, movementUsed: finalMovementUsed, hasAttacked } },
        victoryPoints: nVP,
        unitStats: newStats,
        winner: (nVP.player1.length >= prev.scenario.victoryPointsToWin || !Object.values(prev.units).some(u => u.ownerId === 'player2')) ? 'player1' : ((nVP.player2.length >= prev.scenario.victoryPointsToWin || !Object.values(prev.units).some(u => u.ownerId === 'player1')) ? 'player2' : undefined)
      };
    });
  };
  const attackUnit = (aid, tid) => {
    const att = gameState.units[aid];
    const tar = gameState.units[tid];
    if (gameState.phase !== 'attack' || !att || !tar || att.ownerId !== gameState.activePlayerId || att.resources <= 0 || att.hasAttacked) return;

    const utype = unitTypes.find(u => u.id === att.typeId);
    if (!utype) return;

    // Artillery cannot shoot if it moved
    if (utype.category === 'artillery' && (att.movementUsed > 0 || att.hasMoved)) return;

    const fH = getUnitHex(aid);
    const tH = getUnitHex(tid);
    if (!fH || !tH) return;
    const targetable = getTargetableUnits(fH.q, fH.r, utype, gameState, terrainTypes, overlayTypes);
    if (!targetable.includes(tid)) return;
    const dist = getDistance(fH, tH);
    const attTerrain = getTerrainAt(fH.q, fH.r);
    const attOverlay = getOverlayAt(fH.q, fH.r);
    const tarTerrain = getTerrainAt(tH.q, tH.r);
    const tarOverlay = getOverlayAt(tH.q, tH.r);

    const isArtillery = att.typeId === 'artillery';
    const dC = getDiceCount(att, tar, fH, tH, gameState.grid, terrainTypes, overlayTypes, utype);

    let ignoreFlags = 0;
    if (!isArtillery) {
      ignoreFlags = Math.max(tarTerrain.ignoreFlags ?? 0, tarOverlay?.ignoreFlags ?? 0);
    }

    const dice = rollDice(dC);
    let h = 0, f = 0;
    const targetUnitType = unitTypes.find(ut => ut.id === tar.typeId);
    dice.forEach(s => {
      if (s === 'grenade' || s === targetUnitType?.category) h++;
      if (s === 'flag') f++;
    });

    const finalFlags = Math.max(0, f - ignoreFlags);
    setCombatResult({ attackerId: aid, targetId: tid, dice, hits: h, flags: f });
    setGameState(prev => {
      let nU = { ...prev.units };
      let nG = { ...prev.grid };
      let nVP = { player1: [...prev.victoryPoints.player1], player2: [...prev.victoryPoints.player2] };
      let nStats = { ...prev.unitStats };

      let upT = { ...nU[tid] };
      let targetStats = { ...nStats[tid] };
      let attackerStats = { ...nStats[aid] };

      attackerStats.damageDealt += h;
      targetStats.damageTaken += h;
      if (!targetStats.attackers.includes(att.typeId)) {
        targetStats.attackers.push(att.typeId);
      }

      for (let i = 0; i < h; i++) { if (upT.resources > 0) upT.resources--; else upT.figures--; }

      let isEliminated = false;
      if (upT.figures <= 0) {
        attackerStats.kills += 1;
        targetStats.destroyedInRound = prev.currentTurn;

        delete nU[tid];
        nG[`${tH.q},${tH.r}`].unitId = undefined;
        if (nG[`${tH.q},${tH.r}`].overlayTypeId === 'sandbags') {
          nG[`${tH.q},${tH.r}`].overlayTypeId = undefined;
        }

        nVP[att.ownerId].push({
          id: `kill-${tid}-${prev.currentTurn}`,
          type: 'unit',
          round: prev.currentTurn,
          unitStats: targetStats
        });

        isEliminated = true;
      } else {
        nU[tid] = upT;
      }

      nStats[aid] = attackerStats;
      nStats[tid] = targetStats;

      nU[aid] = { ...nU[aid], resources: nU[aid].resources - 1, hasAttacked: true };

      if (isEliminated) {
        const { nVP: updatedVP, newGrid: updatedGrid } = checkObjectives(nG, nU, prev.activePlayerId, 'immediate', prev.currentTurn, { player1: nVP.player1, player2: nVP.player2 });
        nG = updatedGrid;
        nVP = updatedVP;

        if (dist === 1 && utype.category !== 'artillery') {
          setTimeout(() => setTakeGroundOption({ unitId: aid, hex: { q: tH.q, r: tH.r } }), 1000);
        }
      } else if (finalFlags > 0) {
        setTimeout(() => setRetreatingUnitId({ unitId: tid, count: finalFlags, attackerId: aid, targetHex: { q: tH.q, r: tH.r } }), 1000);
      }

      return { ...prev, units: nU, grid: nG, victoryPoints: nVP, unitStats: nStats, winner: (nVP.player1.length >= prev.scenario.victoryPointsToWin || !Object.values(nU).some(u => u.ownerId === 'player2')) ? 'player1' : ((nVP.player2.length >= prev.scenario.victoryPointsToWin || !Object.values(nU).some(u => u.ownerId === 'player1')) ? 'player2' : undefined) };
    });
  };
  const retreatUnit = (uid, tq, tr) => {
    if (!retreatingUnitId || retreatingUnitId.unitId !== uid) return;
    const unit = gameState.units[uid];
    const fH = getUnitHex(uid);
    if (!fH) return;

    // Manual retreat to same hex = cannot retreat
    if (fH.q === tq && fH.r === tr) {
      setGameState(prev => {
        const nU = { ...prev.units };
        const nVP = { player1: [...prev.victoryPoints.player1], player2: [...prev.victoryPoints.player2] };
        const nStats = { ...prev.unitStats };
        let u = { ...nU[uid] };
        let uStats = { ...nStats[uid] };

        uStats.damageTaken += 1;
        if (u.resources > 0) u.resources--; else u.figures--;
        let nG = { ...prev.grid };
        if (u.figures <= 0) {
          uStats.destroyedInRound = prev.currentTurn;
          delete nU[uid];
          nG[`${fH.q},${fH.r}`].unitId = undefined;
          if (nG[`${fH.q},${fH.r}`].overlayTypeId === 'sandbags') {
            nG[`${fH.q},${fH.r}`].overlayTypeId = undefined;
          }
          const attacker = prev.units[retreatingUnitId.attackerId];
          if (attacker) {
            const winnerOfPoint = attacker.ownerId;
            nVP[winnerOfPoint].push({
              id: `kill-${uid}-${prev.currentTurn}`,
              type: 'unit',
              round: prev.currentTurn,
              unitStats: uStats
            });
            if (nStats[retreatingUnitId.attackerId]) {
              nStats[retreatingUnitId.attackerId] = { ...nStats[retreatingUnitId.attackerId], kills: nStats[retreatingUnitId.attackerId].kills + 1 };
            }
          }
        } else {
          nU[uid] = u;
        }
        nStats[uid] = uStats;

        const { nVP: finalVP, newGrid: updatedGrid } = checkObjectives(nG, nU, prev.activePlayerId, 'immediate', prev.currentTurn, nVP);

        if (u.figures <= 0) setRetreatingUnitId(null);

        return {
          ...prev,
          units: nU,
          grid: updatedGrid,
          victoryPoints: finalVP,
          unitStats: nStats,
          winner: (finalVP.player1.length >= prev.scenario.victoryPointsToWin || !Object.values(nU).some(u => u.ownerId === 'player2')) ? 'player1' : ((finalVP.player2.length >= prev.scenario.victoryPointsToWin || !Object.values(nU).some(u => u.ownerId === 'player1')) ? 'player2' : undefined)
        };
      });
       if (retreatingUnitId.count > 1 && (gameState.units[uid]?.figures > 0 || gameState.units[uid]?.resources > 0)) {
         setRetreatingUnitId(prev => ({ ...prev, count: prev.count - 1 }));
       } else {
         if (retreatingUnitId.attackerId && retreatingUnitId.targetHex) {
           const att = gameState.units[retreatingUnitId.attackerId];
           const attType = unitTypes.find(ut => ut.id === att?.typeId);
           if (att && getDistance(getUnitHex(retreatingUnitId.attackerId), retreatingUnitId.targetHex) === 1 && attType?.category !== 'artillery') {
             setTakeGroundOption({ unitId: retreatingUnitId.attackerId, hex: retreatingUnitId.targetHex });
           }
         }
         setRetreatingUnitId(null);
       }
       return;
    }

    if (getDistance(fH, {q:tq, r:tr}) !== 1 || gameState.grid[`${tq},${tr}`]?.unitId) return;
    if (unit.ownerId === 'player1' ? tr <= fH.r : tr >= fH.r) return;

    setGameState(prev => {
      const nG = { ...prev.grid };
      const fromHex = nG[`${fH.q},${fH.r}`];

      // Sandbags destroyed when leaving
      if (fromHex.overlayTypeId === 'sandbags') {
        fromHex.overlayTypeId = undefined;
      }

      fromHex.unitId = undefined;
      nG[`${tq},${tr}`].unitId = uid;

      const nStats = { ...prev.unitStats };
      if (nStats[uid]) {
        nStats[uid] = { ...nStats[uid], distanceTraveled: nStats[uid].distanceTraveled + 1 };
      }

      const { nVP, newGrid: updatedGrid } = checkObjectives(nG, prev.units, prev.activePlayerId, 'immediate', prev.currentTurn, prev.victoryPoints);
      return {
        ...prev,
        grid: updatedGrid,
        victoryPoints: nVP,
        unitStats: nStats,
        winner: (nVP.player1.length >= prev.scenario.victoryPointsToWin || !Object.values(prev.units).some(u => u.ownerId === 'player2')) ? 'player1' : ((nVP.player2.length >= prev.scenario.victoryPointsToWin || !Object.values(prev.units).some(u => u.ownerId === 'player1')) ? 'player2' : undefined)
      };
    });

    if (retreatingUnitId.count > 1) {
      setRetreatingUnitId(prev => ({ ...prev, count: prev.count - 1 }));
    } else {
      if (retreatingUnitId.attackerId && retreatingUnitId.targetHex) {
        const att = gameState.units[retreatingUnitId.attackerId];
        const attType = unitTypes.find(ut => ut.id === att?.typeId);
        if (att && getDistance(getUnitHex(retreatingUnitId.attackerId), retreatingUnitId.targetHex) === 1 && attType?.category !== 'artillery') {
          setTakeGroundOption({ unitId: retreatingUnitId.attackerId, hex: retreatingUnitId.targetHex });
        }
      }
      setRetreatingUnitId(null);
    }
  };
  const destroyOverlay = (uid) => {
    const unit = gameState.units[uid];
    if (gameState.phase !== 'attack' || !unit || unit.ownerId !== gameState.activePlayerId || unit.resources <= 0 || unit.hasAttacked) return;
    const hex = getUnitHex(uid);
    if (!hex || hex.overlayTypeId !== 'wire') return;

    setGameState(prev => {
      const nG = { ...prev.grid };
      nG[`${hex.q},${hex.r}`].overlayTypeId = undefined;
      return {
        ...prev,
        grid: nG,
        units: { ...prev.units, [uid]: { ...unit, resources: unit.resources - 1, hasAttacked: true } }
      };
    });
  };
  const takeGround = (uid, q, r) => {
    if (!takeGroundOption || takeGroundOption.unitId !== uid) return;
    if (takeGroundOption.hex.q !== q || takeGroundOption.hex.r !== r) {
      setTakeGroundOption(null);
      return;
    }
    const fH = getUnitHex(uid);
    if (!fH || gameState.grid[`${q},${r}`]?.unitId) {
      setTakeGroundOption(null);
      return;
    }
    setGameState(prev => {
      const nG = { ...prev.grid };
      const fromHex = nG[`${fH.q},${fH.r}`];

      // Sandbags destroyed when leaving
      if (fromHex.overlayTypeId === 'sandbags') {
        fromHex.overlayTypeId = undefined;
      }

      fromHex.unitId = undefined;
      nG[`${q},${r}`].unitId = uid;

      const nStats = { ...prev.unitStats };
      if (nStats[uid]) {
        nStats[uid] = { ...nStats[uid], distanceTraveled: nStats[uid].distanceTraveled + 1 };
      }

      const { nVP, newGrid: updatedGrid } = checkObjectives(nG, prev.units, prev.activePlayerId, 'immediate', prev.currentTurn, prev.victoryPoints);
      return {
        ...prev,
        grid: updatedGrid,
        victoryPoints: nVP,
        unitStats: nStats,
        winner: (nVP.player1.length >= prev.scenario.victoryPointsToWin || !Object.values(prev.units).some(u => u.ownerId === 'player2')) ? 'player1' : ((nVP.player2.length >= prev.scenario.victoryPointsToWin || !Object.values(prev.units).some(u => u.ownerId === 'player1')) ? 'player2' : undefined)
      };
    });
    setTakeGroundOption(null);
  };
  const nextPhase = () => {
    setGameState(prev => {
      if (prev.phase === 'distribution-sections') {
        return {
          ...prev,
          phase: 'distribution-units',
          centralWarehouse: { ...prev.centralWarehouse, [prev.activePlayerId]: 0 }
        };
      }
      if (prev.phase === 'distribution-units') {
        return {
          ...prev,
          phase: 'movement',
          sectionResources: {
            ...prev.sectionResources,
            [prev.activePlayerId]: { left: 0, center: 0, right: 0 }
          }
        };
      }
      if (prev.phase === 'movement') return { ...prev, phase: 'attack' };
      return prev;
    });
  };

  const getSelectedReachable = (uid) => {
    const unit = gameState.units[uid]; if (!unit) return [];
    const hex = getUnitHex(uid); if (!hex) return [];
    const utype = unitTypes.find(u => u.id === unit.typeId);
    const limit = utype.movement - unit.movementUsed;
    if (limit <= 0 || (!unit.hasMoved && unit.resources <= 0)) return [];
    return getReachableHexes(hex.q, hex.r, limit, gameState.grid, terrainTypes, overlayTypes);
  };

  const getSelectedTargetable = (uid) => {
    const unit = gameState.units[uid]; if (!unit) return [];
    const hex = getUnitHex(uid); if (!hex) return [];
    const utype = unitTypes.find(u => u.id === unit.typeId);
    if (unit.resources <= 0 || unit.hasAttacked) return [];
    // Artillery cannot shoot if it moved
    if (utype?.category === 'artillery' && (unit.movementUsed > 0 || unit.hasMoved)) return [];
    return getTargetableUnits(hex.q, hex.r, utype, gameState, terrainTypes, overlayTypes);
  };

  const getRetreatHexes = (uid) => {
    const unit = gameState.units[uid];
    const fH = getUnitHex(uid);
    if (!unit || !fH) return [];
    const neighbors = getNeighbors(fH.q, fH.r);
    const valid = neighbors.filter(n => {
      const hex = gameState.grid[`${n.q},${n.r}`];
      if (!hex || hex.unitId) return false;
      if (unit.ownerId === 'player1') return n.r > fH.r;
      if (unit.ownerId === 'player2') return n.r < fH.r;
      return false;
    }).map(n => `${n.q},${n.r}`);
    valid.push(`${fH.q},${fH.r}`); // Option to stay and lose life
    return valid;
  };

  const getUnusedActions = () => {
    const activeP = gameState.activePlayerId;
    const reasons = [];
    if (gameState.phase === 'distribution-sections') {
      if (gameState.centralWarehouse[activeP] > 0) reasons.push(`Sklad: ${gameState.centralWarehouse[activeP]}`);
    } else if (gameState.phase === 'distribution-units') {
      const res = gameState.sectionResources[activeP];
      const parts = [];
      if (res.left > 0) parts.push(`L: ${res.left}`);
      if (res.center > 0) parts.push(`C: ${res.center}`);
      if (res.right > 0) parts.push(`R: ${res.right}`);
      if (parts.length > 0) reasons.push(`Sekce: ${parts.join(', ')}`);
    } else if (gameState.phase === 'movement') {
      const movable = Object.values(gameState.units).filter(u => {
        if (u.ownerId !== activeP) return false;
        const utype = unitTypes.find(ut => ut.id === u.typeId);
        const canStart = !u.hasMoved && u.resources > 0;
        const canContinue = u.hasMoved && u.movementUsed < (utype?.movement || 0);
        return canStart || canContinue;
      });
      if (movable.length > 0) reasons.push(`Jednotky k pohybu: ${movable.length}`);
    } else if (gameState.phase === 'attack') {
      const attackable = Object.values(gameState.units).filter(u => {
        const utype = unitTypes.find(ut => ut.id === u.typeId);
        if (u.ownerId !== activeP || u.resources <= 0 || u.hasAttacked) return false;
        if (utype?.category === 'artillery' && (u.movementUsed > 0 || u.hasMoved)) return false;
        const hex = getUnitHex(u.id);
        if (!hex) return false;

        // Can attack or destroy wire
        if (hex.overlayTypeId === 'wire' && utype?.category === 'infantry') return true;

        return getTargetableUnits(hex.q, hex.r, utype, gameState, terrainTypes, overlayTypes).length > 0;
      });
      if (attackable.length > 0) reasons.push(`Jednotky k útoku: ${attackable.length}`);
    }
    return reasons;
  };

  const hasAvailableActions = () => getUnusedActions().length > 0;

  return {
    gameState, combatResult, retreatingUnitId, setCombatResult, setRetreatingUnitId,
    takeGroundOption, setTakeGroundOption, takeGround, destroyOverlay,
    distributeResource, nextPhase, endTurn, assignResourceToUnit, moveUnit, attackUnit, retreatUnit,
    getSelectedReachable, getSelectedTargetable, getRetreatHexes, getUnitHex, hasAvailableActions, getUnusedActions
  };
}
