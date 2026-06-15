import { getDistance, getUnitSections, getNeighbors, getTargetableUnits, getDiceCount } from './hexGrid';
import { rollDice } from './dice';
import type { GameState, PlayerId, SectionId, Seats } from '../types/game';

// Rules (unit / terrain / overlay catalogs) are passed in so the reducer stays pure
// and can run identically on every client and inside a Firestore transaction.
export type Rules = { unitTypes: any[]; terrainTypes: any[]; overlayTypes: any[] };

export type Action =
  | { type: 'DISTRIBUTE'; clientId: string; section: SectionId; amount: number | 'max' }
  | { type: 'NEXT_PHASE'; clientId: string }
  | { type: 'END_TURN'; clientId: string }
  | { type: 'ASSIGN_RESOURCE'; clientId: string; unitId: string; sectionId?: SectionId }
  | { type: 'MOVE'; clientId: string; unitId: string; q: number; r: number }
  | { type: 'ATTACK'; clientId: string; attackerId: string; targetId: string }
  | { type: 'DESTROY_OVERLAY'; clientId: string; unitId: string }
  | { type: 'DISMISS_COMBAT'; clientId: string }
  | { type: 'RESOLVE_RETREAT'; clientId: string; unitId: string; q: number; r: number }
  | { type: 'RESOLVE_TAKE_GROUND'; clientId: string; unitId: string; q: number; r: number }
  | { type: 'CANCEL_TAKE_GROUND'; clientId: string };

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------
export function createInitialGameState(scenario: any, opts: { online?: boolean } = {}): GameState {
  const grid: Record<string, any> = {};
  for (let r = 0; r < scenario.boardHeight; r++) {
    const width = r % 2 === 0 ? scenario.boardWidth : scenario.boardWidth - 1;
    for (let col = 0; col < width; col++) {
      const q = col - Math.floor(r / 2);
      const key = `${q},${r}`;
      const initial = scenario.initialHexes.find((h: any) => h.q === q && h.r === r);
      grid[key] = initial ? { ...initial } : { q, r, s: -q - r, terrainTypeId: 'grass' };
    }
  }

  const units: Record<string, any> = {};
  const unitStats: Record<string, any> = {};
  scenario.initialUnits.forEach((u: any) => {
    units[u.id] = { ...u, movementUsed: 0, resourceOrigins: [] };
    unitStats[u.id] = {
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

  const state: GameState = {
    scenario,
    currentTurn: 1,
    activePlayerId: scenario?.firstPlayerId || 'player1',
    phase: 'distribution-sections',
    sectionResources: { player1: { left: 0, center: 0, right: 0 }, player2: { left: 0, center: 0, right: 0 } },
    centralWarehouse: { player1: scenario?.player1.income || 0, player2: scenario?.player2.income || 0 },
    units,
    grid,
    victoryPoints: { player1: [], player2: [] },
    unitStats,
    pendingCombat: null,
    pendingRetreat: null,
    pendingTakeGround: null
  };

  if (opts.online) {
    state.seats = { player1: {}, player2: {} } as Seats;
  }
  return state;
}

// ---------------------------------------------------------------------------
// Permission helpers (also used by the UI to gate controls)
// ---------------------------------------------------------------------------
// A game without `seats` is a local hot-seat game => one device controls everything.
export const isLocalGame = (state: GameState) => !state.seats;

export function isGeneral(state: GameState, clientId: string, team: PlayerId): boolean {
  if (isLocalGame(state)) return true;
  return state.seats![team]?.general === clientId;
}

// The general implicitly commands every section that has no dedicated commander.
// This makes the rules scale to any side size: 1 (general does everything),
// 3 (general also covers the empty section, e.g. center), or 4 players.
export function controlsSection(state: GameState, clientId: string, team: PlayerId, section: SectionId): boolean {
  if (isLocalGame(state)) return true;
  const s = state.seats![team] || {};
  if (s[section] === clientId) return true;
  if (s.general === clientId && !s[section]) return true;
  return false;
}

export function onTeam(state: GameState, clientId: string, team: PlayerId): boolean {
  if (isLocalGame(state)) return true;
  const s = state.seats![team] || {};
  return Object.values(s).includes(clientId);
}

const unitHex = (state: GameState, uid: string) => Object.values(state.grid).find((h: any) => h.unitId === uid) || null;

// While a dice roll / retreat / take-ground is awaiting resolution, no new
// move or attack may start. This keeps simultaneous commanders from overwriting
// each other's unresolved combat in real-time play.
const hasPendingCombat = (state: GameState) => !!(state.pendingCombat || state.pendingRetreat || state.pendingTakeGround);

function controlsUnit(state: GameState, clientId: string, unitId: string): boolean {
  const unit = state.units[unitId];
  if (!unit) return false;
  const hex = unitHex(state, unitId);
  if (!hex) return false;
  const secs = getUnitSections((hex as any).q, (hex as any).r, state.scenario);
  return secs.some((sec: SectionId) => controlsSection(state, clientId, unit.ownerId, sec));
}

const categoryOf = (utype: any) =>
  utype?.category || (utype?.id === 'tank' ? 'tank' : (utype?.id === 'artillery' ? 'artillery' : 'infantry'));

function computeWinner(scenario: any, units: Record<string, any>, vp: any): PlayerId | undefined {
  if (vp.player1.length >= scenario.victoryPointsToWin || !Object.values(units).some((u: any) => u.ownerId === 'player2')) return 'player1';
  if (vp.player2.length >= scenario.victoryPointsToWin || !Object.values(units).some((u: any) => u.ownerId === 'player1')) return 'player2';
  return undefined;
}

// Ported verbatim from useGameLogic – objective control / victory point bookkeeping.
function checkObjectives(grid: any, units: any, playerId: PlayerId, timing: string, round: number, currentVP: any) {
  const newGrid = { ...grid };
  const nVP = { player1: [...currentVP.player1], player2: [...currentVP.player2] } as any;

  const isValidForPlayer = (obj: any, pid: PlayerId) => !obj.validFor || obj.validFor === 'both' || obj.validFor === pid;

  // Update the per-hex `controllingPlayerId` of an objective: a friendly unit of
  // the active player captures it; temporary objectives release when no
  // controlling unit remains. Returns the (possibly new) objective object.
  const updateControl = (hex: any) => {
    const occupyingUnit = hex.unitId ? units[hex.unitId] : null;
    const obj = { ...hex.objective };
    let changed = false;

    if ((timing === 'immediate' || timing === 'startOfTurn')
        && occupyingUnit && occupyingUnit.ownerId === playerId
        && obj.timing === timing
        && obj.controllingPlayerId !== playerId) {
      obj.controllingPlayerId = playerId;
      changed = true;
    }

    if (obj.type === 'temporary' && obj.controllingPlayerId
        && (!occupyingUnit || occupyingUnit.ownerId !== obj.controllingPlayerId)) {
      obj.controllingPlayerId = undefined;
      changed = true;
    }

    return { obj, changed };
  };

  // --- Single-tile objectives (unchanged behaviour) ---
  Object.keys(newGrid).forEach(key => {
    const hex = newGrid[key];
    if (!hex.objective || hex.objective.groupId) return; // grouped objectives handled below

    const prevController = hex.objective.controllingPlayerId;
    const { obj, changed } = updateControl(hex);
    if (!changed) return;

    // Whoever previously held this hex loses its points; the new controller
    // (if any, and if the objective is valid for them) gains them.
    if (prevController) nVP[prevController] = nVP[prevController].filter((vp: any) => vp.objectiveHexKey !== key);
    if (obj.controllingPlayerId && isValidForPlayer(obj, obj.controllingPlayerId)) {
      const ctrl = obj.controllingPlayerId;
      for (let i = 0; i < obj.points; i++) {
        nVP[ctrl].push({
          id: `obj-${key}-${i}-${round}`,
          type: 'objective',
          round,
          objectiveName: obj.name || 'Cíl',
          objectiveHexKey: key
        });
      }
    }
    newGrid[key] = { ...hex, objective: obj };
  });

  // --- Multi-tile objective groups ---
  // First refresh per-hex control for every grouped hex, collecting the groups.
  const groups: Record<string, { keys: string[]; obj: any }> = {};
  Object.keys(newGrid).forEach(key => {
    const hex = newGrid[key];
    if (!hex.objective || !hex.objective.groupId) return;
    const { obj } = updateControl(hex);
    newGrid[key] = { ...hex, objective: obj };
    const gid = obj.groupId;
    if (!groups[gid]) groups[gid] = { keys: [], obj };
    groups[gid].keys.push(key);
    groups[gid].obj = obj; // any member carries the shared group settings
  });

  // Then award (or revoke) the group's victory points based on its condition.
  Object.keys(groups).forEach(gid => {
    const { keys, obj } = groups[gid];
    const total = keys.length;
    const controlled = { player1: 0, player2: 0 } as Record<PlayerId, number>;
    keys.forEach(k => {
      const c = newGrid[k].objective.controllingPlayerId as PlayerId | undefined;
      if (c) controlled[c]++;
    });

    const condition = obj.condition || 'all';
    const meets = (pid: PlayerId) => {
      const n = controlled[pid];
      if (n === 0) return false;
      if (condition === 'any') return n >= 1;
      if (condition === 'majority') return n > total / 2;
      return n === total; // 'all'
    };

    const groupKey = `group-${gid}`;
    (['player1', 'player2'] as PlayerId[]).forEach(pid => {
      const has = nVP[pid].some((vp: any) => vp.objectiveGroupKey === groupKey);
      const should = meets(pid) && isValidForPlayer(obj, pid);
      if (should && !has) {
        for (let i = 0; i < obj.points; i++) {
          nVP[pid].push({
            id: `obj-${groupKey}-${i}-${round}`,
            type: 'objective',
            round,
            objectiveName: obj.name || 'Cíl',
            objectiveGroupKey: groupKey
          });
        }
      } else if (!should && has) {
        nVP[pid] = nVP[pid].filter((vp: any) => vp.objectiveGroupKey !== groupKey);
      }
    });
  });

  return { nVP, newGrid };
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------
export function reducer(state: GameState, action: Action, rules: Rules): GameState {
  const { unitTypes, terrainTypes, overlayTypes } = rules;
  const active = state.activePlayerId;
  const getTerrainAt = (q: number, r: number) => { const hex = state.grid[`${q},${r}`]; return terrainTypes.find(t => t.id === hex?.terrainTypeId) || terrainTypes[0]; };
  const getOverlayAt = (q: number, r: number) => { const hex = state.grid[`${q},${r}`]; return overlayTypes.find(o => o.id === hex?.overlayTypeId) || null; };

  switch (action.type) {
    // -------------------------------------------------- General: distribute
    case 'DISTRIBUTE': {
      if (state.phase !== 'distribution-sections') return state;
      if (!isGeneral(state, action.clientId, active)) return state;
      if (state.centralWarehouse[active] <= 0) return state;
      const pid = active;
      const actualAmount = action.amount === 'max' ? state.centralWarehouse[pid] : Math.min(action.amount, state.centralWarehouse[pid]);
      return {
        ...state,
        centralWarehouse: { ...state.centralWarehouse, [pid]: state.centralWarehouse[pid] - actualAmount },
        sectionResources: { ...state.sectionResources, [pid]: { ...state.sectionResources[pid], [action.section]: state.sectionResources[pid][action.section] + actualAmount } }
      };
    }

    // -------------------------------------------------- General: advance phase
    case 'NEXT_PHASE': {
      if (!isGeneral(state, action.clientId, active)) return state;
      if (state.phase === 'distribution-sections') {
        return { ...state, phase: 'distribution-units', centralWarehouse: { ...state.centralWarehouse, [active]: 0 } };
      }
      if (state.phase === 'distribution-units') {
        return { ...state, phase: 'movement', sectionResources: { ...state.sectionResources, [active]: { left: 0, center: 0, right: 0 } } };
      }
      if (state.phase === 'movement') return { ...state, phase: 'attack' };
      return state;
    }

    // -------------------------------------------------- General: end turn
    case 'END_TURN': {
      if (!isGeneral(state, action.clientId, active)) return state;
      const next: PlayerId = active === 'player1' ? 'player2' : 'player1';
      const newUnits: Record<string, any> = { ...state.units };
      Object.keys(newUnits).forEach(id => {
        const u = newUnits[id];
        if (u.ownerId === next) {
          newUnits[id] = { ...u, resources: 0, resourceOrigins: [], hasMoved: false, hasAttacked: false, movementUsed: 0 };
        } else {
          newUnits[id] = {
            ...u,
            resources: Math.min(u.resources, 1),
            resourceOrigins: u.resourceOrigins ? u.resourceOrigins.slice(0, Math.min(u.resources, 1)) : [],
            hasMoved: false, hasAttacked: false, movementUsed: 0
          };
        }
      });
      const { nVP, newGrid: updatedGrid } = checkObjectives(state.grid, newUnits, next, 'startOfTurn', state.currentTurn, state.victoryPoints);
      return {
        ...state,
        activePlayerId: next,
        phase: 'distribution-sections',
        currentTurn: active === 'player2' ? state.currentTurn + 1 : state.currentTurn,
        centralWarehouse: { ...state.centralWarehouse, [next]: state.scenario[next].income },
        units: newUnits,
        grid: updatedGrid,
        victoryPoints: nVP,
        pendingCombat: null, pendingRetreat: null, pendingTakeGround: null,
        winner: computeWinner(state.scenario, newUnits, nVP)
      };
    }

    // -------------------------------------------------- Commander: assign resource to unit
    case 'ASSIGN_RESOURCE': {
      const { unitId, sectionId } = action;
      const unit = state.units[unitId];
      if (state.phase !== 'distribution-units' || !unit || unit.ownerId !== active) return state;
      if (!controlsUnit(state, action.clientId, unitId)) return state;
      const hex = unitHex(state, unitId);
      if (!hex) return state;

      const isAtMax = unit.resources >= 3;
      const clickedUnitBody = !sectionId;
      const sections = getUnitSections((hex as any).q, (hex as any).r, state.scenario);
      const isBoundaryUnit = sections.length > 1;

      let sec = sectionId;
      if (!sec && !isBoundaryUnit) sec = sections[0];

      const canAdd = !!sec && state.sectionResources[active][sec] > 0 && unit.resources < 3;

      if (isAtMax || (clickedUnitBody && isBoundaryUnit && unit.resources > 0) || (clickedUnitBody && !isBoundaryUnit && unit.resources > 0 && !canAdd)) {
        const origins = unit.resourceOrigins || [];
        const newSecRes = { ...state.sectionResources[active] } as any;
        origins.forEach((o: SectionId) => { if (newSecRes[o] !== undefined) newSecRes[o]++; });
        return {
          ...state,
          sectionResources: { ...state.sectionResources, [active]: newSecRes },
          units: { ...state.units, [unitId]: { ...unit, resources: 0, resourceOrigins: [] } }
        };
      }

      if (canAdd) {
        const newSecRes = { ...state.sectionResources[active], [sec!]: state.sectionResources[active][sec!] - 1 } as any;
        const newOrigins = [...(unit.resourceOrigins || []), sec as SectionId];
        const newState: GameState = {
          ...state,
          sectionResources: { ...state.sectionResources, [active]: newSecRes },
          units: { ...state.units, [unitId]: { ...unit, resources: unit.resources + 1, resourceOrigins: newOrigins } }
        };
        if (newSecRes.left === 0 && newSecRes.center === 0 && newSecRes.right === 0) newState.phase = 'movement';
        return newState;
      }
      return state;
    }

    // -------------------------------------------------- Commander: move
    case 'MOVE': {
      const { unitId: uid, q: tq, r: tr } = action;
      const unit = state.units[uid];
      if (state.phase !== 'movement' || !unit || unit.ownerId !== active) return state;
      if (hasPendingCombat(state)) return state;
      if (!controlsUnit(state, action.clientId, uid)) return state;
      if (!unit.hasMoved && unit.resources <= 0) return state;
      const fHex = unitHex(state, uid);
      if (!fHex) return state;
      const dist = getDistance(fHex, { q: tq, r: tr });
      const utype = unitTypes.find(ut => ut.id === unit.typeId);
      if (!utype || (unit.movementUsed + dist) > utype.movement || state.grid[`${tq},${tr}`]?.unitId) return state;

      const nGrid = { ...state.grid } as any;
      const fromHex = nGrid[`${(fHex as any).q},${(fHex as any).r}`];
      const targetHex = nGrid[`${tq},${tr}`];
      if (fromHex.overlayTypeId === 'sandbags') fromHex.overlayTypeId = undefined;
      fromHex.unitId = undefined;
      targetHex.unitId = uid;

      const totalDist = unit.movementUsed + dist;
      const newResources = unit.hasMoved ? unit.resources : unit.resources - 1;
      const targetTerrain = terrainTypes.find(t => t.id === targetHex?.terrainTypeId);
      const targetOverlayId = targetHex?.overlayTypeId;

      let isStopTerrain = targetTerrain?.movementRestriction === 'stop' || targetOverlayId === 'wire';
      let allowAttackAfterStop = false;
      if (targetOverlayId === 'wire') {
        allowAttackAfterStop = true;
        if (utype.category === 'tank') targetHex.overlayTypeId = undefined;
      }
      const finalMovementUsed = isStopTerrain ? utype.movement : totalDist;
      const hasAttacked = (isStopTerrain && !allowAttackAfterStop) || (totalDist > utype.canShootAfterMovingMax ? true : unit.hasAttacked);

      const newStats = { ...state.unitStats } as any;
      newStats[uid] = { ...newStats[uid], distanceTraveled: newStats[uid].distanceTraveled + dist };
      const { nVP, newGrid: updatedGrid } = checkObjectives(nGrid, state.units, active, 'immediate', state.currentTurn, state.victoryPoints);

      const newUnits = { ...state.units, [uid]: { ...unit, resources: newResources, hasMoved: true, movementUsed: finalMovementUsed, hasAttacked } };
      return { ...state, grid: updatedGrid, units: newUnits, victoryPoints: nVP, unitStats: newStats, winner: computeWinner(state.scenario, state.units, nVP) };
    }

    // -------------------------------------------------- Commander: attack
    case 'ATTACK': {
      const { attackerId: aid, targetId: tid } = action;
      const att = state.units[aid];
      const tar = state.units[tid];
      if (state.phase !== 'attack' || !att || !tar || att.ownerId !== active || att.resources <= 0 || att.hasAttacked) return state;
      if (hasPendingCombat(state)) return state;
      if (!controlsUnit(state, action.clientId, aid)) return state;

      const utype = unitTypes.find(u => u.id === att.typeId);
      if (!utype) return state;
      const attCategory = categoryOf(utype);
      if (attCategory === 'artillery' && (att.movementUsed > 0 || att.hasMoved)) return state;

      const fH = unitHex(state, aid);
      const tH = unitHex(state, tid);
      if (!fH || !tH) return state;
      const targetable = getTargetableUnits((fH as any).q, (fH as any).r, utype, state, terrainTypes, overlayTypes);
      if (!targetable.includes(tid)) return state;

      const dist = getDistance(fH, tH);
      const tarTerrain = getTerrainAt((tH as any).q, (tH as any).r);
      const tarOverlay = getOverlayAt((tH as any).q, (tH as any).r);
      const isArtillery = attCategory === 'artillery';
      const dC = getDiceCount(att, tar, fH, tH, state.grid, terrainTypes, overlayTypes, utype);

      let ignoreFlags = 0;
      if (!isArtillery) ignoreFlags = Math.max(tarTerrain.ignoreFlags ?? 0, tarOverlay?.ignoreFlags ?? 0);

      const dice = rollDice(dC);
      let h = 0, f = 0;
      const targetUnitType = unitTypes.find(ut => ut.id === tar.typeId);
      const targetCategory = categoryOf(targetUnitType);
      dice.forEach(s => { if (s === 'grenade' || s === targetCategory) h++; if (s === 'flag') f++; });
      const finalFlags = Math.max(0, f - ignoreFlags);

      let nU = { ...state.units } as any;
      let nG = { ...state.grid } as any;
      let nVP = { player1: [...state.victoryPoints.player1], player2: [...state.victoryPoints.player2] } as any;
      let nStats = { ...state.unitStats } as any;

      let upT = { ...nU[tid] };
      let targetStats = { ...nStats[tid] };
      let attackerStats = { ...nStats[aid] };
      attackerStats.damageDealt += h;
      targetStats.damageTaken += h;
      if (!targetStats.attackers.includes(att.typeId)) targetStats.attackers.push(att.typeId);

      for (let i = 0; i < h; i++) { if (upT.resources > 0) upT.resources--; else upT.figures--; }

      let pendingRetreat: any = null;
      let pendingTakeGround: any = null;
      let isEliminated = false;
      if (upT.figures <= 0) {
        attackerStats.kills += 1;
        targetStats.destroyedInRound = state.currentTurn;
        delete nU[tid];
        nG[`${(tH as any).q},${(tH as any).r}`].unitId = undefined;
        if (nG[`${(tH as any).q},${(tH as any).r}`].overlayTypeId === 'sandbags') nG[`${(tH as any).q},${(tH as any).r}`].overlayTypeId = undefined;
        nVP[att.ownerId].push({ id: `kill-${tid}-${state.currentTurn}`, type: 'unit', round: state.currentTurn, unitStats: targetStats });
        isEliminated = true;
      } else {
        nU[tid] = upT;
      }
      nStats[aid] = attackerStats;
      nStats[tid] = targetStats;
      nU[aid] = { ...nU[aid], resources: nU[aid].resources - 1, hasAttacked: true };

      if (isEliminated) {
        const { nVP: updatedVP, newGrid: updatedGrid } = checkObjectives(nG, nU, active, 'immediate', state.currentTurn, { player1: nVP.player1, player2: nVP.player2 });
        nG = updatedGrid;
        nVP = updatedVP;
        if (dist === 1 && attCategory !== 'artillery') pendingTakeGround = { unitId: aid, hex: { q: (tH as any).q, r: (tH as any).r } };
      } else if (finalFlags > 0) {
        pendingRetreat = { unitId: tid, count: finalFlags, attackerId: aid, targetHex: { q: (tH as any).q, r: (tH as any).r } };
      }

      return {
        ...state,
        units: nU, grid: nG, victoryPoints: nVP, unitStats: nStats,
        pendingCombat: { attackerId: aid, targetId: tid, dice, hits: h, flags: f },
        pendingRetreat, pendingTakeGround,
        winner: computeWinner(state.scenario, nU, nVP)
      };
    }

    // -------------------------------------------------- Commander: destroy wire
    case 'DESTROY_OVERLAY': {
      const { unitId: uid } = action;
      const unit = state.units[uid];
      if (state.phase !== 'attack' || !unit || unit.ownerId !== active || unit.resources <= 0 || unit.hasAttacked) return state;
      if (hasPendingCombat(state)) return state;
      if (!controlsUnit(state, action.clientId, uid)) return state;
      const hex = unitHex(state, uid);
      if (!hex || (hex as any).overlayTypeId !== 'wire') return state;
      const nG = { ...state.grid } as any;
      nG[`${(hex as any).q},${(hex as any).r}`].overlayTypeId = undefined;
      return { ...state, grid: nG, units: { ...state.units, [uid]: { ...unit, resources: unit.resources - 1, hasAttacked: true } } };
    }

    // -------------------------------------------------- Dismiss the dice animation
    case 'DISMISS_COMBAT': {
      if (!state.pendingCombat) return state;
      if (!onTeam(state, action.clientId, active)) return state;
      return { ...state, pendingCombat: null };
    }

    // -------------------------------------------------- Defender resolves retreat
    case 'RESOLVE_RETREAT': {
      const pr = state.pendingRetreat;
      const { unitId: uid, q: tq, r: tr } = action;
      if (!pr || pr.unitId !== uid) return state;
      const unit = state.units[uid];
      if (!unit) return state;
      // retreat is resolved by the owner (defending) team's commander of that section
      if (!controlsUnit(state, action.clientId, uid)) return state;
      const fH = unitHex(state, uid);
      if (!fH) return state;

      // Stay on the same hex => take a casualty instead of retreating.
      if ((fH as any).q === tq && (fH as any).r === tr) {
        const nU = { ...state.units } as any;
        const nVP = { player1: [...state.victoryPoints.player1], player2: [...state.victoryPoints.player2] } as any;
        const nStats = { ...state.unitStats } as any;
        let u = { ...nU[uid] };
        let uStats = { ...nStats[uid] };
        uStats.damageTaken += 1;
        if (u.resources > 0) u.resources--; else u.figures--;
        let nG = { ...state.grid } as any;
        let died = false;
        if (u.figures <= 0) {
          uStats.destroyedInRound = state.currentTurn;
          delete nU[uid];
          nG[`${(fH as any).q},${(fH as any).r}`].unitId = undefined;
          if (nG[`${(fH as any).q},${(fH as any).r}`].overlayTypeId === 'sandbags') nG[`${(fH as any).q},${(fH as any).r}`].overlayTypeId = undefined;
          const attacker = state.units[pr.attackerId];
          if (attacker) {
            nVP[attacker.ownerId].push({ id: `kill-${uid}-${state.currentTurn}`, type: 'unit', round: state.currentTurn, unitStats: uStats });
            if (nStats[pr.attackerId]) nStats[pr.attackerId] = { ...nStats[pr.attackerId], kills: nStats[pr.attackerId].kills + 1 };
          }
          died = true;
        } else {
          nU[uid] = u;
        }
        nStats[uid] = uStats;
        const { nVP: finalVP, newGrid: updatedGrid } = checkObjectives(nG, nU, active, 'immediate', state.currentTurn, nVP);

        let pendingRetreat: any = state.pendingRetreat;
        let pendingTakeGround: any = state.pendingTakeGround;
        if (died || pr.count <= 1) {
          pendingRetreat = null;
          const att = nU[pr.attackerId];
          const attType = unitTypes.find(ut => ut.id === att?.typeId);
          const category = categoryOf(attType);
          const attHex = att ? unitHex({ ...state, grid: updatedGrid } as any, pr.attackerId) : null;
          if (att && attHex && getDistance(attHex, pr.targetHex) === 1 && category !== 'artillery') {
            pendingTakeGround = { unitId: pr.attackerId, hex: pr.targetHex };
          }
        } else {
          pendingRetreat = { ...pr, count: pr.count - 1 };
        }

        return { ...state, units: nU, grid: updatedGrid, victoryPoints: finalVP, unitStats: nStats, pendingRetreat, pendingTakeGround, winner: computeWinner(state.scenario, nU, finalVP) };
      }

      // Retreat into a neighbouring hex (must move backwards relative to owner).
      if (getDistance(fH, { q: tq, r: tr }) !== 1 || state.grid[`${tq},${tr}`]?.unitId) return state;
      if (unit.ownerId === 'player1' ? tr <= (fH as any).r : tr >= (fH as any).r) return state;

      const nG = { ...state.grid } as any;
      const fromHex = nG[`${(fH as any).q},${(fH as any).r}`];
      if (fromHex.overlayTypeId === 'sandbags') fromHex.overlayTypeId = undefined;
      fromHex.unitId = undefined;
      nG[`${tq},${tr}`].unitId = uid;
      const nStats = { ...state.unitStats } as any;
      if (nStats[uid]) nStats[uid] = { ...nStats[uid], distanceTraveled: nStats[uid].distanceTraveled + 1 };
      const { nVP, newGrid: updatedGrid } = checkObjectives(nG, state.units, active, 'immediate', state.currentTurn, state.victoryPoints);

      let pendingRetreat: any;
      let pendingTakeGround: any = state.pendingTakeGround;
      if (pr.count > 1) {
        pendingRetreat = { ...pr, count: pr.count - 1 };
      } else {
        pendingRetreat = null;
        const att = state.units[pr.attackerId];
        const attType = unitTypes.find(ut => ut.id === att?.typeId);
        const category = categoryOf(attType);
        const attHex = att ? unitHex({ ...state, grid: updatedGrid } as any, pr.attackerId) : null;
        if (att && attHex && getDistance(attHex, pr.targetHex) === 1 && category !== 'artillery') {
          pendingTakeGround = { unitId: pr.attackerId, hex: pr.targetHex };
        }
      }
      return { ...state, grid: updatedGrid, victoryPoints: nVP, unitStats: nStats, pendingRetreat, pendingTakeGround, winner: computeWinner(state.scenario, state.units, nVP) };
    }

    // -------------------------------------------------- Attacker takes ground
    case 'RESOLVE_TAKE_GROUND': {
      const tg = state.pendingTakeGround;
      const { unitId: uid, q, r } = action;
      if (!tg || tg.unitId !== uid) return state;
      if (!controlsUnit(state, action.clientId, uid)) return state;
      if (tg.hex.q !== q || tg.hex.r !== r) return { ...state, pendingTakeGround: null };
      const fH = unitHex(state, uid);
      if (!fH || state.grid[`${q},${r}`]?.unitId) return { ...state, pendingTakeGround: null };
      const nG = { ...state.grid } as any;
      const fromHex = nG[`${(fH as any).q},${(fH as any).r}`];
      if (fromHex.overlayTypeId === 'sandbags') fromHex.overlayTypeId = undefined;
      fromHex.unitId = undefined;
      nG[`${q},${r}`].unitId = uid;
      const nStats = { ...state.unitStats } as any;
      if (nStats[uid]) nStats[uid] = { ...nStats[uid], distanceTraveled: nStats[uid].distanceTraveled + 1 };
      const { nVP, newGrid: updatedGrid } = checkObjectives(nG, state.units, active, 'immediate', state.currentTurn, state.victoryPoints);
      return { ...state, grid: updatedGrid, victoryPoints: nVP, unitStats: nStats, pendingTakeGround: null, winner: computeWinner(state.scenario, state.units, nVP) };
    }

    case 'CANCEL_TAKE_GROUND': {
      if (!state.pendingTakeGround) return state;
      if (!controlsUnit(state, action.clientId, state.pendingTakeGround.unitId)) return state;
      return { ...state, pendingTakeGround: null };
    }

    default:
      return state;
  }
}
