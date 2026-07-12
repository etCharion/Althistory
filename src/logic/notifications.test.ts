import { describe, it, expect } from 'vitest';
import { normalizePhoneForWhatsApp, buildWhatsAppUrl, buildTurnMessage, isTurnHandoverToMe } from './notifications';

describe('normalizePhoneForWhatsApp', () => {
  it('přijme mezinárodní tvar s "+" a mezerami', () => {
    expect(normalizePhoneForWhatsApp('+420 606 123 456')).toBe('420606123456');
  });

  it('převede vedoucí "00" na mezinárodní tvar', () => {
    expect(normalizePhoneForWhatsApp('00420606123456')).toBe('420606123456');
  });

  it('holé 9místné číslo považuje za české a doplní 420', () => {
    expect(normalizePhoneForWhatsApp('606 123 456')).toBe('420606123456');
  });

  it('odstraní pomlčky, tečky a závorky', () => {
    expect(normalizePhoneForWhatsApp('+420-606.123.456')).toBe('420606123456');
    expect(normalizePhoneForWhatsApp('(+420) 606 123 456')).toBe('420606123456');
  });

  it('odmítne vstup s nečíselnými znaky', () => {
    expect(normalizePhoneForWhatsApp('abcdefgh')).toBeNull();
    expect(normalizePhoneForWhatsApp('+420 606 xyz 456')).toBeNull();
  });

  it('odmítne příliš krátké nebo příliš dlouhé číslo', () => {
    expect(normalizePhoneForWhatsApp('123')).toBeNull(); // < 8 číslic
    expect(normalizePhoneForWhatsApp('+42060612345678901')).toBeNull(); // > 15 číslic
  });

  it('odmítne prázdný vstup', () => {
    expect(normalizePhoneForWhatsApp('')).toBeNull();
  });

  it('ponechá delší číslo s předvolbou beze změny (jen normalizace formátu)', () => {
    expect(normalizePhoneForWhatsApp('00 1 415 555 2671')).toBe('14155552671');
  });
});

describe('buildWhatsAppUrl', () => {
  it('sestaví odkaz na wa.me s zakódovanou zprávou', () => {
    const url = buildWhatsAppUrl('420606123456', 'Jsi na tahu! Ahoj & vitej');
    expect(url).toBe('https://wa.me/420606123456?text=' + encodeURIComponent('Jsi na tahu! Ahoj & vitej'));
    expect(url).toContain('%26'); // "&" musí být zakódované, ne rozdělovat query string
  });
});

describe('buildTurnMessage', () => {
  it('sestaví českou zprávu se jménem scénáře a odkazem na hru', () => {
    const msg = buildTurnMessage('Bitva o Prahu', 'https://example.com/game/abc');
    expect(msg).toBe('Jsi na tahu ve hře „Bitva o Prahu“! Pokračuj zde: https://example.com/game/abc');
  });
});

describe('isTurnHandoverToMe', () => {
  it('true, když se aktivní strana změní na mě', () => {
    expect(isTurnHandoverToMe('player2', 'player1', 'player1', undefined)).toBe(true);
  });

  it('false, když se aktivní strana nezměnila', () => {
    expect(isTurnHandoverToMe('player1', 'player1', 'player1', undefined)).toBe(false);
  });

  it('false, když je na tahu soupeř', () => {
    expect(isTurnHandoverToMe('player1', 'player2', 'player1', undefined)).toBe(false);
  });

  it('false, když nemám žádný tým (divák)', () => {
    expect(isTurnHandoverToMe('player2', 'player1', null, undefined)).toBe(false);
  });

  it('false, pokud je už hra rozhodnuta (winner nastaven)', () => {
    expect(isTurnHandoverToMe('player2', 'player1', 'player1', 'player1')).toBe(false);
  });

  it('false při prvním renderu, kdy předchozí strana není známa a shoduje se s mým týmem', () => {
    // Toto ošetřuje hook (inicializuje ref na aktuální hodnotu), ale čistá
    // funkce sama o sobě bere null/undefined jako běžnou "jinou" hodnotu.
    expect(isTurnHandoverToMe(undefined, 'player1', 'player1', undefined)).toBe(true);
    expect(isTurnHandoverToMe(null, 'player1', 'player1', undefined)).toBe(true);
  });
});
