// AI protihráč. Doktrína, kterou tento modul implementuje, je popsaná
// v docs/AI-STRATEGY.md – každá heuristika níže odkazuje na její kapitolu.
//
// Zásady: AI hraje výhradně přes akce reduceru (nemůže podvádět), vrací vždy
// jednu akci za rozhodnutí (null = „teď nerozhoduji já") a rozhoduje
// deterministicky – náhodné jsou jen kostky (seed generuje seedFn).
//
// Váhy nejsou pevné: před každým rozhodnutím se z bojové situace vybere
// postoj (Útok / Obrana / Výpad / Konsolidace / Vabank – část II doktríny,
// implementace v aiPosture.ts) a heuristiky pracují s jeho vahami.
import { getDistance, getNeighbors, getReachableDistances, getTargetableUnits, getDiceCount, checkLOS, getUnitSections, isImpassableForUnit } from './hexGrid';
import { categoryOf } from './gameReducer';
import { newDiceSeed } from './dice';
import { postureFor } from './aiPosture';
import type { Posture, AiWeights } from './aiPosture';
import type { Action, Rules } from './gameReducer';
import type { GameState, PlayerId, SectionId } from '../types/game';

export type AiOptions = {
  clientId?: string;
  // Generátor seedů pro hody kostkami (testy dosazují deterministický).
  seedFn?: () => number;
  // Vynucený postoj (testy) – jinak se vybírá situačně.
  posture?: Posture;
};

// Aktuální postoj AI pro UI (odznak „Počítač táhne… · Obrana").
export function getAiPosture(state: GameState, rules: Rules, aiPlayerId: PlayerId): Posture | null {
  if (!state || !rules.unitTypes?.length) return null;
  return postureFor(state, rules, aiPlayerId);
}

// Šance na zásah podle kategorie cíle (kostka: 2× pěchota, tank, granát, vlajka, hvězda).
const P_HIT: Record<string, number> = { infantry: 3 / 6, tank: 2 / 6, artillery: 1 / 6 };
const pHit = (cat: string) => P_HIT[cat] ?? 1 / 6;

const key = (q: number, r: number) => `${q},${r}`;

// ---------------------------------------------------------------------------
// Pomocné dotazy nad stavem
// ---------------------------------------------------------------------------
function unitHexOf(state: GameState, uid: string): any {
  return Object.values(state.grid).find((h: any) => h.unitId === uid) || null;
}

function unitsOf(state: GameState, pid: PlayerId) {
  return Object.values(state.units).filter((u: any) => u.ownerId === pid) as any[];
}

// „Životy" jednotky = figurky (zdroje zásahy nepohlcují a na konci tahu propadají).
const strengthOf = (u: any) => (u.figures || 0);

function typeOf(rules: Rules, u: any) {
  return rules.unitTypes.find((t: any) => t.id === u.typeId);
}

const terrainAt = (rules: Rules, hex: any) =>
  rules.terrainTypes.find((t: any) => t.id === hex?.terrainTypeId);
const overlayAt = (rules: Rules, hex: any) =>
  rules.overlayTypes.find((o: any) => o.id === hex?.overlayTypeId);

// Obranný bonus pole pro jednotku dané kategorie (kostky ubrané útočníkovi).
function coverAt(rules: Rules, hex: any, cat: string): number {
  const t = terrainAt(rules, hex);
  const o = overlayAt(rules, hex);
  let def = 0;
  if (t) def = cat === 'tank' ? (t.diceModifierDefenseTank ?? 0) : (t.diceModifierDefenseInfantry ?? 0);
  return Math.max(def, o?.diceModifierDefense ?? 0);
}

// Objektiv, který může hráč `pid` získat (není jeho a platí pro něj).
function capturableObjective(hex: any, pid: PlayerId): any | null {
  const obj = hex?.objective;
  if (!obj) return null;
  if (obj.validFor && obj.validFor !== 'both' && obj.validFor !== pid) return null;
  if (obj.controllingPlayerId === pid) return null;
  return obj;
}

// Drží jednotka na tomto poli dočasný objektiv, o který by odchodem přišla?
function holdsTemporaryObjective(hex: any, pid: PlayerId): boolean {
  return !!(hex?.objective && hex.objective.type === 'temporary' && hex.objective.controllingPlayerId === pid);
}

// ---------------------------------------------------------------------------
// Očekávaná palba (AI-STRATEGY.md §4, §5)
// ---------------------------------------------------------------------------
// Nejlepší očekávané poškození, které jednotka `u` způsobí z pole `fromHex`,
// pokud tam skončí pohyb dlouhý `movedDist` a zbude jí `resourcesAfter` zdrojů.
// Zohledňuje limit střelby po pohybu, „stop" terén (ruší útok, drát ne) a
// pravidlo přednosti sousedních nepřátel.
function bestAttackFrom(state: GameState, rules: Rules, u: any, utype: any, fromHex: any, movedDist: number, resourcesAfter: number, w: AiWeights): number {
  if (resourcesAfter <= 0) return 0;
  const cat = categoryOf(utype);
  if (cat === 'artillery' && movedDist > 0) return 0;
  if (movedDist > (utype.canShootAfterMovingMax ?? 0)) return 0;
  if (movedDist > 0) {
    const t = terrainAt(rules, fromHex);
    const stops = t?.movementRestriction === 'stop';
    const wire = fromHex?.overlayTypeId === 'wire';
    if (stops && !wire) return 0; // vstup do lesa/města útok ruší
  }

  const enemies = unitsOf(state, u.ownerId === 'player1' ? 'player2' : 'player1');
  const maxRange = utype.shootingRange.length;
  let bestAdj = 0;
  let bestRanged = 0;
  let hasAdjacent = false;
  for (const e of enemies) {
    const eHex = unitHexOf(state, e.id);
    if (!eHex || eHex === fromHex) continue;
    const dist = getDistance(fromHex, eHex);
    if (dist > maxRange) continue;
    if (dist > 1 && cat !== 'artillery' && !checkLOS(fromHex, eHex, state.grid, rules.terrainTypes, rules.overlayTypes)) continue;
    const dice = getDiceCount(u, e, fromHex, eHex, state.grid, rules.terrainTypes, rules.overlayTypes, utype);
    if (dice <= 0) continue;
    const eType = typeOf(rules, e);
    let val = dice * pHit(categoryOf(eType));
    if (val >= strengthOf(e)) val += w.KILL; // šance na dorážku
    if (dist === 1) { hasAdjacent = true; bestAdj = Math.max(bestAdj, val); }
    else bestRanged = Math.max(bestRanged, val);
  }
  // Sousední nepřítel má podle pravidel přednost před střelbou na dálku.
  return hasAdjacent ? bestAdj : bestRanged;
}

// Hrozba nepřátelské palby na poli `hex` v příštím kole, škálovaná křehkostí
// jednotky a snížená krytím (AI-STRATEGY.md §4 „Krytí a riziko").
function dangerAt(state: GameState, rules: Rules, u: any, utype: any, hex: any, w: AiWeights): number {
  const myCat = categoryOf(utype);
  const enemies = unitsOf(state, u.ownerId === 'player1' ? 'player2' : 'player1');
  let threat = 0;
  for (const e of enemies) {
    const eHex = unitHexOf(state, e.id);
    if (!eHex) continue;
    const eType = typeOf(rules, e);
    if (!eType) continue;
    const dist = getDistance(eHex, hex);
    const range = eType.shootingRange.length;
    if (dist <= range) {
      // Už teď na dostřel – plná palba.
      threat += (eType.shootingRange[dist - 1] ?? 0) * pHit(myCat);
    } else if (dist <= (eType.movement ?? 0) + 1 && categoryOf(eType) !== 'artillery') {
      // Může se přiblížit a příští kolo střílet zblízka.
      threat += (eType.shootingRange[0] ?? 0) * pHit(myCat) * 0.6;
    }
  }
  const fragility = 2 / Math.max(1, strengthOf(u));
  const cover = coverAt(rules, hex, myCat);
  return Math.max(0, threat * fragility - cover * w.COVER);
}

// Atraktor pohybu: nejbližší získatelný objektiv, jinak nejbližší nepřítel
// (AI-STRATEGY.md §4 „Přiblížení" – zaručuje, že se AI vždy tlačí do hry).
function nearestAttractorDist(state: GameState, pid: PlayerId, fromHex: any): number {
  let best = Infinity;
  for (const h of Object.values(state.grid) as any[]) {
    if (capturableObjective(h, pid)) best = Math.min(best, getDistance(fromHex, h));
  }
  if (best !== Infinity) return best;
  for (const e of unitsOf(state, pid === 'player1' ? 'player2' : 'player1')) {
    const eHex = unitHexOf(state, e.id);
    if (eHex) best = Math.min(best, getDistance(fromHex, eHex));
  }
  return best === Infinity ? 0 : best;
}

// ---------------------------------------------------------------------------
// Fáze A: zdroje do sekcí (AI-STRATEGY.md §2)
// ---------------------------------------------------------------------------
const SECTIONS: SectionId[] = ['left', 'center', 'right'];

function sectionStats(state: GameState, rules: Rules, ai: PlayerId) {
  const stats: Record<SectionId, { capacity: number; myUnits: number; enemies: number; objectives: number }> = {
    left: { capacity: 0, myUnits: 0, enemies: 0, objectives: 0 },
    center: { capacity: 0, myUnits: 0, enemies: 0, objectives: 0 },
    right: { capacity: 0, myUnits: 0, enemies: 0, objectives: 0 },
  };
  for (const u of Object.values(state.units) as any[]) {
    const hex = unitHexOf(state, u.id);
    if (!hex) continue;
    const secs = getUnitSections(hex.q, hex.r, state.scenario);
    for (const s of secs as SectionId[]) {
      if (u.ownerId === ai) {
        stats[s].myUnits += 1;
        stats[s].capacity += Math.max(0, 2 - (u.resources || 0));
      } else {
        stats[s].enemies += 1;
      }
    }
  }
  for (const h of Object.values(state.grid) as any[]) {
    const obj = capturableObjective(h, ai);
    if (!obj) continue;
    const secs = getUnitSections(h.q, h.r, state.scenario);
    for (const s of secs as SectionId[]) stats[s].objectives += obj.points || 1;
  }
  return stats;
}

function chooseDistribution(state: GameState, rules: Rules, ai: PlayerId, clientId: string, p: Posture): Action | null {
  const warehouse = state.centralWarehouse[ai];
  if (warehouse <= 0) return null;
  const stats = sectionStats(state, rules, ai);
  const cur = state.sectionResources[ai];
  const logistics = !!state.scenario.logisticsLimit;

  // 1) Rezerva: každá aktivní sekce dostane nejdřív 1 zdroj (vabank rezervy
  // vynechává – vše jde do těžiště).
  if (p.supplyReserve) {
    for (const s of SECTIONS) {
      if (stats[s].myUnits > 0 && stats[s].capacity > cur[s] && cur[s] === 0) {
        return { type: 'DISTRIBUTE', clientId, section: s, amount: 1 };
      }
    }
  }

  // 2) Těžiště: zbytek do sekce s nejvyšším skóre (síla + cíle + tlak nepřítele).
  const score = (s: SectionId) => 2 * stats[s].myUnits + 3 * stats[s].objectives + 1.5 * stats[s].enemies;
  const needy = SECTIONS
    .filter(s => stats[s].capacity > cur[s])
    .sort((a, b) => score(b) - score(a) || SECTIONS.indexOf(a) - SECTIONS.indexOf(b));
  if (needy.length === 0) return null; // nikdo zdroje nepojme – zbytek propadá

  // 3) Logistika: nepřekračuj 4 na sekci, dokud existuje jiná potřebná sekce.
  let target = needy[0];
  if (logistics && cur[target] >= 4) {
    const under = needy.find(s => cur[s] < 4);
    if (under) target = under;
  }
  // Sklad musí pokrýt aspoň první kostku (nadlimitní stojí 2).
  const firstCost = logistics && cur[target] >= 4 ? 2 : 1;
  if (warehouse < firstCost) return null;
  const room = stats[target].capacity - cur[target];
  const logisticsCap = logistics && needy.length > 1 ? Math.max(0, 4 - cur[target]) : room;
  const amount = Math.max(1, Math.min(room, logisticsCap || room));
  return { type: 'DISTRIBUTE', clientId, section: target, amount };
}

// ---------------------------------------------------------------------------
// Fáze B: zdroje jednotkám (AI-STRATEGY.md §3)
// ---------------------------------------------------------------------------
function chooseAssignment(state: GameState, rules: Rules, ai: PlayerId, clientId: string, p: Posture): Action | null {
  const res = state.sectionResources[ai];
  if (res.left <= 0 && res.center <= 0 && res.right <= 0) return null;

  let best: { unitId: string; sectionId: SectionId; score: number } | null = null;
  for (const u of unitsOf(state, ai)) {
    if ((u.resources || 0) >= 2) continue;
    const hex = unitHexOf(state, u.id);
    if (!hex) continue;
    const sections = (getUnitSections(hex.q, hex.r, state.scenario) as SectionId[]).filter(s => res[s] > 0);
    if (sections.length === 0) continue;
    const utype = typeOf(rules, u);
    if (!utype) continue;

    const isArtillery = categoryOf(utype) === 'artillery';
    const canShoot = getTargetableUnits(hex.q, hex.r, utype, state, rules.terrainTypes, rules.overlayTypes).length > 0;
    const distToEnemy = nearestEnemyDist(state, ai, hex);
    const garrison = hex.objective && hex.objective.controllingPlayerId === ai;
    let score = 0;
    if (canShoot) score += u.resources === 0 ? 4 : 2;            // munice pro střelce
    score += Math.max(0, 3 - Math.min(3, distToEnemy));           // fronta
    if (garrison) score += 2;                                     // posádka objektivu
    if (isArtillery && canShoot) score += 1;
    if (strengthOf(u) <= 1 && distToEnemy > 3) score -= 1;        // opozdilci naposled
    score += (2 - (u.resources || 0)) * 0.1;                      // preferuj prázdné
    // Obranné postoje zásobují dělostřelectvo a posádky přednostně (§3, §12).
    if (p.defensiveSupply) {
      if (isArtillery && canShoot) score += 1.5;
      if (garrison) score += 1.5;
    }

    // Ze sekcí jednotky vyber tu s největší zásobou (vyrovnávání).
    const sectionId = sections.sort((a, b) => res[b] - res[a])[0];
    if (!best || score > best.score || (score === best.score && u.id < best.unitId)) {
      best = { unitId: u.id, sectionId, score };
    }
  }
  if (!best) return null;
  return { type: 'ASSIGN_RESOURCE', clientId, unitId: best.unitId, sectionId: best.sectionId };
}

function nearestEnemyDist(state: GameState, ai: PlayerId, fromHex: any): number {
  let best = Infinity;
  for (const e of unitsOf(state, ai === 'player1' ? 'player2' : 'player1')) {
    const eHex = unitHexOf(state, e.id);
    if (eHex) best = Math.min(best, getDistance(fromHex, eHex));
  }
  return best === Infinity ? 99 : best;
}

// ---------------------------------------------------------------------------
// Fáze C: pohyb (AI-STRATEGY.md §4)
// ---------------------------------------------------------------------------
function scoreStanding(state: GameState, rules: Rules, ai: PlayerId, u: any, utype: any, hex: any, w: AiWeights): number {
  const atk = u.hasAttacked ? 0 : bestAttackFrom(state, rules, u, utype, hex, u.movementUsed || 0, u.resources || 0, w);
  const obj = capturableObjective(hex, ai) ? w.OBJ_CAPTURE * (hex.objective.points || 1) : 0;
  const hold = holdsTemporaryObjective(hex, ai) ? w.OBJ_LEAVE : 0;
  const approach = -nearestAttractorDist(state, ai, hex) * w.APPROACH;
  const danger = -dangerAt(state, rules, u, utype, hex, w) * w.DANGER;
  return atk + obj + hold + approach + danger;
}

function scoreDestination(state: GameState, rules: Rules, ai: PlayerId, u: any, utype: any, fromHex: any, destKey: string, dist: number, w: AiWeights): number {
  const dHex = (state.grid as any)[destKey];
  const cat = categoryOf(utype);
  const resourcesAfter = u.hasMoved ? (u.resources || 0) : (u.resources || 0) - 1;
  const movedTotal = (u.movementUsed || 0) + dist;

  const atk = u.hasAttacked ? 0 : bestAttackFrom(state, rules, u, utype, dHex, movedTotal, resourcesAfter, w);
  const obj = capturableObjective(dHex, ai) ? w.OBJ_CAPTURE * (dHex.objective.points || 1) : 0;
  const leave = holdsTemporaryObjective(fromHex, ai) ? -w.OBJ_LEAVE : 0;
  const approach = -nearestAttractorDist(state, ai, dHex) * w.APPROACH;
  const danger = -dangerAt(state, rules, u, utype, dHex, w) * w.DANGER;
  const moveCost = u.hasMoved ? 0 : -w.RESOURCE_COST;

  let score = atk + obj + leave + approach + danger + moveCost;
  // Dělostřelecká doktrína: drž odstup od nepřítele.
  if (cat === 'artillery' && nearestEnemyDist(state, ai, dHex) < w.ARTY_MIN_DIST) score -= 3;
  // Nevlez na drát bez důvodu (past: stojí pohyb i pozici).
  if (dHex?.overlayTypeId === 'wire' && !obj) score -= 1.5;
  return score;
}

function chooseMove(state: GameState, rules: Rules, ai: PlayerId, clientId: string, p: Posture): Action | null {
  const w = p.weights;
  let best: { unitId: string; q: number; r: number; gain: number } | null = null;

  for (const u of unitsOf(state, ai)) {
    const utype = typeOf(rules, u);
    if (!utype) continue;
    const canStart = !u.hasMoved && (u.resources || 0) > 0;
    const canContinue = u.hasMoved && (u.movementUsed || 0) < utype.movement;
    if (!canStart && !canContinue) continue;
    const hex = unitHexOf(state, u.id);
    if (!hex) continue;
    const cat = categoryOf(utype);

    // Dělostřelectvo: pohyb = ztráta salvy; nehýbat, pokud má na co střílet.
    if (cat === 'artillery' && !u.hasAttacked && (u.resources || 0) > 0
        && bestAttackFrom(state, rules, u, utype, hex, 0, u.resources, w) > 0) continue;

    const stay = scoreStanding(state, rules, ai, u, utype, hex, w);
    const remaining = utype.movement - (u.movementUsed || 0);
    const dists = getReachableDistances(hex.q, hex.r, remaining, state.grid, rules.terrainTypes, rules.overlayTypes, { unitCategory: cat, ownerId: u.ownerId });
    for (const [dKey, dist] of Object.entries(dists) as [string, number][]) {
      const gain = scoreDestination(state, rules, ai, u, utype, hex, dKey, dist, w) - stay;
      if (gain > w.MOVE_MARGIN && (!best || gain > best.gain)) {
        const dHex = (state.grid as any)[dKey];
        best = { unitId: u.id, q: dHex.q, r: dHex.r, gain };
      }
    }
  }
  if (!best) return null;
  return { type: 'MOVE', clientId, unitId: best.unitId, q: best.q, r: best.r };
}

// ---------------------------------------------------------------------------
// Fáze D: útok (AI-STRATEGY.md §5)
// ---------------------------------------------------------------------------
function chooseAttack(state: GameState, rules: Rules, ai: PlayerId, clientId: string, seedFn: () => number, p: Posture): Action | null {
  const w = p.weights;
  let best: { attackerId: string; targetId: string; score: number } | null = null;
  let wireBreaker: string | null = null;

  for (const u of unitsOf(state, ai)) {
    if ((u.resources || 0) <= 0 || u.hasAttacked) continue;
    const utype = typeOf(rules, u);
    if (!utype) continue;
    const cat = categoryOf(utype);
    if (cat === 'artillery' && (u.hasMoved || (u.movementUsed || 0) > 0)) continue;
    const hex = unitHexOf(state, u.id);
    if (!hex) continue;

    const targets = getTargetableUnits(hex.q, hex.r, utype, state, rules.terrainTypes, rules.overlayTypes);
    if (targets.length === 0) {
      // §5: pěchota na drátu bez cíle drát odstraní.
      if (cat === 'infantry' && hex.overlayTypeId === 'wire' && !wireBreaker) wireBreaker = u.id;
      continue;
    }
    for (const tid of targets) {
      const t = (state.units as any)[tid];
      const tHex = unitHexOf(state, tid);
      if (!t || !tHex) continue;
      const tType = typeOf(rules, t);
      const dice = getDiceCount(u, t, hex, tHex, state.grid, rules.terrainTypes, rules.overlayTypes, utype);
      if (dice <= 0) continue;
      const expected = dice * pHit(categoryOf(tType));
      let score = expected;
      if (expected >= strengthOf(t)) score += w.KILL;                    // dorážení
      else if (strengthOf(t) - expected <= 1) score += w.KILL / 2;       // skoro dorážka
      const tTypeMax = tType?.maxFigures ?? t.figures;
      if (t.figures < tTypeMax || (t.resources || 0) === 0) score += w.FOCUS; // koncentrace palby
      if (tHex.objective) score += w.PUSH_OFF_OBJ * (tHex.objective.points || 1); // vytlačování
      if (!best || score > best.score || (score === best.score && u.id < best.attackerId)) {
        best = { attackerId: u.id, targetId: tid, score };
      }
    }
  }
  if (best) return { type: 'ATTACK', clientId, attackerId: best.attackerId, targetId: best.targetId, seed: seedFn() };
  if (wireBreaker) return { type: 'DESTROY_OVERLAY', clientId, unitId: wireBreaker };
  return null;
}

// ---------------------------------------------------------------------------
// Ústup (AI-STRATEGY.md §6) – řeší se i během tahu člověka.
// ---------------------------------------------------------------------------
function chooseRetreat(state: GameState, rules: Rules, ai: PlayerId, clientId: string, p: Posture): Action {
  const w = p.weights;
  const pr = state.pendingRetreat!;
  const u = (state.units as any)[pr.unitId];
  const hex = unitHexOf(state, pr.unitId);
  const utype = typeOf(rules, u);
  const cat = categoryOf(utype);

  // Legální ústupová pole (zrcadlí pravidla reduceru).
  const options = getNeighbors(hex.q, hex.r).filter(n => {
    const h = (state.grid as any)[key(n.q, n.r)];
    if (!h || h.unitId) return false;
    if (isImpassableForUnit(h, rules.terrainTypes, rules.overlayTypes, cat, u.ownerId)) return false;
    return u.ownerId === 'player1' ? n.r > hex.r : n.r < hex.r;
  });

  const wouldDie = strengthOf(u) <= 1;
  const healthy = strengthOf(u) >= 2;
  const holding = hex.objective && (hex.objective.controllingPlayerId === u.ownerId || capturableObjective(hex, u.ownerId));

  // Zdravá posádka objektivu vezme ztrátu a drží pozici; umírající vždy
  // ustoupí. Ochotu držet moduluje postoj (obrana drží víc, konsolidace šetří
  // životy, vabank nemá čas couvat).
  const stayValue = (holding && healthy ? w.HOLD_OBJ * p.retreatHoldFactor : 0) - (wouldDie ? 100 : 1);
  let bestOpt: { q: number; r: number; value: number } | null = null;
  for (const n of options) {
    const h = (state.grid as any)[key(n.q, n.r)];
    const value = -dangerAt(state, rules, u, utype, h, w) * w.DANGER + coverAt(rules, h, cat) * w.COVER;
    if (!bestOpt || value > bestOpt.value) bestOpt = { q: n.q, r: n.r, value };
  }

  if (bestOpt && bestOpt.value > stayValue) {
    return { type: 'RESOLVE_RETREAT', clientId, unitId: pr.unitId, q: bestOpt.q, r: bestOpt.r };
  }
  // Setrvání = ztráta života (nebo jediná možnost, když není kam ustoupit).
  return { type: 'RESOLVE_RETREAT', clientId, unitId: pr.unitId, q: hex.q, r: hex.r };
}

// ---------------------------------------------------------------------------
// Obsazení pozice (AI-STRATEGY.md §7)
// ---------------------------------------------------------------------------
function chooseTakeGround(state: GameState, rules: Rules, ai: PlayerId, clientId: string, p: Posture): Action {
  const w = p.weights;
  const tg = state.pendingTakeGround!;
  const u = (state.units as any)[tg.unitId];
  const fromHex = unitHexOf(state, tg.unitId);
  const target = (state.grid as any)[key(tg.hex.q, tg.hex.r)];
  const utype = typeOf(rules, u);
  const cat = categoryOf(utype);

  const cancel: Action = { type: 'CANCEL_TAKE_GROUND', clientId };
  const advance: Action = { type: 'RESOLVE_TAKE_GROUND', clientId, unitId: tg.unitId, q: tg.hex.q, r: tg.hex.r };

  if (!u || !fromHex || !target || target.unitId) return cancel;
  if (capturableObjective(target, u.ownerId)) return advance; // objektiv se bere vždy
  if (target.overlayTypeId === 'wire') return cancel;         // na drát se neleze (ani vabank)
  if (p.takeGround === 'objectivesOnly') return cancel;       // obrana/konsolidace nevylézá
  if (p.takeGround === 'always') return advance;              // vabank žene vpřed
  if (strengthOf(u) < 2) return cancel;                       // oslabení nepronásledují
  const betterCover = coverAt(rules, target, cat) >= coverAt(rules, fromHex, cat);
  const saferEnough = dangerAt(state, rules, u, utype, target, w) <= dangerAt(state, rules, u, utype, fromHex, w) + 1;
  return betterCover && saferEnough ? advance : cancel;
}

// ---------------------------------------------------------------------------
// Hlavní vstup: jedna akce za rozhodnutí
// ---------------------------------------------------------------------------
export function chooseAiAction(state: GameState, rules: Rules, aiPlayerId: PlayerId, opts: AiOptions = {}): Action | null {
  const clientId = opts.clientId ?? 'ai';
  const seedFn = opts.seedFn ?? newDiceSeed;
  if (!state || state.winner) return null;
  if (!rules.unitTypes?.length || !rules.terrainTypes?.length) return null;

  // Postoj podle bojové situace (část II doktríny) – vybírá se před každým
  // rozhodnutím, ale jeho vstupy se mění po tazích, takže drží celý tah.
  const posture = opts.posture ?? postureFor(state, rules, aiPlayerId);

  // Kostky na stole: na svém tahu je AI zavře (v UI to obvykle stihne dřív
  // časovač animace – DISMISS je idempotentní), jinak čeká.
  if (state.pendingCombat) {
    return state.activePlayerId === aiPlayerId ? { type: 'DISMISS_COMBAT', clientId } : null;
  }
  // Ústup / obsazení pozice vlastní jednotky se řeší i během tahu člověka.
  if (state.pendingRetreat) {
    const owner = (state.units as any)[state.pendingRetreat.unitId]?.ownerId;
    return owner === aiPlayerId ? chooseRetreat(state, rules, aiPlayerId, clientId, posture) : null;
  }
  if (state.pendingTakeGround) {
    const owner = (state.units as any)[state.pendingTakeGround.unitId]?.ownerId;
    return owner === aiPlayerId ? chooseTakeGround(state, rules, aiPlayerId, clientId, posture) : null;
  }

  if (state.activePlayerId !== aiPlayerId) return null;

  switch (state.phase) {
    case 'distribution-sections':
      return chooseDistribution(state, rules, aiPlayerId, clientId, posture) ?? { type: 'NEXT_PHASE', clientId };
    case 'distribution-units':
      return chooseAssignment(state, rules, aiPlayerId, clientId, posture) ?? { type: 'NEXT_PHASE', clientId };
    case 'movement':
      return chooseMove(state, rules, aiPlayerId, clientId, posture) ?? { type: 'NEXT_PHASE', clientId };
    case 'attack':
      return chooseAttack(state, rules, aiPlayerId, clientId, seedFn, posture) ?? { type: 'END_TURN', clientId };
    default:
      return null;
  }
}
