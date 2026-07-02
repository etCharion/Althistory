import { describe, it, expect } from 'vitest';
import { rollDice, newDiceSeed } from './dice';

const SYMBOLS = ['infantry', 'tank', 'grenade', 'flag', 'star'];

describe('rollDice', () => {
  it('vrací požadovaný počet kostek s platnými symboly', () => {
    const dice = rollDice(5, 1);
    expect(dice).toHaveLength(5);
    dice.forEach(d => expect(SYMBOLS).toContain(d));
    expect(rollDice(0, 1)).toHaveLength(0);
  });

  it('se seedem je reprodukovatelný, různé seedy dávají různé hody', () => {
    expect(rollDice(50, 42)).toEqual(rollDice(50, 42));
    expect(rollDice(50, 42)).not.toEqual(rollDice(50, 43));
  });

  it('symboly padají v očekávaném poměru (infantry 2/6, ostatní 1/6)', () => {
    const big = rollDice(6000, 7);
    const count = (sym: string) => big.filter(d => d === sym).length;
    expect(count('infantry')).toBeGreaterThan(1700);
    expect(count('infantry')).toBeLessThan(2300);
    for (const sym of ['tank', 'grenade', 'flag', 'star']) {
      expect(count(sym)).toBeGreaterThan(750);
      expect(count(sym)).toBeLessThan(1250);
    }
  });

  it('newDiceSeed vrací celé číslo v rozsahu uint32', () => {
    for (let i = 0; i < 100; i++) {
      const s = newDiceSeed();
      expect(Number.isInteger(s)).toBe(true);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThan(2 ** 32);
    }
  });
});
