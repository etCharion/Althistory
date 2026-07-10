import { describe, it, expect } from 'vitest';
import { getDistance, getReachableDistances, getReachableHexes, checkLOS, getDiceCount, isImpassableForUnit, getUnitSections, getTargetableUnits, blocksRetreatInto } from './hexGrid';
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

  it('cesta: start, jízda i cíl na cestě = pohyb +1; mimo cestu bonus neplatí', () => {
    // Souvislá cesta (0,0)→(0,3); jednotka s pohybem 2 dojede po cestě až na
    // (0,3) (vzdálenost 3), ale na pole mimo cestu ve vzdálenosti 3 nedosáhne.
    const grid = makeGrid([hexEntry(0, 0, 'road'), hexEntry(0, 1, 'road'), hexEntry(0, 2, 'road'), hexEntry(0, 3, 'road')]);
    const d = getReachableDistances(0, 0, 2, grid, terrainTypes, overlayTypes);
    expect(d['0,3']).toBe(3); // po cestě s bonusem
    expect(d['1,1']).toBe(2); // běžné pole v základním limitu
    expect(d['1,2']).toBeUndefined(); // pole mimo cestu ve vzdálenosti 3 – bez bonusu
  });

  it('cesta: bez startu na cestě bonus neplatí', () => {
    const grid = makeGrid([hexEntry(0, 1, 'road'), hexEntry(0, 2, 'road'), hexEntry(0, 3, 'road')]);
    const d = getReachableDistances(0, 0, 2, grid, terrainTypes, overlayTypes);
    expect(d['0,3']).toBeUndefined(); // start na trávě → jen 2 pole
    expect(d['0,2']).toBe(2);
  });

  it('pláž: trasa přes pláž omezuje celkový pohyb na 2', () => {
    // Pás pláže: jednotka s pohybem 4 se přes pláž dál než na 2 pole
    // nedostane, ale delší cestou po trávě mimo pláž ano.
    const grid = makeGrid([hexEntry(0, 1, 'beach'), hexEntry(0, 2, 'beach')]);
    const d = getReachableDistances(0, 0, 4, grid, terrainTypes, overlayTypes);
    expect(d['0,1']).toBe(1);
    expect(d['0,2']).toBe(2);
    expect(d['0,3']).toBe(4); // přes pláž by to byly 3 kroky (nad strop 2) – jen oklikou po trávě
    // Celá deska z pláže: start na pláži počítá strop od začátku.
    const beachGrid = makeGrid([hexEntry(0, 0, 'beach'), hexEntry(0, 1, 'beach'), hexEntry(0, 2, 'beach'), hexEntry(0, 3, 'beach'), hexEntry(1, 2, 'beach'), hexEntry(1, 1, 'beach'), hexEntry(2, 1, 'beach'), hexEntry(1, 0, 'beach'), hexEntry(2, 0, 'beach'), hexEntry(3, 0, 'beach')]);
    const b = getReachableDistances(0, 0, 3, beachGrid, terrainTypes, overlayTypes);
    expect(b['0,2']).toBe(2);
    expect(b['0,3']).toBeUndefined(); // strop 2 platí od startu na pláži
  });

  it('moře: jednotka začínající na moři se pohne jen o 1 pole', () => {
    const grid = makeGrid([hexEntry(0, 0, 'sea'), hexEntry(0, 1, 'sea'), hexEntry(0, 2, 'sea')]);
    const d = getReachableDistances(0, 0, 3, grid, terrainTypes, overlayTypes);
    expect(d['0,1']).toBe(1);
    expect(d['0,2']).toBeUndefined();
    expect(d['1,0']).toBe(1); // i na břeh, ale jen o jedno pole
  });

  it('brod: vstup zastaví pohyb (stop terén)', () => {
    const grid = makeGrid([hexEntry(0, 1, 'ford')]);
    const d = getReachableDistances(0, 0, 3, grid, terrainTypes, overlayTypes);
    expect(d['0,1']).toBe(1);
    expect(d['0,2']).toBeGreaterThan(2); // skrz brod projet nelze, jen oklikou
  });

  it('hory: neprůchodné pro tank a dělostřelectvo, pěchota vstoupí a zastaví', () => {
    const grid = makeGrid([hexEntry(0, 1, 'mountain')]);
    expect(getReachableDistances(0, 0, 2, grid, terrainTypes, overlayTypes, { unitCategory: 'tank' })['0,1']).toBeUndefined();
    expect(getReachableDistances(0, 0, 2, grid, terrainTypes, overlayTypes, { unitCategory: 'artillery' })['0,1']).toBeUndefined();
    const inf = getReachableDistances(0, 0, 3, grid, terrainTypes, overlayTypes, { unitCategory: 'infantry' });
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

  it('brod: útok z brodu -1 kostka (pěchota, tank i dělostřelectvo)', () => {
    const grid = makeGrid([hexEntry(0, 0, 'ford')]);
    const tank = unitTypes.find(u => u.id === 'tank');
    const artillery = unitTypes.find(u => u.id === 'artillery');
    expect(getDiceCount(att, def, grid['0,0'], grid['0,1'], grid, terrainTypes, overlayTypes, infantry)).toBe(2);
    expect(getDiceCount({ ...att, typeId: 'tank' }, def, grid['0,0'], grid['0,1'], grid, terrainTypes, overlayTypes, tank)).toBe(2);
    expect(getDiceCount({ ...att, typeId: 'artillery' }, def, grid['0,0'], grid['0,1'], grid, terrainTypes, overlayTypes, artillery)).toBe(2);
  });

  it('hory: útok na jednotku v horách -2 kostky; na společném hřebenu postih neplatí', () => {
    const up = makeGrid([hexEntry(0, 1, 'mountain')]);
    expect(getDiceCount(att, def, up['0,0'], up['0,1'], up, terrainTypes, overlayTypes, infantry)).toBe(1);
    const ridge = makeGrid([hexEntry(0, 0, 'mountain'), hexEntry(0, 1, 'mountain')]);
    expect(getDiceCount(att, def, ridge['0,0'], ridge['0,1'], ridge, terrainTypes, overlayTypes, infantry)).toBe(3);
  });

  it('hory: souvislý hřeben si neblokuje výhled, oddělená hora ano', () => {
    const ridge = makeGrid([hexEntry(0, 0, 'mountain'), hexEntry(0, 1, 'mountain'), hexEntry(0, 2, 'mountain')]);
    expect(checkLOS({ q: 0, r: 0 }, { q: 0, r: 2 }, ridge, terrainTypes, overlayTypes)).toBe(true);
    // Hora v linii mezi dvěma poli na trávě výhled blokuje.
    const wall = makeGrid([hexEntry(0, 1, 'mountain')]);
    expect(checkLOS({ q: 0, r: 0 }, { q: 0, r: 2 }, wall, terrainTypes, overlayTypes)).toBe(false);
  });
});

describe('moře (sea)', () => {
  it('z moře nelze útočit (getTargetableUnits je prázdné)', () => {
    const infantry = unitTypes.find(u => u.id === 'infantry');
    const state: any = {
      grid: makeGrid([hexEntry(0, 0, 'sea', { unitId: 'a1' }), hexEntry(0, 1, 'grass', { unitId: 'd1' })]),
      units: {
        a1: { id: 'a1', typeId: 'infantry', ownerId: 'player1' },
        d1: { id: 'd1', typeId: 'infantry', ownerId: 'player2' },
      },
    };
    expect(getTargetableUnits(0, 0, infantry, state, terrainTypes, overlayTypes)).toEqual([]);
    // Tatáž situace na trávě cíl nabídne – kontrola, že blokuje právě moře.
    const landState = { ...state, grid: makeGrid([hexEntry(0, 0, 'grass', { unitId: 'a1' }), hexEntry(0, 1, 'grass', { unitId: 'd1' })]) };
    expect(getTargetableUnits(0, 0, infantry, landState, terrainTypes, overlayTypes)).toEqual(['d1']);
  });

  it('na moře nelze ustoupit (blocksRetreatInto)', () => {
    const grid = makeGrid([hexEntry(0, 1, 'sea')]);
    expect(blocksRetreatInto(grid['0,1'], terrainTypes, overlayTypes)).toBe(true);
    expect(blocksRetreatInto(grid['0,0'], terrainTypes, overlayTypes)).toBe(false);
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
