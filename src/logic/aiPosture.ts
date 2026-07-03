// Situační postoje AI (docs/AI-STRATEGY.md, část II).
//
// Dvě vrstvy: globální postoj (strategický filtr – nálada celé armády podle
// role, skóre a poměru sil) a sekční postoje (levá/střed/pravá se chovají
// podle místní situace: průlom, palebná základna, držet, zdržovat, přesun
// tlaku). Obojí mění jen váhy a pár přepínačů, rozhodovací kostra v ai.ts
// zůstává stejná. Vše se vyhodnocuje deterministicky z aktuálního stavu
// (žádná paměť) a vstupy se mění po tazích, ne po akcích – postoje tedy
// přirozeně drží celý tah.
import { getUnitSections, getTargetableUnits } from './hexGrid';
import { unitHexOf, unitsOf, capturableObjective, typeOf, strengthOf } from './aiEval';
import type { GameState, PlayerId, SectionId } from '../types/game';
import type { Rules } from './gameReducer';

// ---------------------------------------------------------------------------
// Základní váhy doktríny (AI-STRATEGY.md §7). Jednotka ≈ 1 očekávaný zásah.
// Postoje je násobí; ai.ts i aiPlanner.ts s nimi pracují výhradně přes
// `posture.weights`.
// ---------------------------------------------------------------------------
export type AiWeights = {
  KILL: number;            // §3 dorážení – bonus za pravděpodobné zničení cíle (VP)
  FOCUS: number;           // §3 koncentrace palby na už poškozené cíle
  PUSH_OFF_OBJ: number;    // §3 bonus za palbu na jednotku držící objektiv
  OBJ_CAPTURE: number;     // §3 vstup na neobsazený objektiv (za 1 bod objektivu)
  OBJ_LEAVE: number;       // §3 penalizace za opuštění drženého dočasného objektivu
  APPROACH: number;        // §3 přiblížení k atraktoru (za 1 hex)
  DANGER: number;          // §3 váha hrozby nepřátelské palby na cílovém poli
  COVER: number;           // §3 terénní obranný bonus (za 1 kostku), platí u fronty
  MOVE_MARGIN: number;     // §3 pohyb jen když nové pole překoná stání o tento práh
  RESOURCE_COST: number;   // §3 setrvačnost proti bezcílnému přešlapování
  HOLD_OBJ: number;        // §4 ochota brát ztráty při držení objektivu
  ARTY_MIN_DIST: number;   // §3 dělostřelectvo si drží odstup
};

export const BASE_WEIGHTS: AiWeights = {
  KILL: 4,
  FOCUS: 0.8,
  PUSH_OFF_OBJ: 1.2,
  OBJ_CAPTURE: 6,
  OBJ_LEAVE: 5,
  APPROACH: 0.5,
  DANGER: 0.6,
  COVER: 0.5,
  MOVE_MARGIN: 0.4,
  RESOURCE_COST: 0.3,
  HOLD_OBJ: 2.5,
  ARTY_MIN_DIST: 2,
};

// ---------------------------------------------------------------------------
// Situační hodnocení (AI-STRATEGY.md §11)
// ---------------------------------------------------------------------------
export type Situation = {
  role: 'attacker' | 'defender' | 'meeting';
  score: 'leading' | 'even' | 'trailing' | 'critical';
  force: 'stronger' | 'even' | 'weaker';
  turn: number;
};

// Hodnota jednotky pro poměr sil: figurky × váha typu. Zdroje se nepočítají –
// jsou přechodné (na konci tahu propadají), poměr by kolísal podle toho, kdo
// je zrovna na tahu.
const CATEGORY_VALUE: Record<string, number> = { tank: 1.3, artillery: 1.2, infantry: 1 };

function forceValue(state: GameState, rules: Rules, pid: PlayerId): number {
  let total = 0;
  for (const u of Object.values(state.units) as any[]) {
    if (u.ownerId !== pid) continue;
    const utype: any = rules.unitTypes.find((t: any) => t.id === u.typeId);
    const cat = utype?.category || 'infantry';
    total += (u.figures || 0) * (CATEGORY_VALUE[cat] ?? 1);
  }
  return total;
}

// Role v bitvě je stabilní celou hru – čte se z rozestavení scénáře: kdo musí
// objektivy dobývat, je útočník; kdo je na startu drží (nebo jsou určené jen
// soupeři), je obránce; symetrie = střetná bitva.
export function assessRole(scenario: any, ai: PlayerId): Situation['role'] {
  const enemy: PlayerId = ai === 'player1' ? 'player2' : 'player1';
  let aiTargets = 0;
  let enemyTargets = 0;
  for (const h of scenario?.initialHexes || []) {
    const obj = h.objective;
    if (!obj) continue;
    const points = obj.points || 1;
    const validFor = (pid: PlayerId) => !obj.validFor || obj.validFor === 'both' || obj.validFor === pid;
    if (validFor(ai) && obj.controllingPlayerId !== ai) aiTargets += points;
    if (validFor(enemy) && obj.controllingPlayerId !== enemy) enemyTargets += points;
  }
  if (aiTargets > enemyTargets) return 'attacker';
  if (aiTargets < enemyTargets) return 'defender';
  return 'meeting';
}

export function assessSituation(state: GameState, rules: Rules, ai: PlayerId): Situation {
  const enemy: PlayerId = ai === 'player1' ? 'player2' : 'player1';
  const toWin = state.scenario?.victoryPointsToWin || 6;
  const myNeed = Math.max(0, toWin - (state.victoryPoints?.[ai]?.length || 0));
  const enemyNeed = Math.max(0, toWin - (state.victoryPoints?.[enemy]?.length || 0));

  let score: Situation['score'];
  if (enemyNeed <= 2 && enemyNeed < myNeed) score = 'critical';
  else if (myNeed < enemyNeed) score = 'leading';
  else if (myNeed > enemyNeed) score = 'trailing';
  else score = 'even';

  const mine = forceValue(state, rules, ai);
  const theirs = forceValue(state, rules, enemy);
  // Pásma s mrtvou zónou, aby jedna ztracená figurka nepřepínala postoj.
  const ratio = theirs <= 0 ? Infinity : mine / theirs;
  const force: Situation['force'] = ratio >= 1.3 ? 'stronger' : ratio <= 0.75 ? 'weaker' : 'even';

  return { role: assessRole(state.scenario, ai), score, force, turn: state.currentTurn || 1 };
}

// ---------------------------------------------------------------------------
// Katalog postojů (AI-STRATEGY.md §12)
// ---------------------------------------------------------------------------
export type PostureId = 'utok' | 'obrana' | 'vypad' | 'konsolidace' | 'vabank';

export type Posture = {
  id: PostureId;
  label: string;
  description: string;
  weights: AiWeights;
  // §5: kdy obsazovat uvolněnou pozici po zničeném nepříteli.
  takeGround: 'standard' | 'objectivesOnly' | 'always';
  // §4: násobek ochoty brát ztráty při držení objektivu.
  retreatHoldFactor: number;
};

type PostureDef = {
  label: string;
  description: string;
  mult: Partial<AiWeights>;
  set: Partial<AiWeights>;
  takeGround: Posture['takeGround'];
  retreatHoldFactor: number;
};

const POSTURE_DEFS: Record<PostureId, PostureDef> = {
  utok: {
    label: 'Útok',
    description: 'Ofenzíva: tempo, zábor prostoru a objektivů, nižší opatrnost.',
    mult: { APPROACH: 1.4, OBJ_CAPTURE: 1.3, PUSH_OFF_OBJ: 1.5, DANGER: 0.8 },
    set: { MOVE_MARGIN: 0.3 },
    takeGround: 'standard', retreatHoldFactor: 1,
  },
  obrana: {
    label: 'Obrana',
    description: 'Drž linii a krytí, take-ground jen na objektivy, šetři jednotky.',
    mult: { APPROACH: 0.5, COVER: 1.6, HOLD_OBJ: 1.4, DANGER: 1.3 },
    set: { MOVE_MARGIN: 0.6 },
    takeGround: 'objectivesOnly', retreatHoldFactor: 1.3,
  },
  vypad: {
    label: 'Výpad',
    description: 'Protiútok z obrany: cílem je dorazit oslabené síly, ne dobývat.',
    mult: { APPROACH: 1.4, OBJ_CAPTURE: 1.3, PUSH_OFF_OBJ: 1.5, DANGER: 0.8, KILL: 1.3, FOCUS: 1.5 },
    set: { MOVE_MARGIN: 0.3 },
    takeGround: 'standard', retreatHoldFactor: 1,
  },
  konsolidace: {
    label: 'Konsolidace',
    description: 'Vedu na body: neriskovat, držet objektivy, střílet jen z pozic.',
    mult: { APPROACH: 0.3, DANGER: 1.5, HOLD_OBJ: 1.5 },
    set: { MOVE_MARGIN: 0.7 },
    takeGround: 'objectivesOnly', retreatHoldFactor: 0.8,
  },
  vabank: {
    label: 'Vabank',
    description: 'Zoufalý útok: opatrnost stranou, maximální tlak na objektivy a zabití.',
    mult: { DANGER: 0.3, APPROACH: 1.8, OBJ_CAPTURE: 2, KILL: 1.5 },
    set: { MOVE_MARGIN: 0.1 },
    takeGround: 'always', retreatHoldFactor: 1.5,
  },
};

function buildPosture(id: PostureId, turn: number): Posture {
  const def = POSTURE_DEFS[id];
  const weights: AiWeights = { ...BASE_WEIGHTS };
  for (const [k, m] of Object.entries(def.mult)) (weights as any)[k] = (BASE_WEIGHTS as any)[k] * (m as number);
  for (const [k, v] of Object.entries(def.set)) (weights as any)[k] = v as number;
  // Modifikátor otevření (§12): v 1.–2. tahu žádné riskování – ani vabank
  // neposílá jednotky osamoceně přes celou mapu.
  if (turn <= 2) weights.DANGER = Math.max(weights.DANGER, BASE_WEIGHTS.DANGER);
  return { id, label: def.label, description: def.description, weights, takeGround: def.takeGround, retreatHoldFactor: def.retreatHoldFactor };
}

// ---------------------------------------------------------------------------
// Rozhodovací matice (AI-STRATEGY.md §13) – shora dolů, první shoda platí.
// ---------------------------------------------------------------------------
export function selectPostureId(sit: Situation): PostureId {
  if (sit.score === 'critical') return 'vabank';                                   // 1
  if (sit.score === 'trailing' && sit.force === 'weaker') return 'vabank';         // 2
  if (sit.score === 'leading' && sit.force !== 'stronger') return 'konsolidace';   // 3
  if (sit.score === 'leading' && sit.force === 'stronger')                          // 4
    return sit.role === 'attacker' ? 'utok' : 'vypad';
  if (sit.role === 'defender' && sit.force === 'stronger') return 'vypad';         // 5
  if (sit.role === 'defender') return 'obrana';                                    // 6
  if (sit.role === 'attacker') return 'utok';                                      // 7
  return sit.force !== 'weaker' ? 'utok' : 'obrana';                               // 8
}

export function postureFor(state: GameState, rules: Rules, ai: PlayerId): Posture {
  const sit = assessSituation(state, rules, ai);
  return buildPosture(selectPostureId(sit), sit.turn);
}

// Užitečné pro testy: postoj s vynuceným id (bez situačního hodnocení).
export function forcedPosture(id: PostureId, turn: number = 3): Posture {
  return buildPosture(id, turn);
}

// ---------------------------------------------------------------------------
// Sekční postoje (AI-STRATEGY.md §14) – místní chování nad globálním filtrem
// ---------------------------------------------------------------------------
// V Memoir stylu se často zároveň brání jeden bok a tlačí středem. Sekční
// postoj se odvozuje z místní situace (poměr sil, objektivy, palebné
// příležitosti) a jen dolaďuje váhy jednotek dané sekce – zdroje sekcím
// nepřiděluje (o ty soutěží konkrétní akce v aiPlanner.ts).
export type SectionStance = 'prulom' | 'palebna' | 'drzet' | 'zdrzovat' | 'presun';

export const SECTION_STANCE_INFO: Record<SectionStance, { label: string; description: string }> = {
  prulom: { label: 'průlom', description: 'Oslabený nepřítel nebo dosažitelný objektiv – tlačit vpřed.' },
  palebna: { label: 'palebná základna', description: 'Dobré střelecké pozice – stát a pálit.' },
  drzet: { label: 'drží', description: 'Držený objektiv – neopouštět, brát ztráty.' },
  zdrzovat: { label: 'zdržuje', description: 'Místní slabost – ustupovat do krytu, nedarovat medaili.' },
  presun: { label: 'přesun tlaku', description: 'Žádná dobrá akce – zdroje patří jinam.' },
};

// Modulace vah pro jednotky sekce (násobí se navrch globálního postoje).
const STANCE_MODS: Record<SectionStance, { mult: Partial<AiWeights>; holdFactor: number }> = {
  prulom: { mult: { APPROACH: 1.2, MOVE_MARGIN: 0.75 }, holdFactor: 1 },
  palebna: { mult: { MOVE_MARGIN: 1.3, COVER: 1.2 }, holdFactor: 1 },
  drzet: { mult: { HOLD_OBJ: 1.3, OBJ_LEAVE: 1.3 }, holdFactor: 1.2 },
  zdrzovat: { mult: { DANGER: 1.3, APPROACH: 0.6 }, holdFactor: 0.7 },
  presun: { mult: {}, holdFactor: 1 },
};

// Poměr místních sil s mrtvou zónou obdobnou globálnímu hodnocení.
const LOCAL_WEAK_RATIO = 0.6;

export function sectionStances(state: GameState, rules: Rules, ai: PlayerId): Record<SectionId, SectionStance | null> {
  type Stat = { myForce: number; enemyForce: number; myUnits: number; canShoot: boolean; weakEnemy: boolean; capturable: boolean; held: boolean };
  const stats: Record<SectionId, Stat> = {
    left: { myForce: 0, enemyForce: 0, myUnits: 0, canShoot: false, weakEnemy: false, capturable: false, held: false },
    center: { myForce: 0, enemyForce: 0, myUnits: 0, canShoot: false, weakEnemy: false, capturable: false, held: false },
    right: { myForce: 0, enemyForce: 0, myUnits: 0, canShoot: false, weakEnemy: false, capturable: false, held: false },
  };

  for (const u of Object.values(state.units) as any[]) {
    const hex = unitHexOf(state, u.id);
    if (!hex) continue;
    const utype: any = typeOf(rules, u);
    const value = strengthOf(u) * (CATEGORY_VALUE[utype?.category || 'infantry'] ?? 1);
    const secs = getUnitSections(hex.q, hex.r, state.scenario) as SectionId[];
    for (const s of secs) {
      if (u.ownerId === ai) {
        stats[s].myForce += value;
        stats[s].myUnits += 1;
        if (!stats[s].canShoot && utype && getTargetableUnits(hex.q, hex.r, utype, state, rules.terrainTypes, rules.overlayTypes).length > 0) {
          stats[s].canShoot = true;
        }
      } else {
        stats[s].enemyForce += value;
        if (strengthOf(u) <= 2) stats[s].weakEnemy = true;
      }
    }
  }
  for (const h of Object.values(state.grid) as any[]) {
    const secs = getUnitSections(h.q, h.r, state.scenario) as SectionId[];
    for (const s of secs) {
      if (capturableObjective(h, ai)) stats[s].capturable = true;
      if (h.objective?.controllingPlayerId === ai) stats[s].held = true;
    }
  }

  const classify = (st: Stat): SectionStance | null => {
    if (st.myUnits === 0) return null;
    const ratio = st.enemyForce <= 0 ? Infinity : st.myForce / st.enemyForce;
    if ((st.capturable || st.weakEnemy) && ratio >= 1) return 'prulom';
    if (st.held) return 'drzet';
    if (st.enemyForce > 0 && ratio <= LOCAL_WEAK_RATIO) return 'zdrzovat';
    if (st.canShoot) return 'palebna';
    return 'presun';
  };

  return { left: classify(stats.left), center: classify(stats.center), right: classify(stats.right) };
}

// Postoj dané sekce aplikovaný na globální postoj (váhy jednotek sekce).
export function applyStance(p: Posture, stance: SectionStance | null): Posture {
  if (!stance) return p;
  const def = STANCE_MODS[stance];
  const weights: AiWeights = { ...p.weights };
  for (const [k, m] of Object.entries(def.mult)) (weights as any)[k] = (weights as any)[k] * (m as number);
  return { ...p, weights, retreatHoldFactor: p.retreatHoldFactor * def.holdFactor };
}

// Krátký souhrn nápadných sekčních postojů pro odznak v UI
// („průlom ve středu · drží vlevo"). Palebná základna a přesun tlaku se
// nevypisují – jsou to klidové stavy.
const SECTION_LABEL: Record<SectionId, string> = { left: 'vlevo', center: 've středu', right: 'vpravo' };

export function stanceSummary(stances: Record<SectionId, SectionStance | null>): string | null {
  const notable: string[] = [];
  for (const s of ['center', 'left', 'right'] as SectionId[]) {
    const st = stances[s];
    if (st === 'prulom' || st === 'drzet' || st === 'zdrzovat') {
      notable.push(`${SECTION_STANCE_INFO[st].label} ${SECTION_LABEL[s]}`);
    }
  }
  return notable.length > 0 ? notable.join(' · ') : null;
}
