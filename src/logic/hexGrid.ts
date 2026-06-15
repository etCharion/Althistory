export const HEX_SIZE = 55;
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

// Je terén/překážka na poli `hex` zcela neprůchozí pro jednotku dané kategorie
// a strany? Pokrývá klasické 'no-move' i nová omezení podle typu jednotky a strany.
export function isImpassableForUnit(hex, terrainTypes, overlayTypes = [], unitCategory, ownerId) {
  const terrain = terrainTypes.find(t => t.id === hex?.terrainTypeId);
  const overlay = overlayTypes.find(o => o.id === hex?.overlayTypeId);
  for (const def of [terrain, overlay]) {
    if (!def) continue;
    if (def.movementRestriction === 'no-move') return true;
    if (unitCategory && def.impassableForCategories?.includes(unitCategory)) return true;
    if (ownerId && def.impassableForPlayer === ownerId) return true;
  }
  return false;
}

export function getReachableHexes(q, r, movementLimit, grid, terrainTypes, overlayTypes = [], options = {}) {
  const { unitCategory = undefined, ownerId = undefined } = options as any;
  const reachable = new Set();
  const queue = [{ q, r, dist: 0 }];
  const visited = new Set();
  visited.add(`${q},${r}`);

  // Výchozí pole jednotky: pokud z něj lze vystoupit jen na vedlejší pole,
  // jednotka se po prvním kroku musí zastavit.
  const startHex = grid[`${q},${r}`];
  const startTerrain = terrainTypes.find(t => t.id === startHex?.terrainTypeId);
  const startOverlay = overlayTypes.find(o => o.id === startHex?.overlayTypeId);
  const exitAdjacentOnly = !!(startTerrain?.exitToAdjacentOnly || startOverlay?.exitToAdjacentOnly);

  while (queue.length > 0) {
    const { q: cq, r: cr, dist: cd } = queue.shift();
    if (cd > 0) reachable.add(`${cq},${cr}`);
    if (cd >= movementLimit) continue;
    // Po vystoupení z pole s omezeným výstupem už nelze pokračovat v pohybu.
    if (cd > 0 && exitAdjacentOnly) continue;
    const currentHex = grid[`${cq},${cr}`];
    const currentTerrain = terrainTypes.find(t => t.id === currentHex?.terrainTypeId);
    const currentOverlay = overlayTypes.find(o => o.id === currentHex?.overlayTypeId);

    const isStopHex = currentTerrain?.movementRestriction === 'stop' || currentOverlay?.movementRestriction === 'stop';

    if (cd > 0 && isStopHex) continue;

    const neighbors = getNeighbors(cq, cr);
    for (const n of neighbors) {
      const key = `${n.q},${n.r}`;
      const hex = grid[key];
      if (!hex || visited.has(key) || hex.unitId) continue;

      if (isImpassableForUnit(hex, terrainTypes, overlayTypes, unitCategory, ownerId)) continue;

      // Na pole se vstupem jen z vedlejšího pole lze vstoupit pouze přímo
      // z výchozí pozice jednotky (cd === 0), ne průchodem přes jiná pole.
      const terrain = terrainTypes.find(t => t.id === hex.terrainTypeId);
      const overlay = overlayTypes.find(o => o.id === hex.overlayTypeId);
      const entryAdjacentOnly = terrain?.entryFromAdjacentOnly || overlay?.entryFromAdjacentOnly;
      if (entryAdjacentOnly && cd !== 0) continue;

      visited.add(key);
      queue.push({ q: n.q, r: n.r, dist: cd + 1 });
    }
  }
  return Array.from(reachable);
}

export function isBlocking(q, r, grid, terrainTypes, overlayTypes = []) {
  const hex = grid[`${q},${r}`];
  if (!hex) return false;
  if (hex.unitId) return true;
  const terrain = terrainTypes.find(t => t.id === hex.terrainTypeId);
  if (terrain?.blocksLOS) return true;
  if (hex.overlayTypeId) {
    const overlay = overlayTypes.find(o => o.id === hex.overlayTypeId);
    if (overlay?.blocksLOS) return true;
  }
  return false;
}

export function areOnSameRidge(a, b, grid) {
  if (grid[`${a.q},${a.r}`]?.terrainTypeId !== 'hill' || grid[`${b.q},${b.r}`]?.terrainTypeId !== 'hill') return false;
  const visited = new Set();
  const queue = [{ q: a.q, r: a.r }];
  visited.add(`${a.q},${a.r}`);
  while (queue.length > 0) {
    const curr = queue.shift();
    if (curr.q === b.q && curr.r === b.r) return true;
    for (const n of getNeighbors(curr.q, curr.r)) {
      const key = `${n.q},${n.r}`;
      if (!visited.has(key) && grid[key]?.terrainTypeId === 'hill') {
        visited.add(key);
        queue.push(n);
      }
    }
  }
  return false;
}

export function checkLOS(from, to, grid, terrainTypes, overlayTypes = []) {
  const dist = getDistance(from, to);
  if (dist <= 1) return true;

  const fromCube = { q: from.q, r: from.r, s: -from.q - from.r };
  const toCube = { q: to.q, r: to.r, s: -to.q - to.r };
  const onSameRidge = areOnSameRidge(from, to, grid);

  // Sample the line to catch transitions. A point blocks ONLY IF all hexes it touches block.
  // This implements the "half-blocked" rule where sight along an edge is clear.
  const samples = dist * 5;
  for (let i = 1; i < samples; i++) {
    const t = i / samples;
    const p = cubeLerpFloat(fromCube, toCube, t);
    const hexes = getHexesAtPoint(p);

    let pointBlocked = true;
    let hexesToCheck = 0;

    for (const h of hexes) {
      if ((h.q === from.q && h.r === from.r) || (h.q === to.q && h.r === to.r)) continue;
      hexesToCheck++;
      const hex = grid[`${h.q},${h.r}`];
      if (!hex) { pointBlocked = false; break; }

      let blocks = !!hex.unitId;
      if (!blocks) {
        const terrain = terrainTypes.find(tt => tt.id === hex.terrainTypeId);
        if (terrain?.blocksLOS && !(terrain.id === 'hill' && onSameRidge)) blocks = true;
        if (!blocks && hex.overlayTypeId) {
          const overlay = overlayTypes.find(o => o.id === hex.overlayTypeId);
          if (overlay?.blocksLOS) blocks = true;
        }
      }

      if (!blocks) { pointBlocked = false; break; }
    }
    if (hexesToCheck > 0 && pointBlocked) return false;
  }
  return true;
}

export function getDiceCount(attackerUnit, targetUnit, attackerHex, targetHex, grid, terrainTypes, overlayTypes, attackerUnitType) {
  const dist = getDistance(attackerHex, targetHex);
  const category = attackerUnitType.category || (attackerUnitType.id === 'tank' ? 'tank' : (attackerUnitType.id === 'artillery' ? 'artillery' : 'infantry'));
  const isArtillery = category === 'artillery';
  const isTank = category === 'tank';
  const isInfantry = category === 'infantry';

  const tarHex = grid[`${targetHex.q},${targetHex.r}`];
  const tarTerrain = terrainTypes.find(t => t.id === tarHex?.terrainTypeId) || terrainTypes[0];
  const tarOverlay = overlayTypes.find(o => o.id === tarHex?.overlayTypeId) || null;
  const attTerrain = terrainTypes.find(t => t.id === attackerHex?.terrainTypeId) || terrainTypes[0];
  const attOverlay = overlayTypes.find(o => o.id === attackerHex?.overlayTypeId) || null;

  let diceModifierDefense = 0;
  if (!isArtillery) {
    const onSameRidge = areOnSameRidge(attackerHex, targetHex, grid);
    let terrainDef = 0;
    if (!(tarTerrain.id === 'hill' && onSameRidge)) {
      if (isTank) terrainDef = tarTerrain.diceModifierDefenseTank ?? 0;
      else if (isInfantry) terrainDef = tarTerrain.diceModifierDefenseInfantry ?? 0;
    }
    const overlayDef = tarOverlay?.diceModifierDefense ?? 0;
    diceModifierDefense = Math.max(terrainDef, overlayDef);
  }

  let terrainAtt = 0;
  if (isTank) terrainAtt = attTerrain.diceModifierAttackTank ?? 0;
  else if (isInfantry) terrainAtt = attTerrain.diceModifierAttackInfantry ?? 0;

  let overlayAtt = 0;
  if (isTank) overlayAtt = attOverlay?.diceModifierAttackTank ?? 0;
  else if (isInfantry) overlayAtt = attOverlay?.diceModifierAttackInfantry ?? 0;
  else if (isArtillery) overlayAtt = attOverlay?.diceModifierAttackArtillery ?? 0;

  const diceModifierAttack = Math.min(terrainAtt, overlayAtt);

  let baseDice = attackerUnitType.shootingRange[dist - 1] ?? 0;
  return Math.max(0, baseDice - diceModifierDefense + diceModifierAttack);
}

export function getTargetableUnits(attackerQ, attackerR, unitType, gameState, terrainTypes, overlayTypes = []) {
  const attacker = gameState.grid[`${attackerQ},${attackerR}`];
  if (!attacker?.unitId) return [];
  const attackerUnit = gameState.units[attacker.unitId];
  const neighbors = getNeighbors(attackerQ, attackerR);
  const adjacentEnemies = [];
  for (const n of neighbors) {
    const hex = gameState.grid[`${n.q},${n.r}`];
    if (hex?.unitId) {
      const unit = gameState.units[hex.unitId];
      if (unit.ownerId !== attackerUnit.ownerId) {
        if (getDiceCount(attackerUnit, unit, attacker, hex, gameState.grid, terrainTypes, overlayTypes, unitType) > 0) {
          adjacentEnemies.push(hex.unitId);
        }
      }
    }
  }
  if (adjacentEnemies.length > 0) return adjacentEnemies;
  const targetable = [];
  const maxRange = unitType.shootingRange.length;
  for (const unitId in gameState.units) {
    const unit = gameState.units[unitId];
    if (unit.ownerId === attackerUnit.ownerId) continue;
    const targetHex = Object.values(gameState.grid).find(h => h.unitId === unitId) as any;
    if (!targetHex) continue;
    const dist = getDistance({ q: attackerQ, r: attackerR }, targetHex);
    const isArtillery = unitType.category === 'artillery';
    if (dist > 1 && dist <= maxRange && (isArtillery || checkLOS({ q: attackerQ, r: attackerR }, targetHex, gameState.grid, terrainTypes, overlayTypes))) {
      if (getDiceCount(attackerUnit, unit, attacker, targetHex, gameState.grid, terrainTypes, overlayTypes, unitType) > 0) {
        targetable.push(unitId);
      }
    }
  }
  return targetable;
}
