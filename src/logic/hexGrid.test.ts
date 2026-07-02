import { describe, it, expect } from 'vitest';
import { getDistance, getReachableDistances, getReachableHexes, checkLOS, getDiceCount, isImpassableForUnit, getUnitSections } from './hexGrid';
import { rules, hexEntry, makeScenario } from './testUtils';
import { createInitialGameState } from './gameReducer';

const { terrainTypes, overlayTypes, unitTypes } = rules;

// Prázdná mřížka 9×9 s volitelnými úpravami polí.
function makeGrid(hexes: any[] = []) {
  return createInitialGameState(makeScenario(hexes, [])).grid as any;
}

describe('getDistance', () => {
  it('hexová vzdálenost', () => {
    expect(getDistance({ q: 0, r: 0 }, { q: 0, r: 0 })).toBe(0);
    expect(getDistance({ q: 0, r: 0 }, { q: 1, r: 0 })).toBe(1);
    expect(getDistance({ q: 0, r: 0 }, { q: 0, r: 2 })).toBe(2);
    expect(getDistance({ q: 0, r: 0 }, { q: 2, r: -2 })).toBe(2);
  });
});

describe('getReachableDistances', () => {
  it('vrací délky nejkratších cest', () => {
    const grid = makeGrid();
    const d = getReachableDistances(0, 0, 2, grid, terrainTypes, overlayTypes);
    expect(d['1,0']).toBe(1);
    expect(d['0,1']).toBe(1);
    expect(d['2,0']).toBe(2);
    expect(d['0,0']).toBeUndefined(); // výchozí pole není v mapě
    expect(d['3,0']).toBeUndefined(); // za limitem pohybu
  });

  it('vynechává neprůchodná a obsazená pole; obklíčená jednotka nemá kam jít', () => {
    // (0,0) má v mřížce jen dva sousedy: (1,0) obsadíme, (0,1) je řeka.
    const grid = makeGrid([hexEntry(0, 1, 'river'), hexEntry(1, 0, 'grass', { unitId: 'x' })]);
    const d = getReachableDistances(0, 0, 2, grid, terrainTypes, overlayTypes);
    expect(d['0,1']).toBeUndefined(); // řeka
    expect(d['1,0']).toBeUndefined(); // obsazeno
    expect(Object.keys(d)).toHaveLength(0); // žádná cesta ven
  });

  it('"stop" terén lze vstoupit, ale ne projít', () => {
    const grid = makeGrid([hexEntry(0, 1, 'forest')]);
    const d = getReachableDistances(0, 0, 3, grid, terrainTypes, overlayTypes);
    expect(d['0,1']).toBe(1); // do lesa ano
    // pole za lesem je dosažitelné jen delší cestou okolo, ne skrz les
    expect(d['0,2']).toBeGreaterThan(2);
  });

  it('respektuje neprůchodnost podle kategorie jednotky', () => {
    const customTerrains = [...terrainTypes, { id: 'swamp', name: 'Bažina', blocksLOS: false, impassableForCategories: ['tank'], diceModifierDefenseInfantry: 0, diceModifierDefenseTank: 0, diceModifierAttackInfantry: 0, diceModifierAttackTank: 0 }];
    const grid = makeGrid([hexEntry(0, 1, 'swamp')]);
    const tank = getReachableDistances(0, 0, 1, grid, customTerrains, overlayTypes, { unitCategory: 'tank' });
    const inf = getReachableDistances(0, 0, 1, grid, customTerrains, overlayTypes, { unitCategory: 'infantry' });
    expect(tank['0,1']).toBeUndefined();
    expect(inf['0,1']).toBe(1);
  });

  it('getReachableHexes vrací tytéž klíče', () => {
    const grid = makeGrid([hexEntry(0, 1, 'river')]);
    const d = getReachableDistances(0, 0, 2, grid, terrainTypes, overlayTypes);
    const keys = getReachableHexes(0, 0, 2, grid, terrainTypes, overlayTypes);
    expect(new Set(keys)).toEqual(new Set(Object.keys(d)));
  });
});

describe('checkLOS', () => {
  it('sousední pole vždy vidí', () => {
    const grid = makeGrid([hexEntry(0, 1, 'forest')]);
    expect(checkLOS({ q: 0, r: 0 }, { q: 0, r: 1 }, grid, terrainTypes, overlayTypes)).toBe(true);
  });

  it('les v přímé linii blokuje výhled, volná trasa ne', () => {
    expect(checkLOS({ q: 0, r: 0 }, { q: 0, r: 2 }, makeGrid([hexEntry(0, 1, 'forest')]), terrainTypes, overlayTypes)).toBe(false);
    expect(checkLOS({ q: 0, r: 0 }, { q: 0, r: 2 }, makeGrid(), terrainTypes, overlayTypes)).toBe(true);
  });
});

describe('getDiceCount', () => {
  const infantry = unitTypes.find(u => u.id === 'infantry');
  const att = { typeId: 'infantry', ownerId: 'player1' };
  const def = { typeId: 'infantry', ownerId: 'player2' };

  it('počet kostek podle vzdálenosti (dostřel pěchoty 3/2/1)', () => {
    const grid = makeGrid();
    expect(getDiceCount(att, def, grid['0,0'], grid['0,1'], grid, terrainTypes, overlayTypes, infantry)).toBe(3);
    expect(getDiceCount(att, def, grid['0,0'], grid['0,2'], grid, terrainTypes, overlayTypes, infantry)).toBe(2);
    expect(getDiceCount(att, def, grid['0,0'], grid['0,3'], grid, terrainTypes, overlayTypes, infantry)).toBe(1);
    expect(getDiceCount(att, def, grid['0,0'], grid['0,4'], grid, terrainTypes, overlayTypes, infantry)).toBe(0);
  });

  it('terén obránce snižuje počet kostek (les: pěchota -1)', () => {
    const grid = makeGrid([hexEntry(0, 1, 'forest')]);
    expect(getDiceCount(att, def, grid['0,0'], grid['0,1'], grid, terrainTypes, overlayTypes, infantry)).toBe(2);
  });
});

describe('isImpassableForUnit / getUnitSections', () => {
  it('řeka je neprůchozí pro všechny', () => {
    const grid = makeGrid([hexEntry(0, 1, 'river')]);
    expect(isImpassableForUnit(grid['0,1'], terrainTypes, overlayTypes, 'infantry', 'player1')).toBe(true);
    expect(isImpassableForUnit(grid['0,0'], terrainTypes, overlayTypes, 'infantry', 'player1')).toBe(false);
  });

  it('jednotka na hranici sekcí (lichý řádek) patří do obou', () => {
    const scenario = makeScenario();
    expect(getUnitSections(0, 0, scenario)).toEqual(['left']);   // sloupec 0, sudý řádek
    expect(getUnitSections(2, 1, scenario)).toEqual(['left', 'center']); // lichý řádek, sloupec 2 = hranice
    expect(getUnitSections(4, 0, scenario)).toEqual(['center']);
  });
});
