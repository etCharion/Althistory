export function rollDice(count) {
  const syms = ['infantry', 'tank', 'grenade', 'flag', 'star', 'star'];
  const res = []; for (let i = 0; i < count; i++) res.push(syms[Math.floor(Math.random() * syms.length)]);
  return res;
}
