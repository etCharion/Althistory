import { describe, it, expect } from 'vitest';
import { reducer } from './gameReducer';
import { rollDice } from './dice';
import { rules, hexEntry, unitEntry, buildState, deepFreeze, findSeed, countHits, countFlags } from './testUtils';

const local = (a: any) => ({ clientId: 'local', ...a });

describe('DISTRIBUTE (fáze A – zdroje do sekcí)', () => {
  it('přesune zdroje ze skladu do sekce', () => {
    const s = buildState();
    const after = reducer(s, local({ type: 'DISTRIBUTE', section: 'left', amount: 2 }), rules);
    expect(after.sectionResources.player1.left).toBe(2);
    expect(after.centralWarehouse.player1).toBe(4);
  });

  it('"max" vyprázdní sklad', () => {
    const s = buildState();
    const after = reducer(s, local({ type: 'DISTRIBUTE', section: 'center', amount: 'max' }), rules);
    expect(after.sectionResources.player1.center).toBe(6);
    expect(after.centralWarehouse.player1).toBe(0);
  });

  it('logistické omezení: 5. a další zdroj v sekci stojí 2 ze skladu', () => {
    const s = buildState({ scenario: { logisticsLimit: true } });
    // Sklad 6: první 4 kusy po 1, pátý za 2 => v sekci 5, sklad 0.
    const after = reducer(s, local({ type: 'DISTRIBUTE', section: 'left', amount: 'max' }), rules);
    expect(after.sectionResources.player1.left).toBe(5);
    expect(after.centralWarehouse.player1).toBe(0);
  });

  it('v online hře smí rozdělovat jen generál aktivního týmu', () => {
    const seats = { player1: { general: 'G', left: 'L' }, player2: { general: 'X' } };
    const s = buildState({ seats });
    const byCommander = reducer(s, { type: 'DISTRIBUTE', clientId: 'L', section: 'left', amount: 1 } as any, rules);
    expect(byCommander).toBe(s);
    const byEnemyGeneral = reducer(s, { type: 'DISTRIBUTE', clientId: 'X', section: 'left', amount: 1 } as any, rules);
    expect(byEnemyGeneral).toBe(s);
    const byGeneral = reducer(s, { type: 'DISTRIBUTE', clientId: 'G', section: 'left', amount: 1 } as any, rules);
    expect(byGeneral.sectionResources.player1.left).toBe(1);
  });
});

describe('ASSIGN_RESOURCE (fáze B – zdroje jednotkám)', () => {
  function assignState() {
    let s: any = buildState({
      hexes: [hexEntry(0, 0, 'grass', { unitId: 'u1' })],
      units: [unitEntry('u1', 'infantry', 'player1')],
    });
    s = reducer(s, local({ type: 'DISTRIBUTE', section: 'left', amount: 3 }), rules);
    s = reducer(s, local({ type: 'NEXT_PHASE' }), rules); // -> distribution-units
    return s;
  }

  it('přidělí zdroj ze sekce jednotce, max 2 na jednotku', () => {
    let s = assignState();
    s = reducer(s, local({ type: 'ASSIGN_RESOURCE', unitId: 'u1' }), rules);
    expect(s.units.u1.resources).toBe(1);
    expect(s.sectionResources.player1.left).toBe(2);
    s = reducer(s, local({ type: 'ASSIGN_RESOURCE', unitId: 'u1' }), rules);
    expect(s.units.u1.resources).toBe(2);
    // Třetí klik na plnou jednotku zdroje vrátí do původních sekcí.
    s = reducer(s, local({ type: 'ASSIGN_RESOURCE', unitId: 'u1' }), rules);
    expect(s.units.u1.resources).toBe(0);
    expect(s.sectionResources.player1.left).toBe(3);
  });

  it('odmítne přidělení z cizí sekce (sectionId mimo sekce jednotky)', () => {
    let s = assignState(); // jednotka u1 stojí v levé sekci
    (s.sectionResources as any).player1.right = 2;
    const before = s;
    s = reducer(s, local({ type: 'ASSIGN_RESOURCE', unitId: 'u1', sectionId: 'right' }), rules);
    expect(s).toBe(before); // pravá sekce k jednotce nepatří
    s = reducer(s, local({ type: 'ASSIGN_RESOURCE', unitId: 'u1', sectionId: 'left' }), rules);
    expect(s.units.u1.resources).toBe(1);
  });

  it('po rozdání všech zdrojů zůstává ve fázi rozdělování; do pohybu se jde až tlačítkem', () => {
    let s: any = buildState({
      hexes: [hexEntry(0, 0, 'grass', { unitId: 'u1' })],
      units: [unitEntry('u1', 'infantry', 'player1')],
    });
    s = reducer(s, local({ type: 'DISTRIBUTE', section: 'left', amount: 1 }), rules);
    s = reducer(s, local({ type: 'NEXT_PHASE' }), rules);
    s = reducer(s, local({ type: 'ASSIGN_RESOURCE', unitId: 'u1' }), rules);
    // Žádný automatický přechod – hráč může rozdělení ještě přeskládat.
    expect(s.phase).toBe('distribution-units');
    s = reducer(s, local({ type: 'NEXT_PHASE' }), rules);
    expect(s.phase).toBe('movement');
  });
});

describe('DISTRIBUTE_TO_UNIT (sloučená distribuce)', () => {
  function mergedState(extraScenario: any = {}, hexes?: any[], units?: any[]) {
    return buildState({
      scenario: { mergedDistribution: true, ...extraScenario },
      hexes: hexes || [hexEntry(0, 0, 'grass', { unitId: 'u1' })],
      units: units || [unitEntry('u1', 'infantry', 'player1')],
    });
  }

  it('přesune zdroj ze skladu rovnou na jednotku (sekce jen protéká), max 2', () => {
    let s: any = mergedState();
    s = reducer(deepFreeze(s), local({ type: 'DISTRIBUTE_TO_UNIT', unitId: 'u1' }), rules);
    expect(s.units.u1.resources).toBe(1);
    expect(s.centralWarehouse.player1).toBe(5);
    // Sklad sekce se nenaplní – zdroj jím jen protekl.
    expect(s.sectionResources.player1.left).toBe(0);
    expect(s.sectionThroughput.player1.left).toBe(1);
    s = reducer(s, local({ type: 'DISTRIBUTE_TO_UNIT', unitId: 'u1' }), rules);
    expect(s.units.u1.resources).toBe(2);
    expect(s.centralWarehouse.player1).toBe(4);
    // Třetí klik na plnou jednotku zdroje vrátí do skladu.
    s = reducer(s, local({ type: 'DISTRIBUTE_TO_UNIT', unitId: 'u1' }), rules);
    expect(s.units.u1.resources).toBe(0);
    expect(s.centralWarehouse.player1).toBe(6);
    expect(s.sectionThroughput.player1.left).toBe(0);
  });

  it('bez zapnutého mergedDistribution je akce no-op', () => {
    const s: any = buildState({
      hexes: [hexEntry(0, 0, 'grass', { unitId: 'u1' })],
      units: [unitEntry('u1', 'infantry', 'player1')],
    });
    expect(reducer(s, local({ type: 'DISTRIBUTE_TO_UNIT', unitId: 'u1' }), rules)).toBe(s);
  });

  it('mimo fázi distribuce do sekcí je akce no-op', () => {
    const s: any = mergedState({}, [hexEntry(0, 0, 'grass', { unitId: 'u1' })], [unitEntry('u1', 'infantry', 'player1')]);
    const inUnits = { ...s, phase: 'distribution-units' };
    expect(reducer(inUnits, local({ type: 'DISTRIBUTE_TO_UNIT', unitId: 'u1' }), rules)).toBe(inUnits);
  });

  it('odmítne sekci, která jednotce nepatří', () => {
    const s: any = mergedState();
    expect(reducer(s, local({ type: 'DISTRIBUTE_TO_UNIT', unitId: 'u1', sectionId: 'right' }), rules)).toBe(s);
    const ok = reducer(s, local({ type: 'DISTRIBUTE_TO_UNIT', unitId: 'u1', sectionId: 'left' }), rules);
    expect(ok.units.u1.resources).toBe(1);
  });

  it('logistická přirážka podle průtoku: 5. zdroj protečený sekcí stojí 2', () => {
    let s: any = mergedState(
      { logisticsLimit: true },
      [hexEntry(0, 0, 'grass', { unitId: 'u1' }), hexEntry(1, 0, 'grass', { unitId: 'u2' }), hexEntry(2, 0, 'grass', { unitId: 'u3' })],
      [unitEntry('u1', 'infantry', 'player1'), unitEntry('u2', 'infantry', 'player1'), unitEntry('u3', 'infantry', 'player1')],
    );
    // 4 zdroje po 1 (sklad 6->2), pátý přes tutéž sekci za 2 (sklad 2->0).
    s = reducer(s, local({ type: 'DISTRIBUTE_TO_UNIT', unitId: 'u1' }), rules);
    s = reducer(s, local({ type: 'DISTRIBUTE_TO_UNIT', unitId: 'u1' }), rules);
    s = reducer(s, local({ type: 'DISTRIBUTE_TO_UNIT', unitId: 'u2' }), rules);
    s = reducer(s, local({ type: 'DISTRIBUTE_TO_UNIT', unitId: 'u2' }), rules);
    expect(s.centralWarehouse.player1).toBe(2);
    expect(s.sectionThroughput.player1.left).toBe(4);
    s = reducer(s, local({ type: 'DISTRIBUTE_TO_UNIT', unitId: 'u3' }), rules);
    expect(s.units.u3.resources).toBe(1);
    expect(s.centralWarehouse.player1).toBe(0);
    expect(s.sectionThroughput.player1.left).toBe(5);
  });

  it('lze vrátit tlačítkem Zpět (undo obnoví sklad i průtok)', () => {
    let s: any = mergedState();
    s = reducer(s, local({ type: 'DISTRIBUTE_TO_UNIT', unitId: 'u1' }), rules);
    s = reducer(s, local({ type: 'UNDO' }), rules);
    expect(s.units.u1.resources).toBe(0);
    expect(s.centralWarehouse.player1).toBe(6);
    expect(s.sectionThroughput.player1.left).toBe(0);
  });

  it('online: samostatný generál (1v1) smí, ale s vlastním velitelem sekce ne', () => {
    const hexes = [hexEntry(0, 0, 'grass', { unitId: 'u1' })];
    const units = [unitEntry('u1', 'infantry', 'player1')];
    // 1v1: strana má jen generála -> ovládá všechny sekce, sloučeně smí.
    const solo = buildState({ scenario: { mergedDistribution: true }, hexes, units, seats: { player1: { general: 'G' }, player2: { general: 'X' } } });
    expect(reducer(solo, { type: 'DISTRIBUTE_TO_UNIT', clientId: 'G', unitId: 'u1' } as any, rules).units.u1.resources).toBe(1);
    // S vyhrazeným velitelem levé sekce: generál levou neovládá, velitel není generál -> nikdo sloučeně nesmí.
    const split = buildState({ scenario: { mergedDistribution: true }, hexes, units, seats: { player1: { general: 'G', left: 'L' }, player2: { general: 'X' } } });
    expect(reducer(split, { type: 'DISTRIBUTE_TO_UNIT', clientId: 'G', unitId: 'u1' } as any, rules)).toBe(split);
    expect(reducer(split, { type: 'DISTRIBUTE_TO_UNIT', clientId: 'L', unitId: 'u1' } as any, rules)).toBe(split);
  });

  it('NEXT_PHASE se skipUnitPhase jde ze sekcí rovnou na pohyb', () => {
    const s: any = mergedState();
    const skipped = reducer(s, local({ type: 'NEXT_PHASE', skipUnitPhase: true }), rules);
    expect(skipped.phase).toBe('movement');
    const normal = reducer(s, local({ type: 'NEXT_PHASE' }), rules);
    expect(normal.phase).toBe('distribution-units');
  });
});

describe('MOVE (fáze C – pohyb)', () => {
  it('legální pohyb: stojí 1 zdroj, označí hasMoved, přesune jednotku', () => {
    const s = buildState({
      phase: 'movement',
      hexes: [hexEntry(0, 0, 'grass', { unitId: 'u1' })],
      units: [unitEntry('u1', 'infantry', 'player1', { resources: 2 })],
    });
    const after = reducer(deepFreeze(s), local({ type: 'MOVE', unitId: 'u1', q: 0, r: 1 }), rules);
    expect(after.grid['0,1'].unitId).toBe('u1');
    expect(after.grid['0,0'].unitId).toBeUndefined();
    expect(after.units.u1).toMatchObject({ resources: 1, hasMoved: true, movementUsed: 1 });
  });

  it('bez zdrojů se jednotka nepohne', () => {
    const s = buildState({
      phase: 'movement',
      hexes: [hexEntry(0, 0, 'grass', { unitId: 'u1' })],
      units: [unitEntry('u1', 'infantry', 'player1', { resources: 0 })],
    });
    expect(reducer(s, local({ type: 'MOVE', unitId: 'u1', q: 0, r: 1 }), rules)).toBe(s);
  });

  it('odmítne skok přes řeku (cíl bez legální cesty)', () => {
    // Souvislá řeka na řádku r=3; tank (pohyb 3) na (0,2) míří na (0,4) za ní.
    const river = Array.from({ length: 8 }, (_, col) => hexEntry(col - 1, 3, 'river'));
    const s = buildState({
      phase: 'movement',
      hexes: [...river, hexEntry(0, 2, 'grass', { unitId: 'u1' })],
      units: [unitEntry('u1', 'tank', 'player1', { resources: 2, figures: 3 })],
    });
    expect(reducer(deepFreeze(s), local({ type: 'MOVE', unitId: 'u1', q: 0, r: 4 }), rules)).toBe(s);
  });

  it('odmítne průchod skrz „stop" terén; vstup do něj vyčerpá pohyb', () => {
    // Jediná cesta vede přes les na (0,1) – vše ostatní v řádku 1 je řeka.
    const riverRow = Array.from({ length: 8 }, (_, col) => col).filter(q => q !== 0).map(q => hexEntry(q, 1, 'river'));
    const s = buildState({
      phase: 'movement',
      hexes: [hexEntry(0, 1, 'forest'), ...riverRow, hexEntry(0, 0, 'grass', { unitId: 'u1' })],
      units: [unitEntry('u1', 'tank', 'player1', { resources: 2, figures: 3 })],
    });
    expect(reducer(s, local({ type: 'MOVE', unitId: 'u1', q: 0, r: 2 }), rules)).toBe(s);
    const intoForest = reducer(s, local({ type: 'MOVE', unitId: 'u1', q: 0, r: 1 }), rules);
    expect(intoForest.grid['0,1'].unitId).toBe('u1');
    expect(intoForest.units.u1.movementUsed).toBe(3); // stop => veškerý pohyb spotřebován
  });

  it('účtuje délku skutečné cesty (obejití řeky), ne vzdušnou vzdálenost', () => {
    const s = buildState({
      phase: 'movement',
      hexes: [hexEntry(0, 1, 'river'), hexEntry(0, 0, 'grass', { unitId: 'u1' })],
      units: [unitEntry('u1', 'tank', 'player1', { resources: 2, figures: 3 })],
    });
    const after = reducer(s, local({ type: 'MOVE', unitId: 'u1', q: 0, r: 2 }), rules);
    expect(after.grid['0,2'].unitId).toBe('u1');
    expect(after.units.u1.movementUsed).toBe(3); // vzdušně 2, cestou okolo 3
  });

  it('odmítne pohyb na obsazené pole i skrz jednotky', () => {
    const s = buildState({
      phase: 'movement',
      hexes: [hexEntry(0, 0, 'grass', { unitId: 'u1' }), hexEntry(0, 1, 'grass', { unitId: 'u2' })],
      units: [
        unitEntry('u1', 'infantry', 'player1', { resources: 2 }),
        unitEntry('u2', 'infantry', 'player2'),
      ],
    });
    expect(reducer(s, local({ type: 'MOVE', unitId: 'u1', q: 0, r: 1 }), rules)).toBe(s);
  });

  it('opuštění pole s pytli s pískem je odstraní', () => {
    const s = buildState({
      phase: 'movement',
      hexes: [hexEntry(0, 0, 'grass', { unitId: 'u1', overlayTypeId: 'sandbags' })],
      units: [unitEntry('u1', 'infantry', 'player1', { resources: 2 })],
    });
    const after = reducer(s, local({ type: 'MOVE', unitId: 'u1', q: 0, r: 1 }), rules);
    expect(after.grid['0,0'].overlayTypeId).toBeUndefined();
  });

  it('tank vjezdem zničí ostnatý drát; pěchotě drát zůstane a zastaví ji', () => {
    const mk = (typeId: string) => buildState({
      phase: 'movement',
      hexes: [hexEntry(0, 0, 'grass', { unitId: 'u1' }), hexEntry(0, 1, 'grass', { overlayTypeId: 'wire' })],
      units: [unitEntry('u1', typeId, 'player1', { resources: 2, figures: typeId === 'tank' ? 3 : 4 })],
    });
    const tank = reducer(mk('tank'), local({ type: 'MOVE', unitId: 'u1', q: 0, r: 1 }), rules);
    expect(tank.grid['0,1'].overlayTypeId).toBeUndefined();
    const inf = reducer(mk('infantry'), local({ type: 'MOVE', unitId: 'u1', q: 0, r: 1 }), rules);
    expect(inf.grid['0,1'].overlayTypeId).toBe('wire');
    expect(inf.units.u1.movementUsed).toBe(2); // stop => plný pohyb pěchoty
    expect(inf.units.u1.hasAttacked).toBe(false); // po vstupu do drátu lze útočit
  });

  it('obsazení okamžitého objektivu přidělí vítězný bod', () => {
    const s = buildState({
      phase: 'movement',
      hexes: [
        hexEntry(0, 0, 'grass', { unitId: 'u1' }),
        hexEntry(0, 1, 'grass', { objective: { type: 'permanent', timing: 'immediate', points: 1, name: 'Most' } }),
      ],
      units: [unitEntry('u1', 'infantry', 'player1', { resources: 2 })],
    });
    const after = reducer(s, local({ type: 'MOVE', unitId: 'u1', q: 0, r: 1 }), rules);
    expect(after.victoryPoints.player1).toHaveLength(1);
    expect(after.victoryPoints.player1[0].objectiveName).toBe('Most');
  });

  it('je čistý: dvojí volání nad týmž (zmrazeným) stavem dá identický výsledek', () => {
    const s = deepFreeze(buildState({
      phase: 'movement',
      hexes: [hexEntry(0, 0, 'grass', { unitId: 'u1' })],
      units: [unitEntry('u1', 'tank', 'player1', { resources: 2, figures: 3 })],
    }));
    const a = reducer(s, local({ type: 'MOVE', unitId: 'u1', q: 1, r: 0 }), rules);
    const b = reducer(s, local({ type: 'MOVE', unitId: 'u1', q: 1, r: 0 }), rules);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(s.grid['0,0'].unitId).toBe('u1'); // původní stav nedotčen
  });

  it('v online hře pohybuje jednotkou jen velitel její sekce (generál kryje neobsazené)', () => {
    const seats = { player1: { general: 'G', left: 'L' }, player2: {} };
    const s = buildState({
      phase: 'movement', seats,
      hexes: [
        hexEntry(0, 0, 'grass', { unitId: 'uLeft' }),   // sloupec 0 => levá sekce
        hexEntry(4, 0, 'grass', { unitId: 'uCenter' }), // sloupec 4 => střed (bez velitele)
      ],
      units: [
        unitEntry('uLeft', 'infantry', 'player1', { resources: 2 }),
        unitEntry('uCenter', 'infantry', 'player1', { resources: 2 }),
      ],
    });
    // Velitel levé sekce smí hýbat levou jednotkou, generál ne (sekce má velitele).
    expect(reducer(s, { type: 'MOVE', clientId: 'L', unitId: 'uLeft', q: 0, r: 1 } as any, rules)).not.toBe(s);
    expect(reducer(s, { type: 'MOVE', clientId: 'G', unitId: 'uLeft', q: 0, r: 1 } as any, rules)).toBe(s);
    // Střed nemá velitele => velí generál; velitel levé sekce tam nesmí.
    expect(reducer(s, { type: 'MOVE', clientId: 'G', unitId: 'uCenter', q: 4, r: 1 } as any, rules)).not.toBe(s);
    expect(reducer(s, { type: 'MOVE', clientId: 'L', unitId: 'uCenter', q: 4, r: 1 } as any, rules)).toBe(s);
  });
});

describe('ATTACK (fáze D – útok)', () => {
  function attackState(defOpts: any = {}, defHex: any = {}) {
    return buildState({
      phase: 'attack',
      hexes: [
        hexEntry(0, 4, 'grass', { unitId: 'a1' }),
        hexEntry(0, 5, 'grass', { unitId: 'd1', ...defHex }),
      ],
      units: [
        unitEntry('a1', 'infantry', 'player1', { resources: 2 }),
        unitEntry('d1', 'infantry', 'player2', { figures: 4, resources: 0, ...defOpts }),
      ],
    });
  }

  it('je deterministický: stejný seed => stejné kostky a stejný výsledek', () => {
    const s = deepFreeze(attackState());
    const act = local({ type: 'ATTACK', attackerId: 'a1', targetId: 'd1', seed: 12345 });
    const a = reducer(s, act, rules);
    const b = reducer(s, act, rules);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.pendingCombat?.dice).toEqual(rollDice(3, 12345));
    expect(s.grid['0,5'].unitId).toBe('d1'); // žádná mutace vstupu
  });

  it('zásahy odebírají figurky (zdroje je nepohlcují); útok stojí 1 zdroj', () => {
    const seed = findSeed(3, d => countHits(d, 'infantry') === 1 && countFlags(d) === 0);
    const s = attackState({ resources: 1 });
    const after = reducer(s, local({ type: 'ATTACK', attackerId: 'a1', targetId: 'd1', seed }), rules);
    expect(after.units.d1.figures).toBe(3); // zásah jde rovnou do figurek
    expect(after.units.a1).toMatchObject({ resources: 1, hasAttacked: true });
  });

  it('zničení jednotky: odstraní ji, přidělí VP a nabídne obsazení pozice', () => {
    const seed = findSeed(3, d => countHits(d, 'infantry') >= 1);
    const s = attackState({ figures: 1 });
    const after = reducer(s, local({ type: 'ATTACK', attackerId: 'a1', targetId: 'd1', seed }), rules);
    expect(after.units.d1).toBeUndefined();
    expect(after.grid['0,5'].unitId).toBeUndefined();
    expect(after.victoryPoints.player1.some(vp => vp.type === 'unit')).toBe(true);
    expect(after.pendingTakeGround).toMatchObject({ unitId: 'a1', hex: { q: 0, r: 5 } });
  });

  it('vlajky vyvolají ústup; pytle s pískem 1 vlajku ignorují', () => {
    const seed1flag = findSeed(3, d => countFlags(d) === 1 && countHits(d, 'infantry') === 0);
    const plain = reducer(attackState(), local({ type: 'ATTACK', attackerId: 'a1', targetId: 'd1', seed: seed1flag }), rules);
    expect(plain.pendingRetreat).toMatchObject({ unitId: 'd1', count: 1 });
    // Obránce za pytli: -1 kostka (2 kostky) a 1 vlajka se ignoruje.
    const seedFlagOnly = findSeed(2, d => countFlags(d) === 1 && countHits(d, 'infantry') === 0);
    const dug = reducer(attackState({}, { overlayTypeId: 'sandbags' }), local({ type: 'ATTACK', attackerId: 'a1', targetId: 'd1', seed: seedFlagOnly }), rules);
    expect(dug.pendingRetreat).toBeNull();
    expect(dug.pendingCombat?.dice).toHaveLength(2);
  });

  it('dělostřelectvo nemůže útočit po pohybu', () => {
    const s = buildState({
      phase: 'attack',
      hexes: [hexEntry(0, 4, 'grass', { unitId: 'a1' }), hexEntry(0, 5, 'grass', { unitId: 'd1' })],
      units: [
        unitEntry('a1', 'artillery', 'player1', { resources: 2, figures: 2, hasMoved: true, movementUsed: 1 }),
        unitEntry('d1', 'infantry', 'player2'),
      ],
    });
    expect(reducer(s, local({ type: 'ATTACK', attackerId: 'a1', targetId: 'd1', seed: 1 }), rules)).toBe(s);
  });

  it('bez zdrojů nebo po útoku nelze útočit; při nevyřešeném souboji také ne', () => {
    const noRes = attackState();
    (noRes.units as any).a1.resources = 0;
    expect(reducer(noRes, local({ type: 'ATTACK', attackerId: 'a1', targetId: 'd1', seed: 1 }), rules)).toBe(noRes);
    const pending = attackState();
    (pending as any).pendingCombat = { attackerId: 'x', targetId: 'y', dice: [], hits: 0, flags: 0 };
    expect(reducer(pending, local({ type: 'ATTACK', attackerId: 'a1', targetId: 'd1', seed: 1 }), rules)).toBe(pending);
  });
});

describe('RESOLVE_RETREAT (ústup)', () => {
  function retreatState(extraHexes: any[] = []) {
    const s = buildState({
      phase: 'attack',
      hexes: [
        hexEntry(0, 5, 'grass', { unitId: 'a1' }),
        hexEntry(0, 4, 'grass', { unitId: 'd1' }),
        ...extraHexes,
      ],
      units: [
        unitEntry('a1', 'infantry', 'player1', { resources: 2 }),
        unitEntry('d1', 'infantry', 'player2', { figures: 2 }),
      ],
    });
    (s as any).pendingRetreat = { unitId: 'd1', count: 1, attackerId: 'a1', targetHex: { q: 0, r: 4 } };
    return s;
  }

  it('odmítne ústup do neprůchodného terénu (řeka)', () => {
    const s = retreatState([hexEntry(0, 3, 'river')]);
    expect(reducer(deepFreeze(s), local({ type: 'RESOLVE_RETREAT', unitId: 'd1', q: 0, r: 3 }), rules)).toBe(s);
  });

  it('odmítne ústup špatným směrem (vpřed) a na obsazené pole', () => {
    const s = retreatState();
    expect(reducer(s, local({ type: 'RESOLVE_RETREAT', unitId: 'd1', q: 0, r: 5 }), rules)).toBe(s); // vpřed (na útočníka)
  });

  it('ústup vzad proběhne a vyřeší pendingRetreat; sousednímu útočníkovi nabídne pozici', () => {
    const s = retreatState();
    const after = reducer(s, local({ type: 'RESOLVE_RETREAT', unitId: 'd1', q: 1, r: 3 }), rules);
    expect(after.grid['1,3'].unitId).toBe('d1');
    expect(after.grid['0,4'].unitId).toBeUndefined();
    expect(after.pendingRetreat).toBeNull();
    expect(after.pendingTakeGround).toMatchObject({ unitId: 'a1', hex: { q: 0, r: 4 } });
  });

  it('setrvání na místě = ztráta života; smrtí vzniká VP útočníka', () => {
    const s = retreatState();
    (s.units as any).d1.figures = 1;
    const after = reducer(s, local({ type: 'RESOLVE_RETREAT', unitId: 'd1', q: 0, r: 4 }), rules);
    expect(after.units.d1).toBeUndefined();
    expect(after.victoryPoints.player1.some(vp => vp.type === 'unit')).toBe(true);
    expect(after.pendingRetreat).toBeNull();
  });
});

describe('RESOLVE_TAKE_GROUND / CANCEL_TAKE_GROUND', () => {
  function tgState() {
    const s = buildState({
      phase: 'attack',
      hexes: [hexEntry(0, 4, 'grass', { unitId: 'a1' })],
      units: [unitEntry('a1', 'infantry', 'player1', { resources: 1 })],
    });
    (s as any).pendingTakeGround = { unitId: 'a1', hex: { q: 0, r: 5 } };
    return s;
  }

  it('obsazení pozice přesune jednotku a vynuluje pending', () => {
    const after = reducer(deepFreeze(tgState()), local({ type: 'RESOLVE_TAKE_GROUND', unitId: 'a1', q: 0, r: 5 }), rules);
    expect(after.grid['0,5'].unitId).toBe('a1');
    expect(after.pendingTakeGround).toBeNull();
  });

  it('zrušení ponechá jednotku na místě', () => {
    const after = reducer(tgState(), local({ type: 'CANCEL_TAKE_GROUND' }), rules);
    expect(after.grid['0,4'].unitId).toBe('a1');
    expect(after.pendingTakeGround).toBeNull();
  });
});

describe('END_TURN a NEXT_PHASE', () => {
  it('konec tahu: předá tah, dá soupeři příjem, všechny nevyužité zdroje propadají', () => {
    const s = buildState({
      phase: 'attack',
      hexes: [hexEntry(0, 0, 'grass', { unitId: 'u1' }), hexEntry(0, 8, 'grass', { unitId: 'e1' })],
      units: [
        unitEntry('u1', 'infantry', 'player1', { resources: 2, hasMoved: true, hasAttacked: true }),
        unitEntry('e1', 'infantry', 'player2', { resources: 2 }),
      ],
    });
    const after = reducer(s, local({ type: 'END_TURN' }), rules);
    expect(after.activePlayerId).toBe('player2');
    expect(after.phase).toBe('distribution-sections');
    expect(after.centralWarehouse.player2).toBe(6);
    // Žádný přenos zdrojů přes konec tahu („život navíc" byl ze hry odstraněn).
    expect(after.units.u1).toMatchObject({ resources: 0, hasMoved: false, hasAttacked: false, movementUsed: 0 });
    expect(after.units.e1.resources).toBe(0); // nový hráč začíná bez přidělených zdrojů
    expect(after.currentTurn).toBe(1); // číslo tahu roste až po tahu druhého hráče
    const round2 = reducer(after, local({ type: 'END_TURN' }), rules);
    expect(round2.currentTurn).toBe(2);
  });

  it('NEXT_PHASE: nerozdělené zdroje ze skladu propadají', () => {
    const s = buildState();
    const after = reducer(s, local({ type: 'NEXT_PHASE' }), rules);
    expect(after.phase).toBe('distribution-units');
    expect(after.centralWarehouse.player1).toBe(0);
  });
});

describe('UNDO', () => {
  it('vrátí poslední rozdělení i poslední pohyb', () => {
    let s: any = buildState({
      hexes: [hexEntry(0, 0, 'grass', { unitId: 'u1' })],
      units: [unitEntry('u1', 'infantry', 'player1')],
    });
    s = reducer(s, local({ type: 'DISTRIBUTE', section: 'left', amount: 2 }), rules);
    const undone = reducer(s, local({ type: 'UNDO' }), rules);
    expect(undone.sectionResources.player1.left).toBe(0);
    expect(undone.centralWarehouse.player1).toBe(6);

    const m = buildState({
      phase: 'movement',
      hexes: [hexEntry(0, 0, 'grass', { unitId: 'u1' })],
      units: [unitEntry('u1', 'infantry', 'player1', { resources: 2 })],
    });
    const moved = reducer(m, local({ type: 'MOVE', unitId: 'u1', q: 0, r: 1 }), rules);
    const back = reducer(moved, local({ type: 'UNDO' }), rules);
    expect(back.grid['0,0'].unitId).toBe('u1');
    expect(back.grid['0,1'].unitId).toBeUndefined();
    expect(back.units.u1.resources).toBe(2);
  });

  it('nelze vracet přes hranici fáze (zásobník se čistí)', () => {
    const m = buildState({
      phase: 'movement',
      hexes: [hexEntry(0, 0, 'grass', { unitId: 'u1' })],
      units: [unitEntry('u1', 'infantry', 'player1', { resources: 2 })],
    });
    const moved = reducer(m, local({ type: 'MOVE', unitId: 'u1', q: 0, r: 1 }), rules);
    const nextPhase = reducer(moved, local({ type: 'NEXT_PHASE' }), rules); // -> attack
    expect(reducer(nextPhase, local({ type: 'UNDO' }), rules)).toBe(nextPhase);
  });
});

describe('vítězství', () => {
  it('dosažení potřebných VP určí vítěze', () => {
    const s = buildState({
      phase: 'attack',
      scenario: { victoryPointsToWin: 1 },
      hexes: [hexEntry(0, 4, 'grass', { unitId: 'a1' }), hexEntry(0, 5, 'grass', { unitId: 'd1' })],
      units: [
        unitEntry('a1', 'infantry', 'player1', { resources: 2 }),
        unitEntry('d1', 'infantry', 'player2', { figures: 1 }),
        // Druhá jednotka p2, aby nevyhrál eliminací, ale body.
        unitEntry('d2', 'infantry', 'player2'),
      ],
    });
    (s.grid as any)['0,8'] = { ...(s.grid as any)['0,8'], unitId: 'd2' };
    const seed = findSeed(3, d => countHits(d, 'infantry') >= 1);
    const after = reducer(s, local({ type: 'ATTACK', attackerId: 'a1', targetId: 'd1', seed }), rules);
    expect(after.winner).toBe('player1');
  });
});
