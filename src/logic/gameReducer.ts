import { getDistance, getUnitSections, getNeighbors, getTargetableUnits, getDiceCount, getReachableDistances, isImpassableForUnit, blocksRetreatInto } from './hexGrid';
import { rollDice } from './dice';
import type { GameState, PlayerId, SectionId, Seats, UndoSnapshot } from '../types/game';

// Rules (unit / terrain / overlay catalogs) are passed in so the reducer stays pure
// and can run identically on every client and inside a Firestore transaction.
export type Rules = { unitTypes: any[]; terrainTypes: any[]; overlayTypes: any[] };

export type Action =
  | { type: 'DISTRIBUTE'; clientId: string; section: SectionId; amount: number | 'max' }
  // Sloučená distribuce: přesune jeden zdroj ze skladu přes sklad sekce rovnou
  // na jednotku (jen ve sloučeném režimu, viz scenario.mergedDistribution).
  | { type: 'DISTRIBUTE_TO_UNIT'; clientId: string; unitId: string; sectionId?: SectionId }
  // `skipUnitPhase` přeskočí fázi přidělení jednotkám (sloučený režim jde ze
  // sekcí rovnou na pohyb). AI ho nikdy neposílá – hraje obě fáze jako dnes.
  | { type: 'NEXT_PHASE'; clientId: string; skipUnitPhase?: boolean }
  | { type: 'END_TURN'; clientId: string }
  | { type: 'ASSIGN_RESOURCE'; clientId: string; unitId: string; sectionId?: SectionId }
  | { type: 'MOVE'; clientId: string; unitId: string; q: number; r: number }
  // `seed` určuje výsledek hodu kostkami – generuje ho action creator, aby byl
  // reducer deterministický (viz rollDice).
  | { type: 'ATTACK'; clientId: string; attackerId: string; targetId: string; seed?: number }
  | { type: 'DESTROY_OVERLAY'; clientId: string; unitId: string }
  | { type: 'DISMISS_COMBAT'; clientId: string }
  | { type: 'RESOLVE_RETREAT'; clientId: string; unitId: string; q: number; r: number }
  | { type: 'RESOLVE_TAKE_GROUND'; clientId: string; unitId: string; q: number; r: number }
  | { type: 'CANCEL_TAKE_GROUND'; clientId: string }
  | { type: 'UNDO'; clientId: string };

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
    sectionThroughput: { player1: { left: 0, center: 0, right: 0 }, player2: { left: 0, center: 0, right: 0 } },
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

// Capture the current per-phase state so a reversible action (DISTRIBUTE / MOVE)
// can be undone while the phase is still open. The grid hexes are cloned
// defensively – the reducer treats hexes as immutable, but a stray in-place
// mutation anywhere would otherwise silently corrupt the snapshot.
function pushUndo(state: GameState, clientId: string): UndoSnapshot[] {
  const snap: UndoSnapshot = {
    clientId,
    phase: state.phase,
    units: state.units,
    grid: Object.fromEntries(Object.entries(state.grid).map(([k, h]) => [k, { ...h }])),
    unitStats: state.unitStats,
    victoryPoints: state.victoryPoints,
    sectionResources: state.sectionResources,
    centralWarehouse: state.centralWarehouse,
    sectionThroughput: state.sectionThroughput
  };
  return [...(state.undoStack || []), snap];
}

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

export const categoryOf = (utype: any) =>
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
      // Logistické omezení: jakmile sekce dosáhne 4 zdrojů, každý další zdroj
      // stojí ze skladu 2 zdroje místo 1. Zdroje proto přidáváme po jednom a
      // průběžně počítáme skutečnou cenu ze skladu.
      const logistics = !!state.scenario.logisticsLimit;
      let sectionCount = state.sectionResources[pid][action.section];
      let warehouseLeft = state.centralWarehouse[pid];
      const want = action.amount === 'max' ? Infinity : action.amount;
      let added = 0;
      while (added < want) {
        const unitCost = logistics && sectionCount >= 4 ? 2 : 1;
        if (warehouseLeft < unitCost) break;
        warehouseLeft -= unitCost;
        sectionCount += 1;
        added += 1;
      }
      if (added === 0) return state;
      return {
        ...state,
        undoStack: pushUndo(state, action.clientId),
        centralWarehouse: { ...state.centralWarehouse, [pid]: warehouseLeft },
        sectionResources: { ...state.sectionResources, [pid]: { ...state.sectionResources[pid], [action.section]: sectionCount } }
      };
    }

    // ---------------------------------------- Sloučený režim: distribuce na jednotku
    case 'DISTRIBUTE_TO_UNIT': {
      // Klik na jednotku přesune jeden zdroj ze skladu přes sklad sekce rovnou
      // na jednotku. Sklad sekce se přitom nenaplní (zdroj jím jen protéká),
      // logistická přirážka se proto počítá z průtoku sekcí za tah.
      if (!state.scenario.mergedDistribution) return state;
      if (state.phase !== 'distribution-sections') return state;
      const { unitId, sectionId } = action;
      const unit = state.units[unitId];
      if (!unit || unit.ownerId !== active) return state;
      // Kombinace obou práv (generál pro krok sklad→sekce, controlsUnit pro krok
      // sekce→jednotka) sama zajistí, že sloučeně distribuuje jen samostatný
      // ovladatel strany – v online hře s veliteli sekcí akce neprojde.
      if (!isGeneral(state, action.clientId, active)) return state;
      if (!controlsUnit(state, action.clientId, unitId)) return state;
      const hex = unitHex(state, unitId);
      if (!hex) return state;

      const pid = active;
      const sections = getUnitSections((hex as any).q, (hex as any).r, state.scenario);
      const isBoundaryUnit = sections.length > 1;
      // Explicitně zadaná sekce musí být jednou ze sekcí jednotky (reducer je
      // jediná autorita). Hraniční jednotka (2 sekce) sekci vyžaduje.
      if (sectionId && !sections.includes(sectionId)) return state;
      let sec = sectionId;
      if (!sec && !isBoundaryUnit) sec = sections[0];

      const throughput = state.sectionThroughput || { player1: { left: 0, center: 0, right: 0 }, player2: { left: 0, center: 0, right: 0 } };
      const logistics = !!state.scenario.logisticsLimit;
      const cost = sec ? (logistics && throughput[pid][sec] >= 4 ? 2 : 1) : 1;
      const affordable = !!sec && state.centralWarehouse[pid] >= cost;
      const canAdd = affordable && unit.resources < 2;

      const isAtMax = unit.resources >= 2;
      const clickedUnitBody = !sectionId;
      // Klik na plnou (nebo hraniční obsazenou) jednotku vrací její zdroje do
      // skladu, aby šlo přerozdělit – obdoba návratu do sekce u ASSIGN_RESOURCE.
      if (isAtMax || (clickedUnitBody && isBoundaryUnit && unit.resources > 0) || (clickedUnitBody && !isBoundaryUnit && unit.resources > 0 && !canAdd)) {
        const origins = unit.resourceOrigins || [];
        const newThru = { ...throughput[pid] } as any;
        // Za každou kostku se vrací marginální cena, kterou stála: dokud je její
        // sekce nad limitem (průtok > 4), stála ze skladu 2 – vrací se tedy 2,
        // jinak 1. Kostky ubíráme po jedné a průběžně snižujeme průtok, takže
        // se do skladu vrátí přesně to, co bylo za jejich rozdání zaplaceno.
        let refund = 0;
        origins.forEach((o: SectionId) => {
          const t = newThru[o] ?? 0;
          refund += logistics && t > 4 ? 2 : 1;
          if (t > 0) newThru[o] = t - 1;
        });
        if (origins.length === 0) refund = unit.resources; // pojistka pro stav bez evidovaných sekcí
        return {
          ...state,
          centralWarehouse: { ...state.centralWarehouse, [pid]: state.centralWarehouse[pid] + refund },
          sectionThroughput: { ...throughput, [pid]: newThru },
          units: { ...state.units, [unitId]: { ...unit, resources: 0, resourceOrigins: [] } }
        };
      }

      if (canAdd) {
        const newOrigins = [...(unit.resourceOrigins || []), sec as SectionId];
        return {
          ...state,
          undoStack: pushUndo(state, action.clientId),
          centralWarehouse: { ...state.centralWarehouse, [pid]: state.centralWarehouse[pid] - cost },
          sectionThroughput: { ...throughput, [pid]: { ...throughput[pid], [sec!]: throughput[pid][sec!] + 1 } },
          units: { ...state.units, [unitId]: { ...unit, resources: unit.resources + 1, resourceOrigins: newOrigins } }
        };
      }
      return state;
    }

    // -------------------------------------------------- General: advance phase
    case 'NEXT_PHASE': {
      if (!isGeneral(state, action.clientId, active)) return state;
      if (state.phase === 'distribution-sections') {
        // Sloučený režim přeskakuje fázi přidělení jednotkám a jde rovnou na
        // pohyb (zdroje už jsou na jednotkách). Nevyužité zdroje propadají.
        if (action.skipUnitPhase) {
          return { ...state, phase: 'movement', centralWarehouse: { ...state.centralWarehouse, [active]: 0 }, sectionResources: { ...state.sectionResources, [active]: { left: 0, center: 0, right: 0 } }, undoStack: [] };
        }
        return { ...state, phase: 'distribution-units', centralWarehouse: { ...state.centralWarehouse, [active]: 0 }, undoStack: [] };
      }
      if (state.phase === 'distribution-units') {
        return { ...state, phase: 'movement', sectionResources: { ...state.sectionResources, [active]: { left: 0, center: 0, right: 0 } }, undoStack: [] };
      }
      if (state.phase === 'movement') return { ...state, phase: 'attack', undoStack: [] };
      return state;
    }

    // -------------------------------------------------- General: end turn
    case 'END_TURN': {
      if (!isGeneral(state, action.clientId, active)) return state;
      const next: PlayerId = active === 'player1' ? 'player2' : 'player1';
      const newUnits: Record<string, any> = { ...state.units };
      // Nevyužité zdroje na konci tahu propadají – žádný přenos do dalšího
      // tahu (mechanika „ponechaného zdroje jako života navíc" byla ze hry
      // odstraněna).
      Object.keys(newUnits).forEach(id => {
        newUnits[id] = { ...newUnits[id], resources: 0, resourceOrigins: [], hasMoved: false, hasAttacked: false, movementUsed: 0, hasOverrun: false, overrunReady: false };
      });
      const { nVP, newGrid: updatedGrid } = checkObjectives(state.grid, newUnits, next, 'startOfTurn', state.currentTurn, state.victoryPoints);
      return {
        ...state,
        activePlayerId: next,
        phase: 'distribution-sections',
        currentTurn: active === 'player2' ? state.currentTurn + 1 : state.currentTurn,
        centralWarehouse: { ...state.centralWarehouse, [next]: state.scenario[next].income },
        sectionThroughput: { player1: { left: 0, center: 0, right: 0 }, player2: { left: 0, center: 0, right: 0 } },
        units: newUnits,
        grid: updatedGrid,
        victoryPoints: nVP,
        pendingCombat: null, pendingRetreat: null, pendingTakeGround: null,
        undoStack: [],
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

      const isAtMax = unit.resources >= 2;
      const clickedUnitBody = !sectionId;
      const sections = getUnitSections((hex as any).q, (hex as any).r, state.scenario);
      const isBoundaryUnit = sections.length > 1;

      // Explicitně zadaná sekce musí být jednou ze sekcí jednotky – UI nabízí
      // jen platné, ale reducer je jediná autorita (AI, podvržený klient).
      if (sectionId && !sections.includes(sectionId)) return state;
      let sec = sectionId;
      if (!sec && !isBoundaryUnit) sec = sections[0];

      const canAdd = !!sec && state.sectionResources[active][sec] > 0 && unit.resources < 2;

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
        // Fáze se po rozdání posledního zdroje neposouvá automaticky – hráč ji
        // ukončí tlačítkem (NEXT_PHASE), aby mohl rozdělení ještě přeskládat.
        return {
          ...state,
          sectionResources: { ...state.sectionResources, [active]: newSecRes },
          units: { ...state.units, [unitId]: { ...unit, resources: unit.resources + 1, resourceOrigins: newOrigins } }
        };
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
      const utype = unitTypes.find(ut => ut.id === unit.typeId);
      if (!utype) return state;
      const remaining = utype.movement - unit.movementUsed;
      if (remaining <= 0) return state;

      // Cíl musí být dosažitelný legální cestou. BFS respektuje neprůchodný
      // terén, obsazená pole, „stop" terén i vstup/výstup pouze na vedlejší
      // pole – jde o tutéž množinu, kterou UI zvýrazňuje jako dosažitelnou.
      // Vzdálenost se účtuje podle skutečné cesty (např. obejití řeky), ne
      // vzdušnou čarou.
      const moveCategory = categoryOf(utype);
      const distances = getReachableDistances((fHex as any).q, (fHex as any).r, remaining, state.grid, terrainTypes, overlayTypes, { unitCategory: moveCategory, ownerId: unit.ownerId });
      const dist = distances[`${tq},${tr}`];
      if (dist === undefined) return state;

      const fTerrain = terrainTypes.find(t => t.id === (fHex as any)?.terrainTypeId);
      const fOverlay = overlayTypes.find(o => o.id === (fHex as any)?.overlayTypeId);
      // Výstup z výchozího pole jen na vedlejší pole spotřebuje veškerý pohyb.
      const exitAdjacentOnly = !!(fTerrain?.exitToAdjacentOnly || fOverlay?.exitToAdjacentOnly);

      // All checks passed – snapshot before applying so the move can be undone
      // while the movement phase is still open.
      const undoStack = pushUndo(state, action.clientId);

      // Hexy se klonují (nikdy nemutují) – stejné objekty sdílí předchozí stav
      // i undo snapshoty a reducer musí zůstat čistý.
      const nGrid = { ...state.grid } as any;
      const fromKey = `${(fHex as any).q},${(fHex as any).r}`;
      const targetKey = `${tq},${tr}`;
      const fromHex = { ...nGrid[fromKey], unitId: undefined };
      if (fromHex.overlayTypeId === 'sandbags') fromHex.overlayTypeId = undefined;
      nGrid[fromKey] = fromHex;
      const targetHex = { ...nGrid[targetKey], unitId: uid };

      const totalDist = unit.movementUsed + dist;
      const newResources = unit.hasMoved ? unit.resources : unit.resources - 1;
      const targetTerrain = terrainTypes.find(t => t.id === targetHex?.terrainTypeId);
      const targetOverlay = overlayTypes.find(o => o.id === targetHex?.overlayTypeId);
      const targetOverlayId = targetHex?.overlayTypeId;

      let isStopTerrain = targetTerrain?.movementRestriction === 'stop' || targetOverlay?.movementRestriction === 'stop' || targetOverlayId === 'wire';
      // Po zastavení lze útočit, pokud to dovolí terén (brod) nebo překážka.
      let allowAttackAfterStop = !!(targetTerrain?.allowAttackAfterStop || targetOverlay?.allowAttackAfterStop);
      if (targetOverlayId === 'wire') {
        allowAttackAfterStop = true;
        if (utype.category === 'tank') targetHex.overlayTypeId = undefined;
      }
      nGrid[targetKey] = targetHex;
      // Výstup z výchozího pole jen na vedlejší pole spotřebuje veškerý pohyb
      // (po vystoupení už nelze pokračovat), neovlivňuje však možnost útoku.
      const finalMovementUsed = (isStopTerrain || exitAdjacentOnly) ? utype.movement : totalDist;
      const hasAttacked = (isStopTerrain && !allowAttackAfterStop) || (totalDist > utype.canShootAfterMovingMax ? true : unit.hasAttacked);

      const newStats = { ...state.unitStats } as any;
      newStats[uid] = { ...newStats[uid], distanceTraveled: newStats[uid].distanceTraveled + dist };
      const { nVP, newGrid: updatedGrid } = checkObjectives(nGrid, state.units, active, 'immediate', state.currentTurn, state.victoryPoints);

      const newUnits = { ...state.units, [uid]: { ...unit, resources: newResources, hasMoved: true, movementUsed: finalMovementUsed, hasAttacked } };
      return { ...state, grid: updatedGrid, units: newUnits, victoryPoints: nVP, unitStats: newStats, undoStack, winner: computeWinner(state.scenario, newUnits, nVP) };
    }

    // -------------------------------------------------- Commander: attack
    case 'ATTACK': {
      const { attackerId: aid, targetId: tid } = action;
      const att = state.units[aid];
      const tar = state.units[tid];
      // Armor Overrun: bonusový útok zdarma (nevyžaduje ani nespotřebovává zdroj
      // a obchází jednorázový limit útoku za tah).
      const isOverrunAttack = !!att.overrunReady;
      if (state.phase !== 'attack' || !att || !tar || att.ownerId !== active) return state;
      if (!isOverrunAttack && (att.resources <= 0 || att.hasAttacked)) return state;
      if (hasPendingCombat(state)) return state;
      if (!controlsUnit(state, action.clientId, aid)) return state;

      const utype = unitTypes.find(u => u.id === att.typeId);
      if (!utype) return state;
      const attCategory = categoryOf(utype);
      if (attCategory === 'artillery' && (att.movementUsed > 0 || att.hasMoved)) return state;

      const fromHex = unitHex(state, aid);
      const targetHex = unitHex(state, tid);
      if (!fromHex || !targetHex) return state;
      const targetable = getTargetableUnits((fromHex as any).q, (fromHex as any).r, utype, state, terrainTypes, overlayTypes);
      if (!targetable.includes(tid)) return state;

      const dist = getDistance(fromHex, targetHex);
      const targetTerrain = getTerrainAt((targetHex as any).q, (targetHex as any).r);
      const targetOverlay = getOverlayAt((targetHex as any).q, (targetHex as any).r);
      const isArtillery = attCategory === 'artillery';
      const dC = getDiceCount(att, tar, fromHex, targetHex, state.grid, terrainTypes, overlayTypes, utype);

      let ignoreFlags = 0;
      if (!isArtillery) ignoreFlags = Math.max(targetTerrain.ignoreFlags ?? 0, targetOverlay?.ignoreFlags ?? 0);

      const dice = rollDice(dC, action.seed);
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
      if (!targetStats.attackers.includes(att.typeId)) targetStats.attackers = [...targetStats.attackers, att.typeId];

      // Zásahy odebírají figurky (zdroje zásahy nepohlcují – bránící se
      // jednotka je stejně nemá, na konci tahu propadají).
      upT.figures -= h;

      let pendingRetreat: any = null;
      let pendingTakeGround: any = null;
      let isEliminated = false;
      if (upT.figures <= 0) {
        attackerStats.kills += 1;
        targetStats.destroyedInRound = state.currentTurn;
        delete nU[tid];
        const tKey = `${(targetHex as any).q},${(targetHex as any).r}`;
        const clearedHex = { ...nG[tKey], unitId: undefined };
        if (clearedHex.overlayTypeId === 'sandbags') clearedHex.overlayTypeId = undefined;
        nG[tKey] = clearedHex;
        nVP[att.ownerId].push({ id: `kill-${tid}-${state.currentTurn}`, type: 'unit', round: state.currentTurn, unitStats: targetStats });
        isEliminated = true;
      } else {
        nU[tid] = upT;
      }
      nU[aid] = { ...nU[aid], resources: isOverrunAttack ? nU[aid].resources : nU[aid].resources - 1, hasAttacked: true, overrunReady: false };
      // Obrněná jednotka dostane overrun jen jednou za tah; bonusový útok sám už
      // další overrun neuděluje (hasOverrun je v tu chvíli true).
      const grantsOverrun = dist === 1 && attCategory === 'tank' && !nU[aid].hasOverrun;

      if (isEliminated) {
        const { nVP: updatedVP, newGrid: updatedGrid } = checkObjectives(nG, nU, active, 'immediate', state.currentTurn, { player1: nVP.player1, player2: nVP.player2 });
        nG = updatedGrid;
        nVP = updatedVP;
        if (dist === 1 && attCategory !== 'artillery') pendingTakeGround = { unitId: aid, hex: { q: (targetHex as any).q, r: (targetHex as any).r }, overrun: grantsOverrun };
      } else if (finalFlags > 0) {
        // Ústup zakazuje překážka (bunkr pro dělostřelectvo) i terén (moře).
        const noRetreat = targetOverlay?.noRetreatCategories?.includes(targetCategory)
          || targetTerrain?.noRetreatCategories?.includes(targetCategory);
        if (noRetreat) {
          // Instead of a pending retreat, resolve flags as hits (stay and fight/take damage).
          for (let i = 0; i < finalFlags; i++) {
             upT.figures -= 1;
             targetStats.damageTaken += 1;
             if (upT.figures <= 0) {
                attackerStats.kills += 1;
                targetStats.destroyedInRound = state.currentTurn;
                delete nU[tid];
                const tKey = `${(targetHex as any).q},${(targetHex as any).r}`;
                const clearedHex = { ...nG[tKey], unitId: undefined };
                if (clearedHex.overlayTypeId === 'sandbags') clearedHex.overlayTypeId = undefined;
                nG[tKey] = clearedHex;
                nVP[att.ownerId].push({ id: `kill-${tid}-${state.currentTurn}`, type: 'unit', round: state.currentTurn, unitStats: targetStats });
                const { nVP: updatedVP, newGrid: updatedGrid } = checkObjectives(nG, nU, active, 'immediate', state.currentTurn, { player1: nVP.player1, player2: nVP.player2 });
                nG = updatedGrid;
                nVP = updatedVP;
                isEliminated = true;
                if (dist === 1 && attCategory !== 'artillery') pendingTakeGround = { unitId: aid, hex: { q: (targetHex as any).q, r: (targetHex as any).r }, overrun: grantsOverrun };
                break;
             }
          }
          if (!isEliminated) nU[tid] = upT;
        } else {
          pendingRetreat = { unitId: tid, count: finalFlags, attackerId: aid, targetHex: { q: (targetHex as any).q, r: (targetHex as any).r } };
        }
      }
      nStats[aid] = attackerStats;
      nStats[tid] = targetStats;

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
      const key = `${(hex as any).q},${(hex as any).r}`;
      nG[key] = { ...nG[key], overlayTypeId: undefined };
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
        u.figures -= 1;
        let nG = { ...state.grid } as any;
        let died = false;
        if (u.figures <= 0) {
          uStats.destroyedInRound = state.currentTurn;
          delete nU[uid];
          const fKey = `${(fH as any).q},${(fH as any).r}`;
          const clearedHex = { ...nG[fKey], unitId: undefined };
          if (clearedHex.overlayTypeId === 'sandbags') clearedHex.overlayTypeId = undefined;
          nG[fKey] = clearedHex;
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
            pendingTakeGround = { unitId: pr.attackerId, hex: pr.targetHex, overrun: category === 'tank' && !att.hasOverrun };
          }
        } else {
          pendingRetreat = { ...pr, count: pr.count - 1 };
        }

        return { ...state, units: nU, grid: updatedGrid, victoryPoints: finalVP, unitStats: nStats, pendingRetreat, pendingTakeGround, winner: computeWinner(state.scenario, nU, finalVP) };
      }

      // Retreat into a neighbouring hex (must move backwards relative to owner).
      if (getDistance(fH, { q: tq, r: tr }) !== 1 || state.grid[`${tq},${tr}`]?.unitId) return state;
      if (unit.ownerId === 'player1' ? tr <= (fH as any).r : tr >= (fH as any).r) return state;
      // Ústup do neprůchodného terénu (řeka, terén zakázaný pro danou kategorii
      // jednotky či stranu) ani na pole se zákazem ústupu (moře) není povolen.
      const retreatType = unitTypes.find(ut => ut.id === unit.typeId);
      if (isImpassableForUnit(state.grid[`${tq},${tr}`], terrainTypes, overlayTypes, categoryOf(retreatType), unit.ownerId)) return state;
      if (blocksRetreatInto(state.grid[`${tq},${tr}`], terrainTypes, overlayTypes)) return state;

      const nG = { ...state.grid } as any;
      const fromKey = `${(fH as any).q},${(fH as any).r}`;
      const fromHex = { ...nG[fromKey], unitId: undefined };
      if (fromHex.overlayTypeId === 'sandbags') fromHex.overlayTypeId = undefined;
      nG[fromKey] = fromHex;
      nG[`${tq},${tr}`] = { ...nG[`${tq},${tr}`], unitId: uid };
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
          pendingTakeGround = { unitId: pr.attackerId, hex: pr.targetHex, overrun: category === 'tank' && !att.hasOverrun };
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
      const fromKey = `${(fH as any).q},${(fH as any).r}`;
      const fromHex = { ...nG[fromKey], unitId: undefined };
      if (fromHex.overlayTypeId === 'sandbags') fromHex.overlayTypeId = undefined;
      nG[fromKey] = fromHex;
      nG[`${q},${r}`] = { ...nG[`${q},${r}`], unitId: uid };
      const nStats = { ...state.unitStats } as any;
      if (nStats[uid]) nStats[uid] = { ...nStats[uid], distanceTraveled: nStats[uid].distanceTraveled + 1 };
      // Armor Overrun: obsazení pole po úspěšném close assaultu obrněnou jednotkou
      // jí nabídne ještě jeden bonusový útok (jen jednou za tah – hasOverrun).
      const nUnits = tg.overrun
        ? { ...state.units, [uid]: { ...state.units[uid], overrunReady: true, hasOverrun: true } }
        : state.units;
      const { nVP, newGrid: updatedGrid } = checkObjectives(nG, nUnits, active, 'immediate', state.currentTurn, state.victoryPoints);
      return { ...state, units: nUnits, grid: updatedGrid, victoryPoints: nVP, unitStats: nStats, pendingTakeGround: null, winner: computeWinner(state.scenario, nUnits, nVP) };
    }

    case 'CANCEL_TAKE_GROUND': {
      if (!state.pendingTakeGround) return state;
      if (!controlsUnit(state, action.clientId, state.pendingTakeGround.unitId)) return state;
      return { ...state, pendingTakeGround: null };
    }

    // -------------------------------------------------- Undo last reversible action
    // Reverts the most recent DISTRIBUTE / MOVE while the phase is still open.
    // Attacks are intentionally not reversible (they involve a dice roll).
    case 'UNDO': {
      const stack = state.undoStack || [];
      if (stack.length === 0) return state;
      const top = stack[stack.length - 1];
      // Only undo within the same (still open) phase.
      if (top.phase !== state.phase) return state;
      // No undoing while a combat / retreat / take-ground is unresolved.
      if (hasPendingCombat(state)) return state;
      // Must be on the active team; section distribution is the general's job.
      if (!onTeam(state, action.clientId, active)) return state;
      if (state.phase === 'distribution-sections' && !isGeneral(state, action.clientId, active)) return state;
      return {
        ...state,
        units: top.units,
        grid: top.grid,
        unitStats: top.unitStats,
        victoryPoints: top.victoryPoints,
        sectionResources: top.sectionResources,
        centralWarehouse: top.centralWarehouse,
        sectionThroughput: top.sectionThroughput,
        undoStack: stack.slice(0, -1),
        winner: computeWinner(state.scenario, top.units, top.victoryPoints)
      };
    }

    default:
      return state;
  }
}
