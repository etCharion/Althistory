export const DEFAULT_UNIT_TYPES = [
  { id: 'infantry', name: 'Pěchota', movement: 2, shootingRange: [3, 2, 1], canShootAfterMovingMax: 1, maxFigures: 4, natoSymbol: 'infantry', category: 'infantry' as const },
  { id: 'tank', name: 'Tank', movement: 3, shootingRange: [3, 3, 3], canShootAfterMovingMax: 3, maxFigures: 3, natoSymbol: 'tank', category: 'tank' as const },
  { id: 'artillery', name: 'Dělostřelectvo', movement: 1, shootingRange: [3, 3, 2, 2, 1, 1], canShootAfterMovingMax: 0, maxFigures: 2, natoSymbol: 'artillery', category: 'artillery' as const }
];
export const DEFAULT_TERRAIN_TYPES = [
  { id: 'grass', name: 'Tráva', blocksLOS: false, diceModifierDefenseInfantry: 0, diceModifierDefenseTank: 0, diceModifierAttackInfantry: 0, diceModifierAttackTank: 0, color: '#9caa5e' },
  { id: 'forest', name: 'Les', blocksLOS: true, movementRestriction: 'stop', diceModifierDefenseInfantry: 1, diceModifierDefenseTank: 2, diceModifierAttackInfantry: 0, diceModifierAttackTank: 0, color: '#5e7d44', description: 'Zastavuje pohyb. Při útoku na jednotku v lese: Pěchota -1 kostka, Tank -2 kostky. Blokuje viditelnost.' },
  { id: 'town', name: 'Město', blocksLOS: true, movementRestriction: 'stop', diceModifierDefenseInfantry: 1, diceModifierDefenseTank: 2, diceModifierAttackInfantry: 0, diceModifierAttackTank: -2, color: '#9c8e80', description: 'Zastavuje pohyb. Útok z města: Tank -2 kostky. Při útoku na jednotku ve městě: Pěchota -1 kostka, Tank -2 kostky. Blokuje viditelnost.' },
  { id: 'hill', name: 'Kopec', blocksLOS: true, diceModifierDefenseInfantry: 1, diceModifierDefenseTank: 1, diceModifierAttackInfantry: 0, diceModifierAttackTank: 0, color: '#c2a96a', description: 'Při útoku na jednotku na kopci: -1 kostka. Pokud jsou obě jednotky na stejném hřebenu, postih neplatí a vidí na sebe. Blokuje viditelnost.' },
  { id: 'river', name: 'Řeka', blocksLOS: false, movementRestriction: 'no-move', diceModifierDefenseInfantry: 0, diceModifierDefenseTank: 0, diceModifierAttackInfantry: 0, diceModifierAttackTank: 0, color: '#6fa0c2', description: 'Neprůchodný terén. Neomezuje viditelnost.' },
  { id: 'bridge', name: 'Most', blocksLOS: true, diceModifierDefenseInfantry: 0, diceModifierDefenseTank: 0, diceModifierAttackInfantry: 0, diceModifierAttackTank: 0, color: '#a0764a', description: 'Umožňuje přechod přes řeku. Blokuje viditelnost.' }
];

export const DEFAULT_OVERLAY_TYPES = [
  { id: 'sandbags', name: 'Pytle s pískem', diceModifierDefense: 1, ignoreFlags: 1, color: '#8b4513', description: 'Obranný bonus +1 kostka. Ignoruje 1 vlajku. Zničeny při opuštění pole.' },
  { id: 'wire', name: 'Ostnatý drát', movementRestriction: 'stop', diceModifierAttackInfantry: -1, diceModifierAttackArtillery: -1, color: '#808080', description: 'Zastavuje pohyb. Pěchota a dělostřelectvo: -1 kostka při útoku z tohoto pole. Tanky drát při vstupu zničí.' },
  {
    id: 'bunker',
    name: 'Bunkr',
    diceModifierDefenseInfantry: 1,
    diceModifierDefenseTank: 2,
    ignoreFlags: 1,
    impassableForCategories: ['tank', 'artillery'] as any,
    noRetreatCategories: ['artillery'] as any,
    cannotLeaveCategories: ['artillery'] as any,
    onlyBonusForOwner: true,
    allowAttackAfterStop: true,
    color: '#808080',
    description: 'Obranný bonus: Pěchota +1, Tank +2. Ignoruje 1 vlajku. Neprůchodné pro tanky a dělostřelectvo. Dělostřelectvo v bunkru nemůže ustoupit ani z něj vyjít. Bonus platí pouze pro majitele.'
  },
  { id: 'barrier', name: 'Zátaras', movementRestriction: 'stop', color: '#808080', description: 'Zastavuje pohyb. Na mapě znázorněn šedě s malými křížky (X) po stranách.' }
];

export const DEFAULT_COUNTRIES = [
  { id: 'usa', name: 'USA' },
  { id: 'uk', name: 'Velká Británie' },
  { id: 'ussr', name: 'SSSR' },
  { id: 'germany', name: 'Německo' },
  { id: 'japan', name: 'Japonsko' },
  { id: 'italy', name: 'Itálie' }
];
