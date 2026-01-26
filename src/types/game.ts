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
};
export type Unit = { id: string; typeId: string; ownerId: PlayerId; figures: number; resources: number; hasMoved: boolean; hasAttacked: boolean; movementUsed: number; };

export type Country = { id: string; name: string; };
export type Campaign = { id: string; name: string; };

export type TerrainType = {
  id: string;
  name: string;
  blocksLOS: boolean;
  movementRestriction?: 'stop' | 'no-move' | 'none';
  diceModifierDefenseInfantry: number;
  diceModifierDefenseTank: number;
  diceModifierAttackInfantry: number;
  diceModifierAttackTank: number;
  color?: string;
  description?: string;
};

export type OverlayType = {
  id: string;
  name: string;
  diceModifierDefense?: number;
  movementRestriction?: 'stop' | 'no-move' | 'none';
  blocksLOS?: boolean;
};

export type Objective = {
  type: 'permanent' | 'temporary';
  timing: 'immediate' | 'startOfTurn';
  points: number;
  controllingPlayerId?: PlayerId;
  validFor?: PlayerId | 'both';
};

export type Hex = {
  q: number;
  r: number;
  s: number;
  terrainTypeId: string;
  overlayTypeId?: string;
  unitId?: string;
  objective?: Objective;
};

export type Scenario = {
  id: string;
  name: string;
  description: string;
  boardWidth: number;
  boardHeight: number;
  sections: { leftWidth: number; centerWidth: number; rightWidth: number; };
  player1: { name: string; income: number; maxSectionResources: number; };
  player2: { name: string; income: number; maxSectionResources: number; };
  victoryPointsToWin: number;
  firstPlayerId: PlayerId;
  initialHexes: Hex[];
  initialUnits: Unit[];
  // New meta fields
  isRealBattle: boolean;
  year: number;
  countryId: string;
  campaignId?: string;
  campaignNumber?: number;
};

export type GamePhase = 'distribution-sections' | 'distribution-units' | 'movement' | 'attack' | 'gameOver';
export type GameState = { scenario: Scenario; currentTurn: number; activePlayerId: PlayerId; phase: GamePhase; sectionResources: { player1: { left: number; center: number; right: number }; player2: { left: number; center: number; right: number }; }; centralWarehouse: { player1: number; player2: number; }; units: Record<string, Unit>; grid: Record<string, Hex>; winner?: PlayerId; victoryPoints: { player1: number; player2: number; }; };
