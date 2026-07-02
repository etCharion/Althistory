// Sdílené pomůcky pro testy herní logiky.
import { createInitialGameState } from './gameReducer';
import type { Rules } from './gameReducer';
import { rollDice } from './dice';
import { DEFAULT_UNIT_TYPES, DEFAULT_TERRAIN_TYPES, DEFAULT_OVERLAY_TYPES } from '../data/defaults';
import type { GameState, GamePhase } from '../types/game';

export const rules: Rules = {
  unitTypes: DEFAULT_UNIT_TYPES as any[],
  terrainTypes: DEFAULT_TERRAIN_TYPES as any[],
  overlayTypes: DEFAULT_OVERLAY_TYPES as any[],
};

// Pole mřížky pro `initialHexes` scénáře.
export function hexEntry(q: number, r: number, terrainTypeId = 'grass', extra: any = {}) {
  return { q, r, s: -q - r, terrainTypeId, ...extra };
}

export function unitEntry(id: string, typeId: string, ownerId: 'player1' | 'player2', opts: any = {}) {
  return { id, typeId, ownerId, figures: opts.figures ?? 4, resources: opts.resources ?? 0, hasMoved: false, hasAttacked: false, movementUsed: 0, ...opts };
}

// Testovací scénář 9×9 se sekcemi 3/3/3.
export function makeScenario(initialHexes: any[] = [], initialUnits: any[] = [], overrides: any = {}) {
  return {
    id: 'test', name: 'Test', description: '',
    boardWidth: 9, boardHeight: 9,
    sections: { leftWidth: 3, centerWidth: 3, rightWidth: 3 },
    player1: { name: 'P1', income: 6, maxSectionResources: 12 },
    player2: { name: 'P2', income: 6, maxSectionResources: 12 },
    victoryPointsToWin: 6, firstPlayerId: 'player1',
    initialHexes, initialUnits,
    isRealBattle: false, year: 1944,
    ...overrides,
  };
}

// Postaví stav hry a přepne ho rovnou do požadované fáze (bez průchodu
// distribucí – testy distribučních fází startují z výchozího stavu).
export function buildState(opts: {
  hexes?: any[]; units?: any[]; phase?: GamePhase; scenario?: any; seats?: any;
} = {}): GameState {
  const scenario = makeScenario(opts.hexes || [], opts.units || [], opts.scenario || {});
  const s: any = createInitialGameState(scenario, { online: !!opts.seats });
  if (opts.seats) s.seats = opts.seats;
  if (opts.phase) s.phase = opts.phase;
  return s;
}

// Rekurzivní zmrazení – každá mutace stavu v reduceru pak vyhodí TypeError.
export function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    Object.values(o as any).forEach(deepFreeze);
  }
  return o;
}

// Najde seed, jehož hod `count` kostkami splní predikát – testy soubojů tak
// nezávisí na konkrétní implementaci PRNG.
export function findSeed(count: number, pred: (dice: string[]) => boolean): number {
  for (let seed = 0; seed < 200000; seed++) {
    if (pred(rollDice(count, seed))) return seed;
  }
  throw new Error('Nenalezen seed splňující podmínku');
}

// Počty zásahů/vlajek proti dané kategorii cíle (stejná logika jako reducer).
export function countHits(dice: string[], targetCategory: string) {
  return dice.filter(d => d === 'grenade' || d === targetCategory).length;
}
export function countFlags(dice: string[]) {
  return dice.filter(d => d === 'flag').length;
}
