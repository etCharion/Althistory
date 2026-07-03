// Plánovač výnosu zdrojů (docs/AI-STRATEGY.md §2).
//
// Obrácená logika zásobování: AI nejdřív vygeneruje konkrétní mini-plány
// jednotek (útok z místa, pohyb, pohyb+útok, nic) a ohodnotí je jednou
// hodnotovou funkcí (aiEval.ts). Zdroje se pak přidělují greedy po jednom
// podle mezního výnosu / ceny ze skladu – sekce si zdroje „nekupují" obecným
// skóre, soutěží o ně svými nejlepšími akcemi. Logistická přirážka (5.+ zdroj
// v sekci stojí 2) zdvojnásobuje laťku, kterou musí akce překonat.
//
// Interakce plánů: očekávané zásahy si plány „zamlouvají" ve virtuální mapě
// poškození (koncentrace palby se sčítá k dorážce, dorážka se nezapočítá
// dvakrát) a cílová pole pohybů se rezervují.
import { getUnitSections, getReachableDistances } from './hexGrid';
import { categoryOf } from './gameReducer';
import {
  bestAttackFrom, positionScore, unitHexOf, unitsOf, typeOf,
} from './aiEval';
import type { VirtualDamage } from './aiEval';
import type { AiWeights } from './aiPosture';
import type { Rules } from './gameReducer';
import type { GameState, PlayerId, SectionId } from '../types/game';

export type UnitPlan = {
  unitId: string;
  kind: 'attack' | 'move' | 'moveAttack' | 'idle';
  cost: 0 | 1 | 2;
  value: number;              // mezní hodnota vůči nečinnosti
  dest?: { q: number; r: number };
  targetId?: string;
  expected?: number;          // zamluvené očekávané zásahy (virtuální poškození)
};

export type PlannedIncrement = {
  unitId: string;
  sectionId: SectionId;       // sekce, ze které se zdroj čerpá / kam se posílá
  fromStock: boolean;         // true = už rozdělený sekční zdroj, false = ze skladu
  value: number;              // mezní výnos tohoto zdroje
};

export type TurnPlan = {
  desired: Record<string, number>;              // cílový počet zdrojů jednotky
  plans: Record<string, UnitPlan>;              // zamýšlený plán jednotky
  distribute: Record<SectionId, number>;        // kolik JEŠTĚ přidat ze skladu do sekcí
  increments: PlannedIncrement[];               // nové zdroje v pořadí výběru
};

// Zdroj s výnosem pod tímto prahem se nepřiděluje – lepší nechat propadnout
// než předstírat činnost bezcílným přešlapováním.
const MIN_INCREMENT_VALUE = 0.05;

const SECTIONS: SectionId[] = ['left', 'center', 'right'];
const IDLE = (uid: string): UnitPlan => ({ unitId: uid, kind: 'idle', cost: 0, value: 0 });

export type WeightsFor = (u: any, hex: any) => AiWeights;

type Ctx = {
  state: GameState; rules: Rules; ai: PlayerId;
  weightsFor: WeightsFor;
  virtual: VirtualDamage;
  reserved: Set<string>;      // rezervovaná cílová pole pohybů
};

// ---------------------------------------------------------------------------
// Mini-plány jednotky (§2: útok z místa 1, pohyb 1, pohyb+útok 2, nic 0)
// ---------------------------------------------------------------------------
// Nejlepší plán jednotky pro daný počet zdrojů. Prahy zrcadlí exekuci v ai.ts
// (MOVE_MARGIN, RESOURCE_COST): zdroj, jehož plán by exekuce stejně neprovedla,
// nemá být přidělen.
function bestPlanFor(ctx: Ctx, u: any, budget: 1 | 2): UnitPlan {
  const { state, rules, ai } = ctx;
  const hex = unitHexOf(state, u.id);
  const utype = typeOf(rules, u);
  if (!hex || !utype) return IDLE(u.id);
  const w = ctx.weightsFor(u, hex);
  const cat = categoryOf(utype);
  const movedAlready = u.movementUsed || 0;

  let best: UnitPlan = IDLE(u.id);

  // Útok z místa za 1 zdroj.
  const inPlace = bestAttackFrom(state, rules, u, utype, hex, movedAlready, 1, w, ctx.virtual);
  if (inPlace && inPlace.value > MIN_INCREMENT_VALUE) {
    best = { unitId: u.id, kind: 'attack', cost: 1, value: inPlace.value, targetId: inPlace.targetId, expected: inPlace.expected };
  }

  // Pohyb (1 zdroj) a pohyb+útok (2 zdroje) přes tatáž dosažitelná pole.
  const stayPos = positionScore(state, rules, ai, u, utype, hex, w);
  const remaining = utype.movement - movedAlready;
  if (remaining > 0 && !u.hasMoved) {
    const dists = getReachableDistances(hex.q, hex.r, remaining, state.grid, rules.terrainTypes, rules.overlayTypes, { unitCategory: cat, ownerId: u.ownerId });
    for (const [dKey, dist] of Object.entries(dists) as [string, number][]) {
      if (ctx.reserved.has(dKey)) continue;
      const dHex = (state.grid as any)[dKey];
      const posDelta = positionScore(state, rules, ai, u, utype, dHex, w) - stayPos;
      // Pohyb bez útoku musí překonat práh exekuce (jinak jednotka nevyrazí
      // a zdroj propadne).
      const moveValue = posDelta - w.RESOURCE_COST;
      if (moveValue > Math.max(MIN_INCREMENT_VALUE, w.MOVE_MARGIN) && moveValue > best.value) {
        best = { unitId: u.id, kind: 'move', cost: 1, value: moveValue, dest: { q: dHex.q, r: dHex.r } };
      }
      if (budget >= 2) {
        const ev = bestAttackFrom(state, rules, u, utype, dHex, movedAlready + dist, 1, w, ctx.virtual);
        if (!ev) continue;
        const value = ev.value + posDelta - w.RESOURCE_COST;
        // Druhý zdroj jen za skutečnou druhou akci: pohyb+útok musí porazit
        // útok z místa o práh pohybu, jinak jednotka zůstane stát.
        const bar = inPlace ? inPlace.value + w.MOVE_MARGIN : Math.max(MIN_INCREMENT_VALUE, w.MOVE_MARGIN);
        if (value > bar && value > best.value) {
          best = { unitId: u.id, kind: 'moveAttack', cost: 2, value, dest: { q: dHex.q, r: dHex.r }, targetId: ev.targetId, expected: ev.expected };
        }
      }
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Vedlejší účinky plánu (virtuální poškození, rezervace polí)
// ---------------------------------------------------------------------------
function applyPlan(ctx: Ctx, plan: UnitPlan, sign: 1 | -1) {
  if (plan.targetId && plan.expected) {
    ctx.virtual[plan.targetId] = Math.max(0, (ctx.virtual[plan.targetId] ?? 0) + sign * plan.expected);
  }
  if (plan.dest) {
    const k = `${plan.dest.q},${plan.dest.r}`;
    if (sign === 1) ctx.reserved.add(k); else ctx.reserved.delete(k);
  }
}

// ---------------------------------------------------------------------------
// Greedy alokace zdrojů podle mezního výnosu (§2)
// ---------------------------------------------------------------------------
export function planTurn(state: GameState, rules: Rules, ai: PlayerId, weightsFor: WeightsFor): TurnPlan {
  const ctx: Ctx = { state, rules, ai, weightsFor, virtual: {}, reserved: new Set() };
  const logistics = !!state.scenario.logisticsLimit;
  const stock: Record<SectionId, number> = { ...state.sectionResources[ai] };
  let warehouse = state.centralWarehouse[ai];
  const distribute: Record<SectionId, number> = { left: 0, center: 0, right: 0 };
  const desired: Record<string, number> = {};
  const plans: Record<string, UnitPlan> = {};
  const increments: PlannedIncrement[] = [];

  const myUnits = unitsOf(state, ai).sort((a, b) => (a.id < b.id ? -1 : 1));
  const sectionsOf = (u: any): SectionId[] => {
    const hex = unitHexOf(state, u.id);
    return hex ? (getUnitSections(hex.q, hex.r, state.scenario) as SectionId[]) : [];
  };

  // Už přidělené zdroje jednotek (fáze přidělování v běhu) jsou závazné:
  // jejich plány se zapíšou do virtuální mapy, aby zbytek skladu šel jinam.
  for (const u of myUnits) {
    const have = Math.min(2, u.resources || 0);
    desired[u.id] = have;
    plans[u.id] = have > 0 ? bestPlanFor(ctx, u, have as 1 | 2) : IDLE(u.id);
    if (have > 0) applyPlan(ctx, plans[u.id], 1);
  }

  // Financování `n` zdrojů pro jednotku: nejdřív už rozdělené sekční zásoby
  // (zaplacené, bez přirážky), pak sklad do nejlevnější sekce jednotky.
  // Cena ze skladu roste logistickou přirážkou (5.+ zdroj v sekci stojí 2),
  // včetně navýšení uvnitř téhož páru. Vrací null, když sklad nestačí.
  type Funding = { sectionId: SectionId; fromStock: boolean; cost: number };
  const fundIncrements = (sections: SectionId[], n: number): Funding[] | null => {
    const stockLeft = { ...stock };
    const added = { ...distribute };
    let warehouseLeft = warehouse;
    const out: Funding[] = [];
    for (let i = 0; i < n; i++) {
      const withStock = sections.filter(s => stockLeft[s] > 0).sort((a, b) => stockLeft[b] - stockLeft[a] || SECTIONS.indexOf(a) - SECTIONS.indexOf(b));
      if (withStock.length > 0) {
        stockLeft[withStock[0]] -= 1;
        out.push({ sectionId: withStock[0], fromStock: true, cost: 1 });
        continue;
      }
      const cost = (s: SectionId) => (logistics && state.sectionResources[ai][s] + added[s] >= 4 ? 2 : 1);
      const affordable = sections
        .map(s => ({ s, c: cost(s) }))
        .filter(x => x.c <= warehouseLeft)
        .sort((a, b) => a.c - b.c || SECTIONS.indexOf(a.s) - SECTIONS.indexOf(b.s));
      if (affordable.length === 0) return null;
      warehouseLeft -= affordable[0].c;
      added[affordable[0].s] += 1;
      out.push({ sectionId: affordable[0].s, fromStock: false, cost: affordable[0].c });
    }
    return out;
  };

  while (true) {
    let pick: { u: any; plan: UnitPlan; inc: number; funding: Funding[]; metric: number } | null = null;

    for (const u of myUnits) {
      const have = desired[u.id];
      if (have >= 2) continue;
      const sections = sectionsOf(u);
      if (sections.length === 0) continue;

      // Kandidáti na přírůstek. Vedlejší účinky současného plánu se při
      // přepočtu dočasně odečtou, aby jednotka nesoupeřila sama se sebou.
      applyPlan(ctx, plans[u.id], -1);
      const cands: { plan: UnitPlan; inc: number; res: number }[] = [];
      if (have === 0) {
        const one = bestPlanFor(ctx, u, 1);
        if (one.cost === 1) cands.push({ plan: one, inc: one.value, res: 1 });
        // Pár: jednotka, jejíž hodnota je až v kombinaci pohyb+útok (samotný
        // pohyb nestojí za zdroj), soutěží rovnou o dva zdroje za cenu obou.
        const two = bestPlanFor(ctx, u, 2);
        if (two.cost === 2) cands.push({ plan: two, inc: two.value, res: 2 });
      } else {
        // Druhý zdroj se poměřuje výhradně proti dvouzdrojovému plánu –
        // přepočtená hodnota jednozdrojového plánu druhou akci nekoupí.
        const base = bestPlanFor(ctx, u, 1);
        const two = bestPlanFor(ctx, u, 2);
        if (two.cost === 2) cands.push({ plan: two, inc: two.value - base.value, res: 1 });
      }
      applyPlan(ctx, plans[u.id], 1);

      for (const c of cands) {
        if (c.inc <= MIN_INCREMENT_VALUE * c.res) continue;
        const funding = fundIncrements(sections, c.res);
        if (!funding) continue;
        const metric = c.inc / funding.reduce((sum, f) => sum + f.cost, 0);
        if (!pick || metric > pick.metric || (metric === pick.metric && u.id < pick.u.id)) {
          pick = { u, plan: c.plan, inc: c.inc, funding, metric };
        }
      }
    }

    if (!pick) break;

    // Zaúčtuj zdroje a vyměň plán jednotky (starý uvolní zamluvené účinky).
    applyPlan(ctx, plans[pick.u.id], -1);
    plans[pick.u.id] = pick.plan;
    applyPlan(ctx, pick.plan, 1);
    for (const f of pick.funding) {
      desired[pick.u.id] += 1;
      if (f.fromStock) stock[f.sectionId] -= 1;
      else { warehouse -= f.cost; distribute[f.sectionId] += 1; }
      increments.push({ unitId: pick.u.id, sectionId: f.sectionId, fromStock: f.fromStock, value: pick.inc / pick.funding.length });
    }
  }

  return { desired, plans, distribute, increments };
}
