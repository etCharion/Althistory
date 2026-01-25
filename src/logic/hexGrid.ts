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

export function getUnitSections(q, r, scenario) {
  const { col } = axialToOffset(q, r);
  const lW = scenario.sections.leftWidth;
  const cW = scenario.sections.centerWidth;
  if (r % 2 !== 0) {
    if (col === lW - 1) return ['left', 'center'];
    if (col === lW + cW - 1) return ['center', 'right'];
  }
  if (col < lW) return ['left'];
  if (col < lW + cW) return ['center'];
  return ['right'];
}

export function getHexesAtPoint(p) {
  const eps = 0.001;
  const candidates = [
    cubeRound({ q: p.q + eps, r: p.r + eps, s: p.s - 2 * eps }),
    cubeRound({ q: p.q - eps, r: p.r - eps, s: p.s + 2 * eps }),
    cubeRound({ q: p.q + eps, r: p.r - eps, s: p.s }),
    cubeRound({ q: p.q - eps, r: p.r + eps, s: p.s }),
  ];
  const seen = new Set();
  const result = [];
  for (const c of candidates) {
    const key = `${c.q},${c.r}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push({ q: c.q, r: c.r });
    }
  }
  return result;
}

export function getNeighbors(q, r) {
  return [
    { q: q + 1, r: r }, { q: q - 1, r: r },
    { q: q, r: r + 1 }, { q: q, r: r - 1 },
    { q: q + 1, r: r - 1 }, { q: q - 1, r: r + 1 }
  ];
}

export function cubeLerpFloat(a, b, t) {
  return { q: lerp(a.q, b.q, t), r: lerp(a.r, b.r, t), s: lerp(a.s, b.s, t) };
}

export function getReachableHexes(q, r, movementLimit, grid, terrainTypes) {
  const reachable = new Set();
  const queue = [{ q, r, dist: 0 }];
  const visited = new Set();
  visited.add(`${q},${r}`);
  while (queue.length > 0) {
    const { q: cq, r: cr, dist: cd } = queue.shift();
    if (cd > 0) reachable.add(`${cq},${cr}`);
    if (cd >= movementLimit) continue;
    const currentHex = grid[`${cq},${cr}`];
    const currentTerrain = terrainTypes.find(t => t.id === currentHex?.terrainTypeId);
    if (cd > 0 && currentTerrain?.movementRestriction === 'stop') continue;
    const neighbors = getNeighbors(cq, cr);
    for (const n of neighbors) {
      const key = `${n.q},${n.r}`;
      const hex = grid[key];
      if (!hex || visited.has(key) || hex.unitId) continue;
      const terrain = terrainTypes.find(t => t.id === hex.terrainTypeId);
      if (terrain?.movementRestriction === 'no-move') continue;
      visited.add(key);
      queue.push({ q: n.q, r: n.r, dist: cd + 1 });
    }
  }
  return Array.from(reachable);
}

export function isBlocking(q, r, grid, terrainTypes) {
  const hex = grid[`${q},${r}`];
  if (!hex) return false;
  if (hex.unitId) return true;
  const terrain = terrainTypes.find(t => t.id === hex.terrainTypeId);
  return terrain?.blocksLOS || false;
}

export function checkLOS(from, to, grid, terrainTypes) {
  const dist = getDistance(from, to);
  if (dist <= 1) return true;
  const line = getLine(from, to);
  // getLine returns [start, ..., end]. We check everything in between.
  for (let i = 1; i < line.length - 1; i++) {
    const h = line[i];
    if (isBlocking(h.q, h.r, grid, terrainTypes)) return false;
  }
  return true;
}

export function getTargetableUnits(attackerQ, attackerR, unitType, gameState, terrainTypes) {
  const attacker = gameState.grid[`${attackerQ},${attackerR}`];
  if (!attacker?.unitId) return [];
  const attackerUnit = gameState.units[attacker.unitId];
  const neighbors = getNeighbors(attackerQ, attackerR);
  const adjacentEnemies = [];
  for (const n of neighbors) {
    const hex = gameState.grid[`${n.q},${n.r}`];
    if (hex?.unitId) {
      const unit = gameState.units[hex.unitId];
      if (unit.ownerId !== attackerUnit.ownerId) adjacentEnemies.push(hex.unitId);
    }
  }
  if (adjacentEnemies.length > 0) return adjacentEnemies;
  const targetable = [];
  const maxRange = unitType.shootingRange.length;
  for (const unitId in gameState.units) {
    const unit = gameState.units[unitId];
    if (unit.ownerId === attackerUnit.ownerId) continue;
    const targetHex = Object.values(gameState.grid).find(h => h.unitId === unitId);
    if (!targetHex) continue;
    const dist = getDistance({ q: attackerQ, r: attackerR }, targetHex);
    const isArtillery = unitType.id === 'artillery';
    if (dist > 1 && dist <= maxRange && (isArtillery || checkLOS({ q: attackerQ, r: attackerR }, targetHex, gameState.grid, terrainTypes))) {
      targetable.push(unitId);
    }
  }
  return targetable;
}
