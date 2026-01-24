export const HEX_SIZE = 50;
export function axialToPixel(q, r) { return { x: HEX_SIZE * Math.sqrt(3) * (q + r / 2), y: HEX_SIZE * (3 / 2) * r }; }
export function offsetToAxial(col, row) { return { q: col - Math.floor(row / 2), r: row }; }
export function axialToOffset(q, r) { return { col: q + Math.floor(r / 2), row: r }; }
export function getDistance(a, b) { return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - (b.q + b.r)) + Math.abs(a.r - b.r)) / 2; }
function lerp(a, b, t) { return a + (b - a) * t; }
function cubeLerp(a, b, t) { return { q: lerp(a.q, b.q, t), r: lerp(a.r, b.r, t), s: lerp(a.s, b.s, t) }; }
function cubeRound(cube) {
  let q = Math.round(cube.q), r = Math.round(cube.r), s = Math.round(cube.s);
  const dq = Math.abs(q - cube.q), dr = Math.abs(r - cube.r), ds = Math.abs(s - cube.s);
  if (dq > dr && dq > ds) q = -r - s; else if (dr > ds) r = -q - s; else s = -q - r;
  return { q, r, s };
}
export function getLine(a, b) {
  const dist = getDistance(a, b), aCube = { q: a.q, r: a.r, s: -a.q - a.r }, bCube = { q: b.q, r: b.r, s: -b.q - b.r }, results = [];
  for (let i = 0; i <= dist; i++) { const t = dist === 0 ? 0 : i / dist; const rounded = cubeRound(cubeLerp(aCube, bCube, t)); results.push({ q: rounded.q, r: rounded.r }); }
  return results;
}
export function getSection(col, lW, cW) { if (col < lW) return 'left'; if (col < lW + cW) return 'center'; return 'right'; }
