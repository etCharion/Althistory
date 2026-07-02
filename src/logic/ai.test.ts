import { describe, it, expect } from 'vitest';
import { chooseAiAction } from './ai';
import { reducer, createInitialGameState } from './gameReducer';
import { rules, hexEntry, unitEntry, buildState, makeScenario } from './testUtils';
import { getDistance } from './hexGrid';

const AI = 'player1' as const;

describe('AI – zásobování (fáze A/B)', () => {
  it('rozděluje zdroje do sekcí s jednotkami a pak ukončí fázi', () => {
    let s: any = buildState({
      hexes: [hexEntry(0, 0, 'grass', { unitId: 'u1' }), hexEntry(4, 0, 'grass', { unitId: 'u2' })],
      units: [unitEntry('u1', 'infantry', AI), unitEntry('u2', 'infantry', AI)],
    });
    // AI postupně rozdělí sklad jen mezi sekce, kde má jednotky (left, center).
    for (let i = 0; i < 20 && s.phase === 'distribution-sections'; i++) {
      const a = chooseAiAction(s, rules, AI)!;
      expect(a).not.toBeNull();
      if (a.type === 'DISTRIBUTE') expect(['left', 'center']).toContain((a as any).section);
      const next = reducer(s, a, rules);
      expect(next).not.toBe(s);
      s = next;
    }
    expect(s.phase).toBe('distribution-units');
    expect(s.sectionResources[AI].right).toBe(0); // prázdná sekce nic nedostala
  });

  it('přiděluje zdroje přednostně jednotce, která může střílet', () => {
    let s: any = buildState({
      hexes: [
        hexEntry(0, 4, 'grass', { unitId: 'shooter' }),
        hexEntry(0, 5, 'grass', { unitId: 'enemy' }),
        hexEntry(1, 0, 'grass', { unitId: 'idle' }),
      ],
      units: [
        unitEntry('shooter', 'infantry', AI),
        unitEntry('idle', 'infantry', AI),
        unitEntry('enemy', 'infantry', 'player2'),
      ],
    });
    s.phase = 'distribution-units';
    s.sectionResources[AI].left = 2;
    const a: any = chooseAiAction(s, rules, AI)!;
    expect(a.type).toBe('ASSIGN_RESOURCE');
    expect(a.unitId).toBe('shooter');
  });
});

describe('AI – pohyb (fáze C)', () => {
  it('postupuje směrem k neobsazenému objektivu', () => {
    const s = buildState({
      phase: 'movement',
      hexes: [
        hexEntry(0, 0, 'grass', { unitId: 'u1' }),
        hexEntry(0, 4, 'grass', { objective: { type: 'permanent', timing: 'immediate', points: 1 } }),
      ],
      units: [unitEntry('u1', 'infantry', AI, { resources: 2 })],
    });
    const a: any = chooseAiAction(s, rules, AI)!;
    expect(a.type).toBe('MOVE');
    const before = getDistance({ q: 0, r: 0 }, { q: 0, r: 4 });
    expect(getDistance({ q: a.q, r: a.r }, { q: 0, r: 4 })).toBeLessThan(before);
  });

  it('vstoupí přímo na dosažitelný objektiv', () => {
    const s = buildState({
      phase: 'movement',
      hexes: [
        hexEntry(0, 0, 'grass', { unitId: 'u1' }),
        hexEntry(0, 2, 'grass', { objective: { type: 'permanent', timing: 'immediate', points: 1 } }),
      ],
      units: [unitEntry('u1', 'infantry', AI, { resources: 2 })],
    });
    const a: any = chooseAiAction(s, rules, AI)!;
    expect(a.type).toBe('MOVE');
    expect(`${a.q},${a.r}`).toBe('0,2');
  });

  it('dělostřelectvo se nehýbe, když má na co střílet', () => {
    const s = buildState({
      phase: 'movement',
      hexes: [hexEntry(0, 2, 'grass', { unitId: 'arty' }), hexEntry(0, 5, 'grass', { unitId: 'enemy' })],
      units: [
        unitEntry('arty', 'artillery', AI, { resources: 2, figures: 2 }),
        unitEntry('enemy', 'infantry', 'player2'),
      ],
    });
    const a: any = chooseAiAction(s, rules, AI)!;
    expect(a.type).toBe('NEXT_PHASE'); // žádný pohyb – salva má přednost
  });

  it('jednotka s jediným zdrojem a cílem na dostřel raději střílí, než se hýbe', () => {
    const s = buildState({
      phase: 'movement',
      hexes: [hexEntry(0, 4, 'grass', { unitId: 'u1' }), hexEntry(0, 5, 'grass', { unitId: 'enemy' })],
      units: [
        unitEntry('u1', 'infantry', AI, { resources: 1 }),
        unitEntry('enemy', 'infantry', 'player2'),
      ],
    });
    const a: any = chooseAiAction(s, rules, AI)!;
    expect(a.type).toBe('NEXT_PHASE'); // pohyb by utratil munici na útok
  });
});

describe('AI – palba (fáze D)', () => {
  it('doráží oslabený cíl místo čerstvého', () => {
    const s = buildState({
      phase: 'attack',
      hexes: [
        hexEntry(0, 4, 'grass', { unitId: 'att' }),
        hexEntry(0, 5, 'grass', { unitId: 'weak' }),
        hexEntry(1, 4, 'grass', { unitId: 'strong' }),
      ],
      units: [
        unitEntry('att', 'infantry', AI, { resources: 2 }),
        unitEntry('weak', 'infantry', 'player2', { figures: 1 }),
        unitEntry('strong', 'infantry', 'player2', { figures: 4 }),
      ],
    });
    const a: any = chooseAiAction(s, rules, AI)!;
    expect(a.type).toBe('ATTACK');
    expect(a.targetId).toBe('weak');
    expect(typeof a.seed).toBe('number');
  });

  it('bez cílů ukončí tah; pěchota na drátu drát nejdřív odstraní', () => {
    const empty = buildState({
      phase: 'attack',
      hexes: [hexEntry(0, 0, 'grass', { unitId: 'u1' })],
      units: [unitEntry('u1', 'infantry', AI, { resources: 2 })],
    });
    expect(chooseAiAction(empty, rules, AI)!.type).toBe('END_TURN');

    const onWire = buildState({
      phase: 'attack',
      hexes: [hexEntry(0, 0, 'grass', { unitId: 'u1', overlayTypeId: 'wire' })],
      units: [unitEntry('u1', 'infantry', AI, { resources: 2 })],
    });
    const a: any = chooseAiAction(onWire, rules, AI)!;
    expect(a.type).toBe('DESTROY_OVERLAY');
    expect(a.unitId).toBe('u1');
  });
});

describe('AI – ústup a obsazení pozice', () => {
  it('umírající jednotka ustoupí, místo aby vzala smrtící ztrátu', () => {
    const s = buildState({
      phase: 'attack',
      hexes: [hexEntry(0, 3, 'grass', { unitId: 'enemy' }), hexEntry(0, 4, 'grass', { unitId: 'mine' })],
      units: [
        unitEntry('enemy', 'infantry', 'player2', { resources: 2 }),
        unitEntry('mine', 'infantry', AI, { figures: 1, resources: 0 }),
      ],
    });
    (s as any).activePlayerId = 'player2';
    (s as any).pendingRetreat = { unitId: 'mine', count: 1, attackerId: 'enemy', targetHex: { q: 0, r: 4 } };
    const a: any = chooseAiAction(s, rules, AI)!;
    expect(a.type).toBe('RESOLVE_RETREAT');
    expect(`${a.q},${a.r}`).not.toBe('0,4'); // neზůstává = nezemře
    const next = reducer(s, a, rules);
    expect(next).not.toBe(s);
    expect(next.units.mine).toBeDefined();
  });

  it('zdravá posádka objektivu vezme ztrátu a pozici drží', () => {
    const s = buildState({
      phase: 'attack',
      hexes: [
        hexEntry(0, 3, 'grass', { unitId: 'enemy' }),
        hexEntry(0, 4, 'grass', { unitId: 'mine', objective: { type: 'temporary', timing: 'immediate', points: 1, controllingPlayerId: AI } }),
      ],
      units: [
        unitEntry('enemy', 'infantry', 'player2', { resources: 2 }),
        unitEntry('mine', 'infantry', AI, { figures: 4, resources: 1 }),
      ],
    });
    (s as any).activePlayerId = 'player2';
    (s as any).pendingRetreat = { unitId: 'mine', count: 1, attackerId: 'enemy', targetHex: { q: 0, r: 4 } };
    const a: any = chooseAiAction(s, rules, AI)!;
    expect(a.type).toBe('RESOLVE_RETREAT');
    expect(`${a.q},${a.r}`).toBe('0,4'); // zůstává na objektivu
  });

  it('obsadí uvolněný objektiv, ale na ostnatý drát se nehrne', () => {
    const mk = (targetExtra: any) => {
      const s = buildState({
        phase: 'attack',
        hexes: [hexEntry(0, 4, 'grass', { unitId: 'att' }), hexEntry(0, 5, 'grass', targetExtra)],
        units: [unitEntry('att', 'infantry', AI, { resources: 1, figures: 4 })],
      });
      (s as any).pendingTakeGround = { unitId: 'att', hex: { q: 0, r: 5 } };
      return s;
    };
    const ontoObj: any = chooseAiAction(mk({ objective: { type: 'permanent', timing: 'immediate', points: 1 } }), rules, AI)!;
    expect(ontoObj.type).toBe('RESOLVE_TAKE_GROUND');
    const ontoWire: any = chooseAiAction(mk({ overlayTypeId: 'wire' }), rules, AI)!;
    expect(ontoWire.type).toBe('CANCEL_TAKE_GROUND');
  });

  it('mimo svůj tah a bez vlastních čekajících rozhodnutí nezasahuje', () => {
    const s = buildState({
      phase: 'movement',
      hexes: [hexEntry(0, 0, 'grass', { unitId: 'u1' })],
      units: [unitEntry('u1', 'infantry', 'player2', { resources: 2 })],
    });
    (s as any).activePlayerId = 'player2';
    expect(chooseAiAction(s, rules, AI)).toBeNull();
  });
});

describe('AI vs AI – simulace celých partií', () => {
  // Rozhodná bitva: 3 jednotky na každé straně, objektiv uprostřed, 3 VP.
  function battleScenario() {
    return makeScenario(
      [
        hexEntry(0, 0, 'grass', { unitId: 'a1' }),
        hexEntry(2, 0, 'grass', { unitId: 'a2' }),
        hexEntry(4, 0, 'grass', { unitId: 'a3' }),
        hexEntry(-2, 8, 'grass', { unitId: 'b1' }),
        hexEntry(0, 8, 'grass', { unitId: 'b2' }),
        hexEntry(2, 8, 'grass', { unitId: 'b3' }),
        hexEntry(0, 4, 'grass', { objective: { type: 'temporary', timing: 'immediate', points: 1, name: 'Kóta' } }),
      ],
      [
        unitEntry('a1', 'infantry', 'player1'),
        unitEntry('a2', 'tank', 'player1', { figures: 3 }),
        unitEntry('a3', 'infantry', 'player1'),
        unitEntry('b1', 'infantry', 'player2'),
        unitEntry('b2', 'tank', 'player2', { figures: 3 }),
        unitEntry('b3', 'infantry', 'player2'),
      ],
      { victoryPointsToWin: 3, player1: { name: 'P1', income: 5, maxSectionResources: 12 }, player2: { name: 'P2', income: 5, maxSectionResources: 12 } },
    );
  }

  function simulate(seedStart: number, maxSteps = 5000) {
    let state: any = createInitialGameState(battleScenario());
    let seed = seedStart >>> 0;
    const seedFn = () => (seed = (seed * 1103515245 + 12345) >>> 0);
    let steps = 0;
    while (!state.winner && steps < maxSteps) {
      const action =
        chooseAiAction(state, rules, 'player1', { seedFn })
        ?? chooseAiAction(state, rules, 'player2', { seedFn });
      // Vždy má kdo rozhodovat…
      expect(action).not.toBeNull();
      const next = reducer(state, action!, rules);
      // …a každá navržená akce je legální (reducer ji nesmí odmítnout).
      expect(next).not.toBe(state);
      state = next;
      steps++;
    }
    return { state, steps };
  }

  it('partie doběhnou k vítězi jen legálními akcemi (3 různé průběhy kostek)', () => {
    for (const seed of [1, 20260702, 424242]) {
      const { state, steps } = simulate(seed);
      expect(state.winner, `seed ${seed} nedošel k vítězi (${steps} kroků, tah ${state.currentTurn})`).toBeDefined();
    }
  });
});
