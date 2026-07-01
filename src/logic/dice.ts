const SYMBOLS = ['infantry', 'infantry', 'tank', 'grenade', 'flag', 'star'];

// Deterministický PRNG (mulberry32). Hod se seedem je reprodukovatelný, takže
// reducer zůstává čistou funkcí (stejný stav + akce => stejný výsledek) i při
// opakování Firestore transakce nebo dvojím volání updateru v React.StrictMode.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Náhodný seed pro jeden hod – generuje se v action creatoru (mimo reducer).
export function newDiceSeed(): number {
  return Math.floor(Math.random() * 0xffffffff);
}

export function rollDice(count: number, seed?: number) {
  const rand = seed === undefined ? Math.random : mulberry32(seed);
  const res: string[] = [];
  for (let i = 0; i < count; i++) {
    res.push(SYMBOLS[Math.floor(rand() * SYMBOLS.length)]);
  }
  return res;
}
