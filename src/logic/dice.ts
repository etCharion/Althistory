export function rollDice(count: number) {
  const syms = ['infantry', 'infantry', 'tank', 'grenade', 'flag', 'star'];
  const res = [];
  for (let i = 0; i < count; i++) {
    res.push(syms[Math.floor(Math.random() * syms.length)]);
  }
  return res;
}
