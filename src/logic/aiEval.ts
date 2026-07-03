// Sdílené ohodnocení akcí AI (docs/AI-STRATEGY.md §3 „Jedna hodnotová funkce").
//
// Všechno, co AI dělá – rozdělování zdrojů (aiPlanner.ts), pohyb i palba
// (ai.ts) – se opírá o tytéž stavební kameny: očekávané poškození útoku,
// hodnotu pozice a hrozbu nepřátelské palby. Modul nemá žádný vlastní stav;
// váhy dostává zvenčí (postoj z aiPosture.ts).
import { getDistance, getDiceCount, checkLOS } from './hexGrid';
import { categoryOf } from './gameReducer';
import type { AiWeights } from './aiPosture';
import type { Rules } from './gameReducer';
import type { GameState, PlayerId } from '../types/game';

// Šance na zásah podle kategorie cíle (kostka: 2× pěchota, tank, granát, vlajka, hvězda).
const P_HIT: Record<string, number> = { infantry: 3 / 6, tank: 2 / 6, artillery: 1 / 6 };
export const pHit = (cat: string) => P_HIT[cat] ?? 1 / 6;

// ---------------------------------------------------------------------------
// Pomocné dotazy nad stavem
// ---------------------------------------------------------------------------
export function unitHexOf(state: GameState, uid: string): any {
  return Object.values(state.grid).find((h: any) => h.unitId === uid) || null;
}

export function unitsOf(state: GameState, pid: PlayerId) {
  return Object.values(state.units).filter((u: any) => u.ownerId === pid) as any[];
}

export const enemyOf = (pid: PlayerId): PlayerId => (pid === 'player1' ? 'player2' : 'player1');

// „Životy" jednotky = figurky (zdroje zásahy nepohlcují a na konci tahu propadají).
export const strengthOf = (u: any) => (u.figures || 0);

export function typeOf(rules: Rules, u: any) {
  return rules.unitTypes.find((t: any) => t.id === u.typeId);
}

export const terrainAt = (rules: Rules, hex: any) =>
  rules.terrainTypes.find((t: any) => t.id === hex?.terrainTypeId);
export const overlayAt = (rules: Rules, hex: any) =>
  rules.overlayTypes.find((o: any) => o.id === hex?.overlayTypeId);

// Obranný bonus pole pro jednotku dané kategorie (kostky ubrané útočníkovi).
export function coverAt(rules: Rules, hex: any, cat: string): number {
  const t = terrainAt(rules, hex);
  const o = overlayAt(rules, hex);
  let def = 0;
  if (t) def = cat === 'tank' ? (t.diceModifierDefenseTank ?? 0) : (t.diceModifierDefenseInfantry ?? 0);
  return Math.max(def, o?.diceModifierDefense ?? 0);
}

// Objektiv, který může hráč `pid` získat (není jeho a platí pro něj).
export function capturableObjective(hex: any, pid: PlayerId): any | null {
  const obj = hex?.objective;
  if (!obj) return null;
  if (obj.validFor && obj.validFor !== 'both' && obj.validFor !== pid) return null;
  if (obj.controllingPlayerId === pid) return null;
  return obj;
}

// Drží jednotka na tomto poli dočasný objektiv, o který by odchodem přišla?
export function holdsTemporaryObjective(hex: any, pid: PlayerId): boolean {
  return !!(hex?.objective && hex.objective.type === 'temporary' && hex.objective.controllingPlayerId === pid);
}

export function nearestEnemyDist(state: GameState, pid: PlayerId, fromHex: any): number {
  let best = Infinity;
  for (const e of unitsOf(state, enemyOf(pid))) {
    const eHex = unitHexOf(state, e.id);
    if (eHex) best = Math.min(best, getDistance(fromHex, eHex));
  }
  return best === Infinity ? 99 : best;
}

// Atraktor pohybu: nejbližší získatelný objektiv, jinak nejbližší nepřítel
// (§3 „Přiblížení" – zaručuje, že se AI vždy tlačí do hry a nevznikne pat).
export function nearestAttractorDist(state: GameState, pid: PlayerId, fromHex: any): number {
  let best = Infinity;
  for (const h of Object.values(state.grid) as any[]) {
    if (capturableObjective(h, pid)) best = Math.min(best, getDistance(fromHex, h));
  }
  if (best !== Infinity) return best;
  for (const e of unitsOf(state, enemyOf(pid))) {
    const eHex = unitHexOf(state, e.id);
    if (eHex) best = Math.min(best, getDistance(fromHex, eHex));
  }
  return best === Infinity ? 0 : best;
}

// ---------------------------------------------------------------------------
// Očekávaná palba (§3 hodnotové funkce: poškození + dorážka + koncentrace
// + vytlačování z objektivu)
// ---------------------------------------------------------------------------
export type AttackEval = {
  targetId: string;
  // Očekávané zásahy omezené zbývajícími figurkami cíle (nadbytek je plýtvání).
  expected: number;
  // Plná hodnota útoku ve vahách postoje (KILL / FOCUS / PUSH_OFF_OBJ).
  value: number;
};

// Kumulativní očekávané zásahy, které si už „zamluvily" jiné plány v tomtéž
// tahu (koncentrace palby bez dvojího započtení dorážky – aiPlanner.ts).
export type VirtualDamage = Record<string, number>;

// Nejlepší útok, který jednotka `u` provede z pole `fromHex`, pokud tam skončí
// pohyb dlouhý `movedDist` a zbude jí `resourcesAfter` zdrojů. Zohledňuje limit
// střelby po pohybu, „stop" terén (ruší útok, drát ne) a pravidlo přednosti
// sousedních nepřátel.
export function bestAttackFrom(
  state: GameState, rules: Rules, u: any, utype: any, fromHex: any,
  movedDist: number, resourcesAfter: number, w: AiWeights, virtual?: VirtualDamage,
): AttackEval | null {
  if (resourcesAfter <= 0) return null;
  const cat = categoryOf(utype);
  if (cat === 'artillery' && movedDist > 0) return null;
  if (movedDist > (utype.canShootAfterMovingMax ?? 0)) return null;
  if (movedDist > 0) {
    const t = terrainAt(rules, fromHex);
    const stops = t?.movementRestriction === 'stop';
    const wire = fromHex?.overlayTypeId === 'wire';
    if (stops && !wire) return null; // vstup do lesa/města útok ruší
  }

  const enemies = unitsOf(state, enemyOf(u.ownerId));
  const maxRange = utype.shootingRange.length;
  let bestAdj: AttackEval | null = null;
  let bestRanged: AttackEval | null = null;
  for (const e of enemies) {
    const eHex = unitHexOf(state, e.id);
    if (!eHex || eHex === fromHex) continue;
    const dist = getDistance(fromHex, eHex);
    if (dist > maxRange) continue;
    if (dist > 1 && cat !== 'artillery' && !checkLOS(fromHex, eHex, state.grid, rules.terrainTypes, rules.overlayTypes)) continue;
    const dice = getDiceCount(u, e, fromHex, eHex, state.grid, rules.terrainTypes, rules.overlayTypes, utype);
    if (dice <= 0) continue;
    const eType = typeOf(rules, e);
    const remaining = Math.max(0, strengthOf(e) - (virtual?.[e.id] ?? 0));
    if (remaining <= 0) continue; // cíl už v plánu padl – další palba je plýtvání
    const raw = dice * pHit(categoryOf(eType));
    const expected = Math.min(raw, remaining);
    let value = expected;
    if (raw >= remaining) value += w.KILL;                       // dorážení (VP)
    else if (remaining - raw <= 1) value += w.KILL / 2;          // skoro dorážka
    const eMax = eType?.maxFigures ?? e.figures;
    if (e.figures < eMax) value += w.FOCUS;                      // koncentrace palby
    if (eHex.objective) value += w.PUSH_OFF_OBJ * (eHex.objective.points || 1); // vytlačování
    const ev: AttackEval = { targetId: e.id, expected, value };
    if (dist === 1) { if (!bestAdj || ev.value > bestAdj.value) bestAdj = ev; }
    else if (!bestRanged || ev.value > bestRanged.value) bestRanged = ev;
  }
  // Sousední nepřítel má podle pravidel přednost před střelbou na dálku.
  return bestAdj ?? bestRanged;
}

// Hrozba nepřátelské palby na poli `hex` v příštím kole, škálovaná křehkostí
// jednotky a snížená krytím (§3 „Krytí a riziko").
export function dangerAt(state: GameState, rules: Rules, u: any, utype: any, hex: any, w: AiWeights): number {
  const myCat = categoryOf(utype);
  const enemies = unitsOf(state, enemyOf(u.ownerId));
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

// ---------------------------------------------------------------------------
// Hodnota pozice (§3) – společný základ pro stání i pohyb. Porovnávají se vždy
// dvě pozice (delta), takže konstantní členy se vyruší a záporné penalizace
// (drát, dělo v kontaktu) správně tlačí jednotku pryč i z jejího vlastního pole.
// ---------------------------------------------------------------------------
export function positionScore(state: GameState, rules: Rules, ai: PlayerId, u: any, utype: any, hex: any, w: AiWeights): number {
  const cat = categoryOf(utype);
  const obj = capturableObjective(hex, ai) ? w.OBJ_CAPTURE * (hex.objective.points || 1) : 0;
  const hold = holdsTemporaryObjective(hex, ai) ? w.OBJ_LEAVE : 0;
  const approach = -nearestAttractorDist(state, ai, hex) * w.APPROACH;
  const danger = -dangerAt(state, rules, u, utype, hex, w) * w.DANGER;
  let score = obj + hold + approach + danger;
  // Dělostřelecká doktrína: drž odstup od nepřítele.
  if (cat === 'artillery' && nearestEnemyDist(state, ai, hex) < w.ARTY_MIN_DIST) score -= 3;
  // Nestůj na drátu bez důvodu (past: stojí pohyb i pozici).
  if (hex?.overlayTypeId === 'wire' && !obj) score -= 1.5;
  return score;
}
