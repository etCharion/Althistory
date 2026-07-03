// AI protihráč. Doktrína, kterou tento modul implementuje, je popsaná
// v docs/AI-STRATEGY.md – každá heuristika níže odkazuje na její kapitolu.
//
// Zásady: AI hraje výhradně přes akce reduceru (nemůže podvádět), vrací vždy
// jednu akci za rozhodnutí (null = „teď nerozhoduji já") a rozhoduje
// deterministicky – náhodné jsou jen kostky (seed generuje seedFn).
//
// Architektura: hodnotová funkce akcí žije v aiEval.ts, rozdělování zdrojů
// podle mezního výnosu v aiPlanner.ts. Před každým rozhodnutím se z bojové
// situace vybere globální postoj a sekční postoje (aiPosture.ts) – heuristiky
// pak pracují s vahami postoje jednotky.
import { getNeighbors, getReachableDistances, getTargetableUnits, getUnitSections, isImpassableForUnit } from './hexGrid';
import { categoryOf } from './gameReducer';
import { newDiceSeed } from './dice';
import { postureFor, sectionStances, applyStance, stanceSummary } from './aiPosture';
import {
  bestAttackFrom, dangerAt, coverAt, capturableObjective, positionScore,
  unitHexOf, unitsOf, strengthOf, typeOf,
} from './aiEval';
import { planTurn } from './aiPlanner';
import type { WeightsFor } from './aiPlanner';
import type { Posture, SectionStance } from './aiPosture';
import type { Action, Rules } from './gameReducer';
import type { GameState, PlayerId, SectionId } from '../types/game';

export type AiOptions = {
  clientId?: string;
  // Generátor seedů pro hody kostkami (testy dosazují deterministický).
  seedFn?: () => number;
  // Vynucený globální postoj (testy) – jinak se vybírá situačně.
  posture?: Posture;
};

const SECTIONS: SectionId[] = ['left', 'center', 'right'];
const key = (q: number, r: number) => `${q},${r}`;

// ---------------------------------------------------------------------------
// Doktrína rozhodnutí: globální postoj + sekční postoje (AI-STRATEGY.md §14)
// ---------------------------------------------------------------------------
type Doctrine = {
  posture: Posture;
  stances: Record<SectionId, SectionStance | null>;
  // Postoj (váhy) pro jednotku podle její sekce.
  forUnit: (u: any, hex: any) => Posture;
  weightsFor: WeightsFor;
};

function buildDoctrine(state: GameState, rules: Rules, ai: PlayerId, forced?: Posture): Doctrine {
  const posture = forced ?? postureFor(state, rules, ai);
  const stances = sectionStances(state, rules, ai);
  const perSection: Record<SectionId, Posture> = {
    left: applyStance(posture, stances.left),
    center: applyStance(posture, stances.center),
    right: applyStance(posture, stances.right),
  };
  const forUnit = (_u: any, hex: any): Posture => {
    const secs = hex ? (getUnitSections(hex.q, hex.r, state.scenario) as SectionId[]) : [];
    return secs.length > 0 ? perSection[secs[0]] : posture;
  };
  return { posture, stances, forUnit, weightsFor: (u, hex) => forUnit(u, hex).weights };
}

// Aktuální postoj AI pro UI (odznak „Počítač táhne… · Obrana · průlom ve středu").
export function getAiPosture(state: GameState, rules: Rules, aiPlayerId: PlayerId): (Posture & { sectionNote?: string }) | null {
  if (!state || !rules.unitTypes?.length) return null;
  const posture = postureFor(state, rules, aiPlayerId);
  const note = stanceSummary(sectionStances(state, rules, aiPlayerId));
  return note ? { ...posture, sectionNote: note } : posture;
}

// ---------------------------------------------------------------------------
// Fáze A + B: zdroje do sekcí a jednotkám (AI-STRATEGY.md §2)
// ---------------------------------------------------------------------------
// Obojí řídí plánovač výnosu zdrojů: sekce si zdroje nekupují obecným skóre,
// soutěží o ně nejlepšími konkrétními akcemi svých jednotek.
function chooseDistribution(state: GameState, rules: Rules, ai: PlayerId, clientId: string, doc: Doctrine): Action | null {
  if (state.centralWarehouse[ai] <= 0) return null;
  const plan = planTurn(state, rules, ai, doc.weightsFor);
  for (const s of SECTIONS) {
    if (plan.distribute[s] > 0) return { type: 'DISTRIBUTE', clientId, section: s, amount: plan.distribute[s] };
  }
  return null; // žádná akce nestojí za zdroj – zbytek skladu propadá
}

function chooseAssignment(state: GameState, rules: Rules, ai: PlayerId, clientId: string, doc: Doctrine): Action | null {
  const res = state.sectionResources[ai];
  if (res.left <= 0 && res.center <= 0 && res.right <= 0) return null;
  const plan = planTurn(state, rules, ai, doc.weightsFor);
  // Přírůstky jdou v pořadí greedy výběru – první je nejvýnosnější.
  for (const inc of plan.increments) {
    if (inc.fromStock && res[inc.sectionId] > 0) {
      return { type: 'ASSIGN_RESOURCE', clientId, unitId: inc.unitId, sectionId: inc.sectionId };
    }
  }
  return null; // zbylé sekční zdroje nemá kdo smysluplně využít
}

// ---------------------------------------------------------------------------
// Fáze C: pohyb (AI-STRATEGY.md §3)
// ---------------------------------------------------------------------------
// Hodnota stání/cíle = hodnota pozice (aiEval.positionScore) + nejlepší útok,
// který odtud jednotka ještě stihne. Pohyb se koná, jen když cíl překoná stání
// o práh MOVE_MARGIN (setrvačnost proti přešlapování).
function chooseMove(state: GameState, rules: Rules, ai: PlayerId, clientId: string, doc: Doctrine): Action | null {
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
    const w = doc.forUnit(u, hex).weights;

    // Dělostřelecká doktrína: pohyb = ztráta salvy; nehýbat, pokud má na co střílet.
    if (cat === 'artillery' && !u.hasAttacked && (u.resources || 0) > 0
        && bestAttackFrom(state, rules, u, utype, hex, 0, u.resources, w)) continue;

    const stayAtk = u.hasAttacked ? 0 : (bestAttackFrom(state, rules, u, utype, hex, u.movementUsed || 0, u.resources || 0, w)?.value ?? 0);
    const stay = stayAtk + positionScore(state, rules, ai, u, utype, hex, w);

    const remaining = utype.movement - (u.movementUsed || 0);
    const dists = getReachableDistances(hex.q, hex.r, remaining, state.grid, rules.terrainTypes, rules.overlayTypes, { unitCategory: cat, ownerId: u.ownerId });
    for (const [dKey, dist] of Object.entries(dists) as [string, number][]) {
      const dHex = (state.grid as any)[dKey];
      const resourcesAfter = u.hasMoved ? (u.resources || 0) : (u.resources || 0) - 1;
      const destAtk = u.hasAttacked ? 0 : (bestAttackFrom(state, rules, u, utype, dHex, (u.movementUsed || 0) + dist, resourcesAfter, w)?.value ?? 0);
      const moveCost = u.hasMoved ? 0 : w.RESOURCE_COST;
      const dest = destAtk + positionScore(state, rules, ai, u, utype, dHex, w) - moveCost;
      const gain = dest - stay;
      if (gain > w.MOVE_MARGIN && (!best || gain > best.gain)) {
        best = { unitId: u.id, q: dHex.q, r: dHex.r, gain };
      }
    }
  }
  if (!best) return null;
  return { type: 'MOVE', clientId, unitId: best.unitId, q: best.q, r: best.r };
}

// ---------------------------------------------------------------------------
// Fáze D: útok (AI-STRATEGY.md §3 – tatáž hodnotová funkce, globálně přes
// všechny jednotky)
// ---------------------------------------------------------------------------
function chooseAttack(state: GameState, rules: Rules, ai: PlayerId, clientId: string, seedFn: () => number, doc: Doctrine): Action | null {
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
    const w = doc.forUnit(u, hex).weights;

    const ev = bestAttackFrom(state, rules, u, utype, hex, 0, u.resources, w);
    if (!ev) {
      // §3: pěchota na drátu bez cíle drát odstraní.
      if (cat === 'infantry' && hex.overlayTypeId === 'wire' && !wireBreaker
          && getTargetableUnits(hex.q, hex.r, utype, state, rules.terrainTypes, rules.overlayTypes).length === 0) {
        wireBreaker = u.id;
      }
      continue;
    }
    if (!best || ev.value > best.score || (ev.value === best.score && u.id < best.attackerId)) {
      best = { attackerId: u.id, targetId: ev.targetId, score: ev.value };
    }
  }
  if (best) return { type: 'ATTACK', clientId, attackerId: best.attackerId, targetId: best.targetId, seed: seedFn() };
  if (wireBreaker) return { type: 'DESTROY_OVERLAY', clientId, unitId: wireBreaker };
  return null;
}

// ---------------------------------------------------------------------------
// Ústup (AI-STRATEGY.md §4) – řeší se i během tahu člověka.
// ---------------------------------------------------------------------------
function chooseRetreat(state: GameState, rules: Rules, ai: PlayerId, clientId: string, doc: Doctrine): Action {
  const pr = state.pendingRetreat!;
  const u = (state.units as any)[pr.unitId];
  const hex = unitHexOf(state, pr.unitId);
  const utype = typeOf(rules, u);
  const cat = categoryOf(utype);
  const p = doc.forUnit(u, hex);
  const w = p.weights;

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
  // životy, sekce „zdržovat" couvá ochotněji).
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
// Obsazení pozice (AI-STRATEGY.md §5)
// ---------------------------------------------------------------------------
function chooseTakeGround(state: GameState, rules: Rules, ai: PlayerId, clientId: string, doc: Doctrine): Action {
  const tg = state.pendingTakeGround!;
  const u = (state.units as any)[tg.unitId];
  const fromHex = unitHexOf(state, tg.unitId);
  const target = (state.grid as any)[key(tg.hex.q, tg.hex.r)];
  const utype = typeOf(rules, u);
  const cat = categoryOf(utype);

  const cancel: Action = { type: 'CANCEL_TAKE_GROUND', clientId };
  const advance: Action = { type: 'RESOLVE_TAKE_GROUND', clientId, unitId: tg.unitId, q: tg.hex.q, r: tg.hex.r };

  if (!u || !fromHex || !target || target.unitId) return cancel;
  const p = doc.forUnit(u, fromHex);
  const w = p.weights;
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

  // Postoje podle bojové situace (část II doktríny) – vybírají se před každým
  // rozhodnutím, ale jejich vstupy se mění po tazích, takže drží celý tah.
  const doc = buildDoctrine(state, rules, aiPlayerId, opts.posture);

  // Kostky na stole: na svém tahu je AI zavře (v UI to obvykle stihne dřív
  // časovač animace – DISMISS je idempotentní), jinak čeká.
  if (state.pendingCombat) {
    return state.activePlayerId === aiPlayerId ? { type: 'DISMISS_COMBAT', clientId } : null;
  }
  // Ústup / obsazení pozice vlastní jednotky se řeší i během tahu člověka.
  if (state.pendingRetreat) {
    const owner = (state.units as any)[state.pendingRetreat.unitId]?.ownerId;
    return owner === aiPlayerId ? chooseRetreat(state, rules, aiPlayerId, clientId, doc) : null;
  }
  if (state.pendingTakeGround) {
    const owner = (state.units as any)[state.pendingTakeGround.unitId]?.ownerId;
    return owner === aiPlayerId ? chooseTakeGround(state, rules, aiPlayerId, clientId, doc) : null;
  }

  if (state.activePlayerId !== aiPlayerId) return null;

  switch (state.phase) {
    case 'distribution-sections':
      return chooseDistribution(state, rules, aiPlayerId, clientId, doc) ?? { type: 'NEXT_PHASE', clientId };
    case 'distribution-units':
      return chooseAssignment(state, rules, aiPlayerId, clientId, doc) ?? { type: 'NEXT_PHASE', clientId };
    case 'movement':
      return chooseMove(state, rules, aiPlayerId, clientId, doc) ?? { type: 'NEXT_PHASE', clientId };
    case 'attack':
      return chooseAttack(state, rules, aiPlayerId, clientId, seedFn, doc) ?? { type: 'END_TURN', clientId };
    default:
      return null;
  }
}
