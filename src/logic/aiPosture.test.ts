import { describe, it, expect } from 'vitest';
import { assessRole, assessSituation, selectPostureId, forcedPosture, postureFor, BASE_WEIGHTS } from './aiPosture';
import type { Situation } from './aiPosture';
import { chooseAiAction } from './ai';
import { rules, hexEntry, unitEntry, buildState, makeScenario } from './testUtils';

const sit = (s: Partial<Situation>): Situation => ({ role: 'meeting', score: 'even', force: 'even', turn: 3, ...s });

describe('selectPostureId – rozhodovací matice (§13)', () => {
  it('kritické skóre přebíjí vše => VABANK', () => {
    expect(selectPostureId(sit({ score: 'critical', role: 'defender', force: 'stronger' }))).toBe('vabank');
  });
  it('prohrávám a jsem slabší => VABANK', () => {
    expect(selectPostureId(sit({ score: 'trailing', force: 'weaker' }))).toBe('vabank');
  });
  it('vedu bez převahy => KONSOLIDACE', () => {
    expect(selectPostureId(sit({ score: 'leading', force: 'even' }))).toBe('konsolidace');
    expect(selectPostureId(sit({ score: 'leading', force: 'weaker' }))).toBe('konsolidace');
  });
  it('vedu s převahou => dorazit (útočník ÚTOK, jinak VÝPAD)', () => {
    expect(selectPostureId(sit({ score: 'leading', force: 'stronger', role: 'attacker' }))).toBe('utok');
    expect(selectPostureId(sit({ score: 'leading', force: 'stronger', role: 'defender' }))).toBe('vypad');
  });
  it('obránce s převahou => VÝPAD, jinak OBRANA', () => {
    expect(selectPostureId(sit({ role: 'defender', force: 'stronger' }))).toBe('vypad');
    expect(selectPostureId(sit({ role: 'defender', force: 'even' }))).toBe('obrana');
  });
  it('útočník => ÚTOK; střetná bitva podle sil', () => {
    expect(selectPostureId(sit({ role: 'attacker' }))).toBe('utok');
    expect(selectPostureId(sit({ role: 'meeting', force: 'even' }))).toBe('utok');
    expect(selectPostureId(sit({ role: 'meeting', force: 'weaker' }))).toBe('obrana');
  });
});

describe('assessRole – role z rozestavení scénáře (§11)', () => {
  it('AI musí dobývat => útočník; AI drží => obránce; symetrie => střetná', () => {
    const attackScn = makeScenario([
      hexEntry(0, 8, 'grass', { objective: { type: 'permanent', timing: 'immediate', points: 1, controllingPlayerId: 'player2' } }),
    ]);
    expect(assessRole(attackScn, 'player1')).toBe('attacker');
    expect(assessRole(attackScn, 'player2')).toBe('defender');

    const neutral = makeScenario([
      hexEntry(0, 4, 'grass', { objective: { type: 'temporary', timing: 'immediate', points: 1 } }),
    ]);
    expect(assessRole(neutral, 'player1')).toBe('meeting');
    expect(assessRole(makeScenario(), 'player1')).toBe('meeting');
  });

  it('objektiv platný jen pro jednu stranu dělá z ní útočníka', () => {
    const scn = makeScenario([
      hexEntry(0, 4, 'grass', { objective: { type: 'permanent', timing: 'immediate', points: 1, validFor: 'player1' } }),
    ]);
    expect(assessRole(scn, 'player1')).toBe('attacker');
    expect(assessRole(scn, 'player2')).toBe('defender');
  });
});

describe('assessSituation – skóre a poměr sil', () => {
  it('detekuje kritickou situaci a vedení', () => {
    const s: any = buildState({
      hexes: [hexEntry(0, 0, 'grass', { unitId: 'u1' }), hexEntry(0, 8, 'grass', { unitId: 'e1' })],
      units: [unitEntry('u1', 'infantry', 'player1'), unitEntry('e1', 'infantry', 'player2')],
      scenario: { victoryPointsToWin: 4 },
    });
    s.victoryPoints.player2 = [{ id: 'x1' }, { id: 'x2' }, { id: 'x3' }]; // soupeři chybí 1
    expect(assessSituation(s, rules, 'player1').score).toBe('critical');
    expect(assessSituation(s, rules, 'player2').score).toBe('leading');
  });

  it('poměr sil má pásma s mrtvou zónou', () => {
    const mk = (p1Figs: number) => {
      const st: any = buildState({
        hexes: [hexEntry(0, 0, 'grass', { unitId: 'u1' }), hexEntry(0, 8, 'grass', { unitId: 'e1' })],
        units: [unitEntry('u1', 'infantry', 'player1', { figures: p1Figs }), unitEntry('e1', 'infantry', 'player2', { figures: 4 })],
      });
      return assessSituation(st, rules, 'player1').force;
    };
    expect(mk(4)).toBe('even');
    expect(mk(6)).toBe('stronger'); // 6/4 = 1.5
    expect(mk(3)).toBe('weaker');   // 3/4 = 0.75
  });
});

describe('postoje – váhy a modifikátor otevření', () => {
  it('vabank je odvážnější a útok rychlejší než základ', () => {
    const vabank = forcedPosture('vabank');
    expect(vabank.weights.DANGER).toBeLessThan(BASE_WEIGHTS.DANGER);
    expect(vabank.weights.APPROACH).toBeGreaterThan(BASE_WEIGHTS.APPROACH);
    expect(vabank.takeGround).toBe('always');
    const obrana = forcedPosture('obrana');
    expect(obrana.weights.APPROACH).toBeLessThan(BASE_WEIGHTS.APPROACH);
    expect(obrana.takeGround).toBe('objectivesOnly');
  });

  it('v 1.–2. tahu se opatrnost nesnižuje (ani u vabank)', () => {
    expect(forcedPosture('vabank', 1).weights.DANGER).toBeGreaterThanOrEqual(BASE_WEIGHTS.DANGER);
    expect(forcedPosture('vabank', 3).weights.DANGER).toBeLessThan(BASE_WEIGHTS.DANGER);
  });
});

describe('postoje – chování ve hře', () => {
  // Stejná situace na mapě, jiný stav skóre => jiné rozhodnutí o obsazení
  // pozice (pole bez objektivu a bez krytí).
  function takeGroundState() {
    const s = buildState({
      phase: 'attack',
      hexes: [
        hexEntry(0, 4, 'grass', { unitId: 'att' }),
        hexEntry(2, 6, 'grass', { unitId: 'enemy' }), // vzdálený nepřítel, ať hra nekončí
      ],
      units: [
        unitEntry('att', 'infantry', 'player1', { resources: 1, figures: 4 }),
        unitEntry('enemy', 'infantry', 'player2', { figures: 4 }),
      ],
      scenario: { victoryPointsToWin: 4 },
    });
    (s as any).pendingTakeGround = { unitId: 'att', hex: { q: 0, r: 5 } };
    (s as any).currentTurn = 3;
    return s as any;
  }

  it('vedoucí AI (konsolidace) pozici nebere, prohrávající (vabank) ano', () => {
    const leading = takeGroundState();
    leading.victoryPoints.player1 = [{ id: 'a' }, { id: 'b' }]; // vedu 2:0
    expect(postureFor(leading, rules, 'player1').id).toBe('konsolidace');
    expect(chooseAiAction(leading, rules, 'player1')!.type).toBe('CANCEL_TAKE_GROUND');

    const desperate = takeGroundState();
    desperate.victoryPoints.player2 = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]; // soupeři chybí 1
    expect(postureFor(desperate, rules, 'player1').id).toBe('vabank');
    expect(chooseAiAction(desperate, rules, 'player1')!.type).toBe('RESOLVE_TAKE_GROUND');
  });

  it('vynucený postoj přes opts.posture funguje (testovací háček)', () => {
    const s = takeGroundState();
    expect(chooseAiAction(s, rules, 'player1', { posture: forcedPosture('konsolidace') })!.type).toBe('CANCEL_TAKE_GROUND');
    expect(chooseAiAction(s, rules, 'player1', { posture: forcedPosture('vabank') })!.type).toBe('RESOLVE_TAKE_GROUND');
  });
});
