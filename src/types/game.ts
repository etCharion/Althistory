export type PlayerId = 'player1' | 'player2';
export type SectionId = 'left' | 'center' | 'right';
export type UnitType = {
  id: string;
  name: string;
  movement: number;
  shootingRange: number[];
  canShootAfterMovingMax: number;
  maxFigures: number;
  natoSymbol: string;
  category: 'infantry' | 'tank' | 'artillery';
};
export type Unit = { id: string; typeId: string; ownerId: PlayerId; figures: number; resources: number; hasMoved: boolean; hasAttacked: boolean; movementUsed: number; resourceOrigins?: SectionId[]; };

// --- Multiplayer roles & seats ---
export type Role = 'general' | 'left' | 'center' | 'right';
export type Actor = { team: PlayerId; role: Role };
export type Seats = {
  player1: Partial<Record<Role, string>>;
  player2: Partial<Record<Role, string>>;
};

export type Country = { id: string; name: string; };
export type Campaign = { id: string; name: string; };

export type UnitCategory = 'infantry' | 'tank' | 'artillery';

export type TerrainType = {
  id: string;
  name: string;
  blocksLOS: boolean;
  movementRestriction?: 'stop' | 'no-move' | 'none';
  // Terén je zcela neprůchozí pro tyto kategorie jednotek.
  impassableForCategories?: UnitCategory[];
  // Terén je zcela neprůchozí pro jednotky této strany.
  impassableForPlayer?: PlayerId;
  // Na pole lze vstoupit pouze přímo z vedlejšího pole (z výchozí pozice
  // jednotky) – nelze ho dosáhnout průchodem přes jiná pole.
  entryFromAdjacentOnly?: boolean;
  // Z pole lze vystoupit pouze na vedlejší pole; po vystoupení už nelze
  // pokračovat v pohybu.
  exitToAdjacentOnly?: boolean;
  diceModifierDefenseInfantry: number;
  diceModifierDefenseTank: number;
  diceModifierAttackInfantry: number;
  diceModifierAttackTank: number;
  ignoreFlags?: number;
  color?: string;
  description?: string;
};

export type OverlayType = {
  id: string;
  name: string;
  diceModifierDefense?: number;
  diceModifierAttackInfantry?: number;
  diceModifierAttackTank?: number;
  diceModifierAttackArtillery?: number;
  ignoreFlags?: number;
  movementRestriction?: 'stop' | 'no-move' | 'none';
  impassableForCategories?: UnitCategory[];
  impassableForPlayer?: PlayerId;
  entryFromAdjacentOnly?: boolean;
  exitToAdjacentOnly?: boolean;
  blocksLOS?: boolean;
  color?: string;
  description?: string;
};

// How a multi-tile objective awards its victory point(s):
//  - 'any'      – the player controls at least one tile of the group
//  - 'majority' – the player controls more than half of the group's tiles
//  - 'all'      – the player controls every tile of the group
export type ObjectiveCondition = 'any' | 'majority' | 'all';

export type Objective = {
  name?: string;
  type: 'permanent' | 'temporary';
  timing: 'immediate' | 'startOfTurn';
  points: number;
  controllingPlayerId?: PlayerId;
  validFor?: PlayerId | 'both';
  // Multi-tile objectives: every hex that shares the same `groupId` belongs to
  // one logical objective. The victory point is awarded once for the whole
  // group, based on `condition`. Single-tile objectives leave both unset
  // (which behaves like controlling that one tile).
  groupId?: string;
  condition?: ObjectiveCondition;
};

export type Hex = {
  q: number;
  r: number;
  s: number;
  terrainTypeId: string;
  overlayTypeId?: string;
  unitId?: string;
  objective?: Objective;
  // Volitelný textový popisek vykreslený na políčku (např. jméno města/řeky).
  label?: string;
};

export type Scenario = {
  id: string;
  name: string;
  description: string;
  // Slovní popis cílů a podmínek vítězství. Lze ho vyplnit ručně nebo nechat
  // automaticky vygenerovat z objektivů rozmístěných na mapě.
  victoryGoals?: string;
  boardWidth: number;
  boardHeight: number;
  sections: { leftWidth: number; centerWidth: number; rightWidth: number; };
  player1: { name: string; income: number; maxSectionResources: number; };
  player2: { name: string; income: number; maxSectionResources: number; };
  victoryPointsToWin: number;
  // Logistické omezení: každý zdroj přidělený do sekce, která už má 4 přidělené
  // zdroje, stojí ze skladu 2 zdroje (místo 1). Nadlimitní zdroje jsou barevně
  // odlišené. Volí se při spuštění hry v jejím nastavení.
  logisticsLimit?: boolean;
  firstPlayerId: PlayerId;
  initialHexes: Hex[];
  initialUnits: Unit[];
  // New meta fields
  isRealBattle: boolean;
  year: number;
  // Legacy single-country field, kept for backward compatibility with older
  // scenarios. New scenarios use `countryIds` (a scenario can span multiple
  // countries); `countryId` mirrors the first selected country.
  countryId?: string;
  countryIds?: string[];
  campaignId?: string;
  campaignNumber?: number;
};

export type UnitStats = {
  unitId: string;
  unitTypeId: string;
  ownerId: PlayerId;
  damageDealt: number;
  damageTaken: number;
  kills: number;
  distanceTraveled: number;
  attackers: string[];
  destroyedInRound?: number;
};

export type VPDetail = {
  id: string;
  type: 'unit' | 'objective';
  round: number;
  unitStats?: UnitStats;
  objectiveName?: string;
  objectiveHexKey?: string;
  // For multi-tile objectives the VP belongs to a whole group rather than a
  // single hex; this ties the VP detail to that group so it can be recomputed.
  objectiveGroupKey?: string;
};

export type GamePhase = 'distribution-sections' | 'distribution-units' | 'movement' | 'attack' | 'gameOver';

// Shared combat state so dice rolls / retreats are visible to every connected player.
export type PendingCombat = { attackerId: string; targetId: string; dice: string[]; hits: number; flags: number };
export type PendingRetreat = { unitId: string; count: number; attackerId: string; targetHex: { q: number; r: number } };
export type PendingTakeGround = { unitId: string; hex: { q: number; r: number } };

// A snapshot of the mutable, per-phase state taken before a reversible action
// (distributing resources to sections, moving a unit). Popping it restores the
// state to just before that action, letting a player undo within an open phase.
export type UndoSnapshot = {
  clientId: string;
  phase: GamePhase;
  units: Record<string, Unit>;
  grid: Record<string, Hex>;
  unitStats: Record<string, UnitStats>;
  victoryPoints: { player1: VPDetail[]; player2: VPDetail[]; };
  sectionResources: { player1: { left: number; center: number; right: number }; player2: { left: number; center: number; right: number }; };
  centralWarehouse: { player1: number; player2: number; };
};

export type GameState = {
  scenario: Scenario;
  currentTurn: number;
  activePlayerId: PlayerId;
  phase: GamePhase;
  sectionResources: { player1: { left: number; center: number; right: number }; player2: { left: number; center: number; right: number }; };
  centralWarehouse: { player1: number; player2: number; };
  units: Record<string, Unit>;
  grid: Record<string, Hex>;
  winner?: PlayerId;
  victoryPoints: { player1: VPDetail[]; player2: VPDetail[]; };
  unitStats: Record<string, UnitStats>;
  // --- Online multiplayer (absent => local hot-seat game with full control) ---
  seats?: Seats;
  pendingCombat?: PendingCombat | null;
  pendingRetreat?: PendingRetreat | null;
  pendingTakeGround?: PendingTakeGround | null;
  // Reversible actions within the current (unclosed) phase. Cleared on every
  // phase change / end of turn.
  undoStack?: UndoSnapshot[];
};
