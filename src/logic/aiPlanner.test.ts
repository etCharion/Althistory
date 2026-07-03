import { describe, it, expect } from 'vitest';
import { planTurn } from './aiPlanner';
import { chooseAiAction } from './ai';
import { reducer } from './gameReducer';
import { BASE_WEIGHTS, sectionStances, applyStance, forcedPosture, stanceSummary } from './aiPosture';
import { rules, hexEntry, unitEntry, buildState } from './testUtils';

const AI = 'player1' as const;
// Testy plánovače běží na základních vahách (bez situačního postoje), aby
// asserty neseděly na konkrétní bojové situaci.
const baseWeights = () => BASE_WEIGHTS;

describe('Plánovač výnosu zdrojů (fáze A/B)', () => {
  it('zdroj jde za nejlepší konkrétní akcí, ne za obecným skóre sekce', () => {
    // Vlevo tři nečinné pěchoty (vysoké „obecné" skóre sekce), ve středu tank
    // s dorážkou na oslabenou pěchotu. Jediný zdroj musí jít do středu.
    let s: any = buildState({
      hexes: [
        hexEntry(0, 0, 'grass', { unitId: 'l1' }),
        hexEntry(1, 0, 'grass', { unitId: 'l2' }),
        hexEntry(2, 0, 'grass', { unitId: 'l3' }),
        hexEntry(4, 0, 'grass', { unitId: 'c-tank' }),
        hexEntry(4, 2, 'grass', { unitId: 'weak' }),
      ],
      units: [
        unitEntry('l1', 'infantry', AI),
        unitEntry('l2', 'infantry', AI),
        unitEntry('l3', 'infantry', AI),
        unitEntry('c-tank', 'tank', AI, { figures: 3 }),
        unitEntry('weak', 'infantry', 'player2', { figures: 1 }),
      ],
    });
    s.centralWarehouse[AI] = 1;

    const a1: any = chooseAiAction(s, rules, AI)!;
    expect(a1.type).toBe('DISTRIBUTE');
    expect(a1.section).toBe('center');
    s = reducer(s, a1, rules);
    // Sklad je prázdný → konec fáze.
    expect((chooseAiAction(s, rules, AI) as any).type).toBe('NEXT_PHASE');
    s = reducer(s, { type: 'NEXT_PHASE', clientId: 'ai' }, rules);

    // Zdroj dostane tank s dorážkou.
    const a2: any = chooseAiAction(s, rules, AI)!;
    expect(a2.type).toBe('ASSIGN_RESOURCE');
    expect(a2.unitId).toBe('c-tank');
  });

  it('druhý zdroj dostane jen jednotka se skutečnou druhou akcí', () => {
    // Stojící střelec s cílem v dostřelu druhou akci nemá (dvakrát střílet
    // nelze) – i s plným skladem dostane právě jeden zdroj.
    const shooter: any = buildState({
      hexes: [hexEntry(4, 0, 'grass', { unitId: 'sh' }), hexEntry(4, 1, 'grass', { unitId: 'e' })],
      units: [unitEntry('sh', 'infantry', AI), unitEntry('e', 'infantry', 'player2')],
    });
    shooter.centralWarehouse[AI] = 5;
    const p1 = planTurn(shooter, rules, AI, baseWeights);
    expect(p1.desired['sh']).toBe(1);
    expect(p1.increments.length).toBe(1);

    // Tank s cílem těsně za dostřelem naopak potřebuje pohyb + útok = 2 zdroje.
    const mover: any = buildState({
      hexes: [hexEntry(4, 0, 'grass', { unitId: 'tk' }), hexEntry(4, 4, 'grass', { unitId: 'w' })],
      units: [unitEntry('tk', 'tank', AI, { figures: 3 }), unitEntry('w', 'infantry', 'player2', { figures: 1 })],
    });
    mover.centralWarehouse[AI] = 5;
    const p2 = planTurn(mover, rules, AI, baseWeights);
    expect(p2.desired['tk']).toBe(2);
    expect(p2.plans['tk'].kind).toBe('moveAttack');
  });

  it('posádka objektivu bez cíle nedostane zdroj před střelcem s dorážkou', () => {
    // Zdroj pro posádku nemá vlastní hodnotu (zásahy nepohlcuje) – hodnotu má
    // jen akce, kterou koupí. Posádka bez cíle žádnou nemá.
    const s: any = buildState({
      hexes: [
        hexEntry(0, 0, 'grass', { unitId: 'gar', objective: { type: 'temporary', timing: 'immediate', points: 1, controllingPlayerId: AI } }),
        hexEntry(4, 0, 'grass', { unitId: 'sh' }),
        hexEntry(4, 1, 'grass', { unitId: 'weak' }),
      ],
      units: [
        unitEntry('gar', 'infantry', AI),
        unitEntry('sh', 'infantry', AI),
        unitEntry('weak', 'infantry', 'player2', { figures: 1 }),
      ],
    });
    s.centralWarehouse[AI] = 1;
    const p = planTurn(s, rules, AI, baseWeights);
    expect(p.increments[0].unitId).toBe('sh');
    expect(p.desired['gar'] ?? 0).toBe(0);
    expect(p.distribute).toEqual({ left: 0, center: 1, right: 0 });
  });

  it('koncentrace palby: dorážku dostane přírůstek, který práh překročí, a na mrtvý cíl se neplýtvá', () => {
    // Tři pěchoty u nepřítele se 3 figurkami: první útok (1.5 zásahu) dorážku
    // nemá, druhý ji virtuálně dorazí (KILL bonus), třetí už je plýtvání.
    const s: any = buildState({
      hexes: [
        hexEntry(1, 0, 'grass', { unitId: 'u1' }),
        hexEntry(0, 1, 'grass', { unitId: 'u2' }),
        hexEntry(2, 0, 'grass', { unitId: 'u3' }),
        hexEntry(1, 1, 'grass', { unitId: 'e' }),
      ],
      units: [
        unitEntry('u1', 'infantry', AI),
        unitEntry('u2', 'infantry', AI),
        unitEntry('u3', 'infantry', AI),
        unitEntry('e', 'infantry', 'player2', { figures: 3 }),
      ],
    });
    s.centralWarehouse[AI] = 10;
    const p = planTurn(s, rules, AI, baseWeights);
    expect(p.increments.length).toBe(2); // třetí zdroj by šel na virtuálně mrtvý cíl
    // KILL bonus se započítá jednou – přírůstku, jehož palba práh dorazí.
    expect(p.increments[1].value).toBeGreaterThan(p.increments[0].value + BASE_WEIGHTS.KILL / 2);
  });

  it('logistická přirážka: 5. zdroj do sekce je laťka, ne strop', () => {
    // Střed: tři tanky, každý potřebuje pár pohyb+útok (2 zdroje) na vlastní
    // dorážku = 6 smysluplných zdrojů. Vlevo jeden střelec za 1. Bez logistiky
    // projde všech 7; s logistikou a těsným skladem stojí 5. a 6. zdroj do
    // středu dvojnásobek a neprojdou; s volnějším skladem projdou – přirážka
    // je laťka, ne strop. (APPROACH=0: samotný pohyb za zdroj nestojí, hodnotu
    // mají jen kombinace.)
    const weights = () => ({ ...BASE_WEIGHTS, APPROACH: 0 });
    const build = (logistics: boolean, income: number) => {
      const s: any = buildState({
        hexes: [
          hexEntry(3, 0, 'grass', { unitId: 'c-tankA' }),
          hexEntry(4, 0, 'grass', { unitId: 'c-tankB' }),
          hexEntry(5, 0, 'grass', { unitId: 'c-tankC' }),
          hexEntry(3, 4, 'grass', { unitId: 'e-weakA' }),
          hexEntry(4, 4, 'grass', { unitId: 'e-weakB' }),
          hexEntry(5, 4, 'grass', { unitId: 'e-weakC' }),
          hexEntry(0, 0, 'grass', { unitId: 'l-inf' }),
          hexEntry(0, 1, 'grass', { unitId: 'e-left' }),
        ],
        units: [
          unitEntry('c-tankA', 'tank', AI, { figures: 3 }),
          unitEntry('c-tankB', 'tank', AI, { figures: 3 }),
          unitEntry('c-tankC', 'tank', AI, { figures: 3 }),
          unitEntry('l-inf', 'infantry', AI),
          unitEntry('e-weakA', 'infantry', 'player2', { figures: 1 }),
          unitEntry('e-weakB', 'infantry', 'player2', { figures: 1 }),
          unitEntry('e-weakC', 'infantry', 'player2', { figures: 1 }),
          unitEntry('e-left', 'infantry', 'player2'),
        ],
      });
      s.scenario = { ...s.scenario, logisticsLimit: logistics };
      s.centralWarehouse[AI] = income;
      return s;
    };

    const free = planTurn(build(false, 7), rules, AI, weights);
    expect(free.distribute.center).toBe(6);
    expect(free.distribute.left).toBe(1);

    const tight = planTurn(build(true, 7), rules, AI, weights);
    expect(tight.distribute.center).toBe(4); // třetí pár by stál 4, sklad nestačí
    expect(tight.distribute.left).toBe(1);

    const roomy = planTurn(build(true, 9), rules, AI, weights);
    expect(roomy.distribute.center).toBe(6); // dorážka dvojnásobnou laťku překoná
  });
});

describe('Sekční postoje', () => {
  it('rozliší zdržování, držení objektivu a průlom podle místní situace', () => {
    const s: any = buildState({
      hexes: [
        // Vlevo: oslabená pěchota proti dvěma plným – zdržovat.
        hexEntry(0, 0, 'grass', { unitId: 'l-weakme' }),
        hexEntry(0, 2, 'grass', { unitId: 'l-e1' }),
        hexEntry(1, 2, 'grass', { unitId: 'l-e2' }),
        // Střed: posádka drženého objektivu pod tlakem – držet.
        hexEntry(4, 0, 'grass', { unitId: 'c-gar', objective: { type: 'temporary', timing: 'immediate', points: 1, controllingPlayerId: AI } }),
        hexEntry(4, 2, 'grass', { unitId: 'c-e' }),
        // Vpravo: tank proti oslabenému nepříteli – průlom.
        hexEntry(6, 0, 'grass', { unitId: 'r-tank' }),
        hexEntry(7, 0, 'grass', { unitId: 'r-weak' }),
      ],
      units: [
        unitEntry('l-weakme', 'infantry', AI, { figures: 2 }),
        unitEntry('l-e1', 'infantry', 'player2'),
        unitEntry('l-e2', 'infantry', 'player2'),
        unitEntry('c-gar', 'infantry', AI),
        unitEntry('c-e', 'infantry', 'player2'),
        unitEntry('r-tank', 'tank', AI, { figures: 3 }),
        unitEntry('r-weak', 'infantry', 'player2', { figures: 1 }),
      ],
    });
    const stances = sectionStances(s, rules, AI);
    expect(stances.left).toBe('zdrzovat');
    expect(stances.center).toBe('drzet');
    expect(stances.right).toBe('prulom');

    // Souhrn pro odznak v UI zmiňuje nápadné postoje.
    const summary = stanceSummary(stances)!;
    expect(summary).toContain('drží');
    expect(summary).toContain('průlom');
  });

  it('zdržující sekce couvá ochotněji, držící drží víc', () => {
    const base = forcedPosture('obrana');
    const delay = applyStance(base, 'zdrzovat');
    expect(delay.retreatHoldFactor).toBeLessThan(base.retreatHoldFactor);
    expect(delay.weights.DANGER).toBeGreaterThan(base.weights.DANGER);
    const hold = applyStance(base, 'drzet');
    expect(hold.retreatHoldFactor).toBeGreaterThan(base.retreatHoldFactor);
    expect(hold.weights.HOLD_OBJ).toBeGreaterThan(base.weights.HOLD_OBJ);
  });
});
