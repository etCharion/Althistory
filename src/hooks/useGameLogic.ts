import { useState, useMemo, useEffect, useCallback } from 'react';
import { getNeighbors, getReachableHexes, getTargetableUnits } from '../logic/hexGrid';
import { subscribeToGame, applyAction, createGameIfMissing } from '../logic/firebaseService';
import { reducer, createInitialGameState } from '../logic/gameReducer';
import type { Action, Rules } from '../logic/gameReducer';

export function useGameLogic(scenario, unitTypes, terrainTypes, overlayTypes, gameId?: string, clientId: string = 'local') {
  const rules: Rules = useMemo(() => ({ unitTypes, terrainTypes, overlayTypes }), [unitTypes, terrainTypes, overlayTypes]);

  // Local (hot-seat) games keep their state in React; online games mirror Firestore.
  const [localState, setLocalState] = useState<any>(() => (scenario && !gameId ? createInitialGameState(scenario) : null));
  const [remoteState, setRemoteState] = useState<any>(null);

  // Initialise local state once a scenario is available (local games only).
  useEffect(() => {
    if (!gameId && scenario && !localState) setLocalState(createInitialGameState(scenario));
  }, [scenario, gameId, localState]);

  // Online: make sure the shared document exists, then subscribe to it.
  useEffect(() => {
    if (!gameId) return;
    if (scenario) createGameIfMissing(gameId, scenario);
    const unsubscribe = subscribeToGame(gameId, (remote) => setRemoteState(remote));
    return () => unsubscribe();
  }, [gameId, scenario]);

  const gameState = gameId ? remoteState : localState;

  const dispatch = useCallback((action: Action) => {
    if (gameId) {
      applyAction(gameId, action, rules);
    } else {
      setLocalState((prev) => (prev ? reducer(prev, action, rules) : prev));
    }
  }, [gameId, rules]);

  // ---- Action creators (thin wrappers around dispatch) ----
  const distributeResource = (_pid, sec, amount: number | 'max' = 1) => dispatch({ type: 'DISTRIBUTE', clientId, section: sec, amount });
  const nextPhase = () => dispatch({ type: 'NEXT_PHASE', clientId });
  const endTurn = () => dispatch({ type: 'END_TURN', clientId });
  const assignResourceToUnit = (uid, sectionId?) => dispatch({ type: 'ASSIGN_RESOURCE', clientId, unitId: uid, sectionId });
  const moveUnit = (uid, q, r) => dispatch({ type: 'MOVE', clientId, unitId: uid, q, r });
  const attackUnit = (aid, tid) => dispatch({ type: 'ATTACK', clientId, attackerId: aid, targetId: tid });
  const destroyOverlay = (uid) => dispatch({ type: 'DESTROY_OVERLAY', clientId, unitId: uid });
  const retreatUnit = (uid, q, r) => dispatch({ type: 'RESOLVE_RETREAT', clientId, unitId: uid, q, r });
  const takeGround = (uid, q, r) => dispatch({ type: 'RESOLVE_TAKE_GROUND', clientId, unitId: uid, q, r });
  const cancelTakeGround = () => dispatch({ type: 'CANCEL_TAKE_GROUND', clientId });
  const dismissCombat = () => dispatch({ type: 'DISMISS_COMBAT', clientId });

  // ---- Shared combat state (mirrors Firestore so every player sees it) ----
  const combatResult = gameState?.pendingCombat || null;
  const retreatingUnitId = gameState?.pendingRetreat || null;
  const takeGroundOption = gameState?.pendingTakeGround || null;

  // ---- Read-only derivations used by the view ----
  const getUnitHex = (uid) => (gameState ? Object.values(gameState.grid).find((h: any) => h.unitId === uid) || null : null);

  const getSelectedReachable = (uid) => {
    if (!gameState) return [];
    const unit = gameState.units[uid]; if (!unit) return [];
    const hex = getUnitHex(uid); if (!hex) return [];
    const utype = unitTypes.find(u => u.id === unit.typeId);
    const limit = utype.movement - unit.movementUsed;
    if (limit <= 0 || (!unit.hasMoved && unit.resources <= 0)) return [];
    return getReachableHexes((hex as any).q, (hex as any).r, limit, gameState.grid, terrainTypes, overlayTypes);
  };

  const getSelectedTargetable = (uid) => {
    if (!gameState) return [];
    const unit = gameState.units[uid]; if (!unit) return [];
    const hex = getUnitHex(uid); if (!hex) return [];
    const utype = unitTypes.find(u => u.id === unit.typeId);
    if (unit.resources <= 0 || unit.hasAttacked) return [];
    const category = utype?.category || (utype?.id === 'tank' ? 'tank' : (utype?.id === 'artillery' ? 'artillery' : 'infantry'));
    if (category === 'artillery' && (unit.movementUsed > 0 || unit.hasMoved)) return [];
    return getTargetableUnits((hex as any).q, (hex as any).r, utype, gameState, terrainTypes, overlayTypes);
  };

  const getRetreatHexes = (uid) => {
    if (!gameState) return [];
    const unit = gameState.units[uid];
    const fH = getUnitHex(uid);
    if (!unit || !fH) return [];
    const neighbors = getNeighbors((fH as any).q, (fH as any).r);
    const valid = neighbors.filter(n => {
      const hex = gameState.grid[`${n.q},${n.r}`];
      if (!hex || hex.unitId) return false;
      if (unit.ownerId === 'player1') return n.r > (fH as any).r;
      if (unit.ownerId === 'player2') return n.r < (fH as any).r;
      return false;
    }).map(n => `${n.q},${n.r}`);
    valid.push(`${(fH as any).q},${(fH as any).r}`);
    return valid;
  };

  const getUnusedActions = () => {
    if (!gameState) return [];
    const activeP = gameState.activePlayerId;
    const reasons: string[] = [];
    if (gameState.phase === 'distribution-sections') {
      if (gameState.centralWarehouse[activeP] > 0) reasons.push(`Sklad: ${gameState.centralWarehouse[activeP]}`);
    } else if (gameState.phase === 'distribution-units') {
      const res = gameState.sectionResources[activeP];
      const parts: string[] = [];
      if (res.left > 0) parts.push(`L: ${res.left}`);
      if (res.center > 0) parts.push(`C: ${res.center}`);
      if (res.right > 0) parts.push(`R: ${res.right}`);
      if (parts.length > 0) reasons.push(`Sekce: ${parts.join(', ')}`);
    } else if (gameState.phase === 'movement') {
      const movable = Object.values(gameState.units).filter((u: any) => {
        if (u.ownerId !== activeP) return false;
        const utype = unitTypes.find(ut => ut.id === u.typeId);
        const canStart = !u.hasMoved && u.resources > 0;
        const canContinue = u.hasMoved && u.movementUsed < (utype?.movement || 0);
        return canStart || canContinue;
      });
      if (movable.length > 0) reasons.push(`Jednotky k pohybu: ${movable.length}`);
    } else if (gameState.phase === 'attack') {
      const attackable = Object.values(gameState.units).filter((u: any) => {
        const utype = unitTypes.find(ut => ut.id === u.typeId);
        if (u.ownerId !== activeP || u.resources <= 0 || u.hasAttacked) return false;
        const category = utype?.category || (utype?.id === 'tank' ? 'tank' : (utype?.id === 'artillery' ? 'artillery' : 'infantry'));
        if (category === 'artillery' && (u.movementUsed > 0 || u.hasMoved)) return false;
        const hex = getUnitHex(u.id);
        if (!hex) return false;
        if ((hex as any).overlayTypeId === 'wire' && category === 'infantry') return true;
        return getTargetableUnits((hex as any).q, (hex as any).r, utype, gameState, terrainTypes, overlayTypes).length > 0;
      });
      if (attackable.length > 0) reasons.push(`Jednotky k útoku: ${attackable.length}`);
    }
    return reasons;
  };

  const hasAvailableActions = () => getUnusedActions().length > 0;

  return {
    gameState, combatResult, retreatingUnitId, takeGroundOption,
    dismissCombat, cancelTakeGround, takeGround, destroyOverlay,
    distributeResource, nextPhase, endTurn, assignResourceToUnit, moveUnit, attackUnit, retreatUnit,
    getSelectedReachable, getSelectedTargetable, getRetreatHexes, getUnitHex, hasAvailableActions, getUnusedActions
  };
}
