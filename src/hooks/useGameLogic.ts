import { useState, useMemo } from 'react';
import { getDistance, axialToOffset, getUnitSections, getNeighbors, getReachableHexes, getTargetableUnits, areOnSameRidge, checkLOS as calcLOS } from '../logic/hexGrid';
import { getAllTerrainTypes, getAllUnitTypes, getAllOverlayTypes } from '../data/typeUtils';
import { rollDice } from '../logic/dice';
export function useGameLogic(scenario) {
  const terrainTypes = getAllTerrainTypes();
  const unitTypes = getAllUnitTypes();
  const overlayTypes = getAllOverlayTypes();

  const [combatResult, setCombatResult] = useState(null);
  const [retreatingUnitId, setRetreatingUnitId] = useState(null);
  const [takeGroundOption, setTakeGroundOption] = useState(null);
  const initialGrid = useMemo(() => {
    const grid = {}; scenario.initialHexes.forEach(h => { grid[`${h.q},${h.r}`] = { ...h }; });
    for (let r = 0; r < scenario.boardHeight; r++) { for (let col = 0; col < scenario.boardWidth; col++) { const q = col - Math.floor(r / 2); const key = `${q},${r}`; if (!grid[key]) grid[key] = { q, r, s: -q - r, terrainTypeId: 'grass' }; } }
    return grid;
  }, [scenario]);
  const initialUnits = useMemo(() => {
    const units = {};
    scenario.initialUnits.forEach(u => {
      units[u.id] = { ...u, movementUsed: 0, resourceOrigins: [] };
    });
    return units;
  }, [scenario]);
  const [gameState, setGameState] = useState({ scenario, currentTurn: 1, activePlayerId: scenario.firstPlayerId, phase: 'distribution-sections', sectionResources: { player1: { left: 0, center: 0, right: 0 }, player2: { left: 0, center: 0, right: 0 } }, centralWarehouse: { player1: scenario.player1.income, player2: scenario.player2.income }, units: initialUnits, grid: initialGrid, victoryPoints: { player1: 0, player2: 0 } });
  const getUnitHex = (uid) => Object.values(gameState.grid).find(h => h.unitId === uid) || null;
  const getTerrainAt = (q, r) => { const hex = gameState.grid[`${q},${r}`]; return terrainTypes.find(t => t.id === hex?.terrainTypeId) || terrainTypes[0]; };
  const getOverlayAt = (q, r) => { const hex = gameState.grid[`${q},${r}`]; return overlayTypes.find(o => o.id === hex?.overlayTypeId) || null; };
  const distributeResource = (pid, sec) => {
    if (gameState.phase !== 'distribution-sections' || gameState.activePlayerId !== pid || gameState.centralWarehouse[pid] <= 0) return;
    setGameState(prev => {
      const newState = { ...prev, centralWarehouse: { ...prev.centralWarehouse, [pid]: prev.centralWarehouse[pid] - 1 }, sectionResources: { ...prev.sectionResources, [pid]: { ...prev.sectionResources[pid], [sec]: prev.sectionResources[pid][sec] + 1 } } };
      if (newState.centralWarehouse[pid] === 0) newState.phase = 'distribution-units';
      return newState;
    });
  };
  const endTurn = () => {
    setGameState(prev => {
      const next = prev.activePlayerId === 'player1' ? 'player2' : 'player1'; const newUnits = { ...prev.units };
      Object.keys(newUnits).forEach(id => {
        if (newUnits[id].ownerId === prev.activePlayerId) {
          newUnits[id] = { ...newUnits[id], resources: Math.min(newUnits[id].resources, 1), hasMoved: false, hasAttacked: false, movementUsed: 0 };
        } else {
          newUnits[id] = { ...newUnits[id], movementUsed: 0, hasMoved: false, hasAttacked: false };
        }
      });

      const { vpChange1, vpChange2, newGrid: updatedGrid } = checkObjectives(prev.grid, newUnits, next, 'startOfTurn');
      const nVP = { player1: prev.victoryPoints.player1 + vpChange1, player2: prev.victoryPoints.player2 + vpChange2 };

      return {
        ...prev,
        activePlayerId: next,
        phase: 'distribution-sections',
        currentTurn: prev.activePlayerId === 'player2' ? prev.currentTurn + 1 : prev.currentTurn,
        centralWarehouse: { ...prev.centralWarehouse, [next]: prev.scenario[next].income },
        units: newUnits,
        grid: updatedGrid,
        victoryPoints: nVP,
        winner: nVP.player1 >= prev.scenario.victoryPointsToWin ? 'player1' : (nVP.player2 >= prev.scenario.victoryPointsToWin ? 'player2' : undefined)
      };
    });
  };
  const assignResourceToUnit = (uid, sectionId) => {
    const unit = gameState.units[uid];
    if (gameState.phase !== 'distribution-units' || !unit || unit.ownerId !== gameState.activePlayerId) return;
    const hex = getUnitHex(uid);
    if (!hex) return;

    let sec = sectionId;
    if (!sec) {
      const sections = getUnitSections(hex.q, hex.r, gameState.scenario);
      if (sections.length === 1) sec = sections[0];
    }

    // Toggle logic: If unit has 3 resources OR (section is empty/not specified and unit has resources assigned this turn), return one.
    const canAdd = sec && gameState.sectionResources[gameState.activePlayerId][sec] > 0 && unit.resources < 3;
    const hasAssignedThisTurn = unit.resourceOrigins && unit.resourceOrigins.length > 0;

    if (!canAdd && hasAssignedThisTurn) {
      setGameState(prev => {
        const origins = [...(prev.units[uid].resourceOrigins || [])];
        const lastOrigin = origins.pop();
        const newSectionResources = {
          ...prev.sectionResources[prev.activePlayerId],
          [lastOrigin]: prev.sectionResources[prev.activePlayerId][lastOrigin] + 1
        };
        return {
          ...prev,
          sectionResources: { ...prev.sectionResources, [prev.activePlayerId]: newSectionResources },
          units: { ...prev.units, [uid]: { ...prev.units[uid], resources: prev.units[uid].resources - 1, resourceOrigins: origins } }
        };
      });
      return;
    }

    if (!canAdd) return;

    setGameState(prev => {
      const newSectionResources = { ...prev.sectionResources[prev.activePlayerId], [sec]: prev.sectionResources[prev.activePlayerId][sec] - 1 };
      const newOrigins = [...(unit.resourceOrigins || []), sec];
      const newState = {
        ...prev,
        sectionResources: { ...prev.sectionResources, [prev.activePlayerId]: newSectionResources },
        units: { ...prev.units, [uid]: { ...unit, resources: unit.resources + 1, resourceOrigins: newOrigins } }
      };
      if (newSectionResources.left === 0 && newSectionResources.center === 0 && newSectionResources.right === 0) newState.phase = 'movement';
      return newState;
    });
  };
  const checkObjectives = (grid, units, playerId, timing) => {
    let vpChange1 = 0;
    let vpChange2 = 0;
    const newGrid = { ...grid };

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
              // Other player lost it IF it was valid for them
              if (isValidForPlayer(obj.controllingPlayerId)) {
                if (obj.controllingPlayerId === 'player1') vpChange1 -= obj.points; else vpChange2 -= obj.points;
              }
            }
            obj.controllingPlayerId = playerId;
            // New controller gains points IF it is valid for them
            if (isValidForPlayer(playerId)) {
              if (playerId === 'player1') vpChange1 += obj.points; else vpChange2 += obj.points;
            }
            newGrid[key] = { ...hex, objective: obj };
          }
        }
      }

      // Handle Temporary Objectives loss when leaving
      if (obj.type === 'temporary' && obj.controllingPlayerId && (!occupyingUnit || occupyingUnit.ownerId !== obj.controllingPlayerId)) {
        if (isValidForPlayer(obj.controllingPlayerId)) {
          if (obj.controllingPlayerId === 'player1') vpChange1 -= obj.points; else vpChange2 -= obj.points;
        }
        obj.controllingPlayerId = undefined;
        newGrid[key] = { ...hex, objective: obj };
      }
    });

    return { vpChange1, vpChange2, newGrid };
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

      // Special rule: Tank and wire
      if (unit.typeId === 'tank' && targetOverlayId === 'wire') {
        targetHex.overlayTypeId = undefined;
        allowAttackAfterStop = true;
      }

      const finalMovementUsed = isStopTerrain ? utype.movement : totalDist;
      const hasAttacked = (isStopTerrain && !allowAttackAfterStop) || (totalDist > utype.canShootAfterMovingMax ? true : unit.hasAttacked);

      const { vpChange1, vpChange2, newGrid: updatedGrid } = checkObjectives(nGrid, prev.units, prev.activePlayerId, 'immediate');
      const nVP = { player1: prev.victoryPoints.player1 + vpChange1, player2: prev.victoryPoints.player2 + vpChange2 };

      return {
        ...prev,
        grid: updatedGrid,
        units: { ...prev.units, [uid]: { ...unit, resources: newResources, hasMoved: true, movementUsed: finalMovementUsed, hasAttacked } },
        victoryPoints: nVP,
        winner: nVP.player1 >= prev.scenario.victoryPointsToWin ? 'player1' : (nVP.player2 >= prev.scenario.victoryPointsToWin ? 'player2' : undefined)
      };
    });
  };
  const attackUnit = (aid, tid) => {
    const att = gameState.units[aid];
    const tar = gameState.units[tid];
    if (gameState.phase !== 'attack' || !att || !tar || att.ownerId !== gameState.activePlayerId || att.resources <= 0 || att.hasAttacked) return;

    // Artillery cannot shoot if it moved
    if (att.typeId === 'artillery' && (att.movementUsed > 0 || att.hasMoved)) return;

    const fH = getUnitHex(aid);
    const tH = getUnitHex(tid);
    if (!fH || !tH) return;
    const utype = unitTypes.find(u => u.id === att.typeId);
    if (!utype) return;
    const targetable = getTargetableUnits(fH.q, fH.r, utype, gameState, terrainTypes, overlayTypes);
    if (!targetable.includes(tid)) return;
    const dist = getDistance(fH, tH);
    const attTerrain = getTerrainAt(fH.q, fH.r);
    const attOverlay = getOverlayAt(fH.q, fH.r);
    const tarTerrain = getTerrainAt(tH.q, tH.r);
    const tarOverlay = getOverlayAt(tH.q, tH.r);

    const isArtillery = att.typeId === 'artillery';
    const isTank = att.typeId === 'tank';
    const isInfantry = att.typeId === 'infantry';

    let diceModifierDefense = 0;
    let ignoreFlags = 0;
    if (!isArtillery) {
      const onSameRidge = areOnSameRidge(fH, tH, gameState.grid);
      let terrainDef = 0;
      if (!(tarTerrain.id === 'hill' && onSameRidge)) {
        terrainDef = isTank ? (tarTerrain.diceModifierDefenseTank ?? 0) : (tarTerrain.diceModifierDefenseInfantry ?? 0);
      }
      const overlayDef = tarOverlay?.diceModifierDefense ?? 0;
      diceModifierDefense = Math.max(terrainDef, overlayDef);
      ignoreFlags = Math.max(tarTerrain.ignoreFlags ?? 0, tarOverlay?.ignoreFlags ?? 0);
    }

    let terrainAtt = 0;
    if (isTank) terrainAtt = attTerrain.diceModifierAttackTank ?? 0;
    else if (isInfantry) terrainAtt = attTerrain.diceModifierAttackInfantry ?? 0;

    let overlayAtt = 0;
    if (isTank) overlayAtt = attOverlay?.diceModifierAttackTank ?? 0;
    else if (isInfantry) overlayAtt = attOverlay?.diceModifierAttackInfantry ?? 0;
    else if (isArtillery) overlayAtt = attOverlay?.diceModifierAttackArtillery ?? 0;

    const diceModifierAttack = Math.min(terrainAtt, overlayAtt);

    let dC = utype.shootingRange[dist-1] - diceModifierDefense + diceModifierAttack;
    const dice = rollDice(Math.max(0, dC));
    let h = 0, f = 0;
    dice.forEach(s => {
      if (s==='grenade' || s===tar.typeId) h++;
      if (s==='flag') f++;
    });

    const finalFlags = Math.max(0, f - ignoreFlags);
    setCombatResult({ attackerId: aid, targetId: tid, dice, hits: h, flags: f });
    setGameState(prev => {
      let nU = { ...prev.units };
      let nG = { ...prev.grid };
      let nVP = { ...prev.victoryPoints };
      let upT = { ...nU[tid] };
      for (let i=0; i<h; i++) { if (upT.resources > 0) upT.resources--; else upT.figures--; }

      let isEliminated = false;
      if (upT.figures <= 0) {
        delete nU[tid];
        nG[`${tH.q},${tH.r}`].unitId = undefined;
        nVP[att.ownerId]++;
        isEliminated = true;
      } else {
        nU[tid] = upT;
      }

      nU[aid] = { ...nU[aid], resources: nU[aid].resources-1, hasAttacked: true };

      if (isEliminated) {
        // Recalculate objectives (e.g. if defender was holding a temporary objective)
        const { vpChange1, vpChange2, newGrid: updatedGrid } = checkObjectives(nG, nU, prev.activePlayerId, 'immediate');
        nG = updatedGrid;
        nVP.player1 += vpChange1;
        nVP.player2 += vpChange2;

        if (dist === 1 && att.typeId !== 'artillery') {
          setTimeout(() => setTakeGroundOption({ unitId: aid, hex: { q: tH.q, r: tH.r } }), 1000);
        }
      } else if (finalFlags > 0) {
        setTimeout(() => setRetreatingUnitId({ unitId: tid, count: finalFlags, attackerId: aid, targetHex: { q: tH.q, r: tH.r } }), 1000);
      }

      return { ...prev, units: nU, grid: nG, victoryPoints: nVP, winner: nVP.player1 >= prev.scenario.victoryPointsToWin ? 'player1' : (nVP.player2 >= prev.scenario.victoryPointsToWin ? 'player2' : undefined) };
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
         const nVP = { ...prev.victoryPoints };
         let u = { ...nU[uid] };
         if (u.resources > 0) u.resources--; else u.figures--;
         let nG = { ...prev.grid };
         if (u.figures <= 0) {
           delete nU[uid];
           nG[`${fH.q},${fH.r}`].unitId = undefined;
           nVP[retreatingUnitId.attackerId === 'player1' ? 'player1' : 'player2']++;
         } else {
           nU[uid] = u;
         }

         const { vpChange1, vpChange2, newGrid: updatedGrid } = checkObjectives(nG, nU, prev.activePlayerId, 'immediate');
         const finalVP = { player1: nVP.player1 + vpChange1, player2: nVP.player2 + vpChange2 };

         if (u.figures <= 0) setRetreatingUnitId(null);

         return {
           ...prev,
           units: nU,
           grid: updatedGrid,
           victoryPoints: finalVP,
           winner: finalVP.player1 >= prev.scenario.victoryPointsToWin ? 'player1' : (finalVP.player2 >= prev.scenario.victoryPointsToWin ? 'player2' : undefined)
         };
       });
       if (retreatingUnitId.count > 1 && (gameState.units[uid]?.figures > 0 || gameState.units[uid]?.resources > 0)) {
         setRetreatingUnitId(prev => ({ ...prev, count: prev.count - 1 }));
       } else {
         if (retreatingUnitId.attackerId && retreatingUnitId.targetHex) {
           const att = gameState.units[retreatingUnitId.attackerId];
           if (att && getDistance(getUnitHex(retreatingUnitId.attackerId), retreatingUnitId.targetHex) === 1 && att.typeId !== 'artillery') {
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

      const { vpChange1, vpChange2, newGrid: updatedGrid } = checkObjectives(nG, prev.units, prev.activePlayerId, 'immediate');
      return {
        ...prev,
        grid: updatedGrid,
        victoryPoints: { player1: prev.victoryPoints.player1 + vpChange1, player2: prev.victoryPoints.player2 + vpChange2 }
      };
    });

    if (retreatingUnitId.count > 1) {
      setRetreatingUnitId(prev => ({ ...prev, count: prev.count - 1 }));
    } else {
      if (retreatingUnitId.attackerId && retreatingUnitId.targetHex) {
        const att = gameState.units[retreatingUnitId.attackerId];
        if (att && getDistance(getUnitHex(retreatingUnitId.attackerId), retreatingUnitId.targetHex) === 1 && att.typeId !== 'artillery') {
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

      const { vpChange1, vpChange2, newGrid: updatedGrid } = checkObjectives(nG, prev.units, prev.activePlayerId, 'immediate');
      const nVP = { player1: prev.victoryPoints.player1 + vpChange1, player2: prev.victoryPoints.player2 + vpChange2 };
      return {
        ...prev,
        grid: updatedGrid,
        victoryPoints: nVP,
        winner: nVP.player1 >= prev.scenario.victoryPointsToWin ? 'player1' : (nVP.player2 >= prev.scenario.victoryPointsToWin ? 'player2' : undefined)
      };
    });
    setTakeGroundOption(null);
  };
  const nextPhase = () => {
    setGameState(prev => {
      if (prev.phase === 'distribution-sections') return { ...prev, phase: 'distribution-units' };
      if (prev.phase === 'distribution-units') return { ...prev, phase: 'movement' };
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
    if (unit.typeId === 'artillery' && (unit.movementUsed > 0 || unit.hasMoved)) return [];
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
        if (u.ownerId !== activeP || u.resources <= 0 || u.hasAttacked) return false;
        if (u.typeId === 'artillery' && (u.movementUsed > 0 || u.hasMoved)) return false;
        const hex = getUnitHex(u.id);
        if (!hex) return false;

        // Can attack or destroy wire
        if (hex.overlayTypeId === 'wire' && u.typeId === 'infantry') return true;

        const utype = unitTypes.find(ut => ut.id === u.typeId);
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
