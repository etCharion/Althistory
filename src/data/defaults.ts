export const DEFAULT_UNIT_TYPES = [
  { id: 'infantry', name: 'Pěchota', movement: 2, shootingRange: [3, 2, 1], canShootAfterMovingMax: 1, maxFigures: 4, natoSymbol: 'infantry' },
  { id: 'tank', name: 'Tank', movement: 3, shootingRange: [3, 3, 3], canShootAfterMovingMax: 3, maxFigures: 3, natoSymbol: 'tank' },
  { id: 'artillery', name: 'Dělostřelectvo', movement: 1, shootingRange: [3, 3, 2, 2, 1, 1], canShootAfterMovingMax: 0, maxFigures: 2, natoSymbol: 'artillery' }
];
export const DEFAULT_TERRAIN_TYPES = [
  { id: 'grass', name: 'Tráva', blocksLOS: false, diceModifierDefenseInfantry: 0, diceModifierDefenseTank: 0, diceModifierAttackInfantry: 0, diceModifierAttackTank: 0, color: '#91b94d' },
  { id: 'forest', name: 'Les', blocksLOS: true, movementRestriction: 'stop', diceModifierDefenseInfantry: 1, diceModifierDefenseTank: 2, diceModifierAttackInfantry: 0, diceModifierAttackTank: 0, color: '#4d7c2a', description: 'Zastavuje pohyb. Při útoku na jednotku v lese: Pěchota -1 kostka, Tank -2 kostky. Blokuje viditelnost.' },
  { id: 'town', name: 'Město', blocksLOS: true, movementRestriction: 'stop', diceModifierDefenseInfantry: 1, diceModifierDefenseTank: 2, diceModifierAttackInfantry: 0, diceModifierAttackTank: -2, color: '#9e9e9e', description: 'Zastavuje pohyb. Útok z města: Tank -2 kostky. Při útoku na jednotku ve městě: Pěchota -1 kostka, Tank -2 kostky. Blokuje viditelnost.' },
  { id: 'hill', name: 'Kopec', blocksLOS: true, diceModifierDefenseInfantry: 1, diceModifierDefenseTank: 1, diceModifierAttackInfantry: 0, diceModifierAttackTank: 0, color: '#d2b48c', description: 'Při útoku na jednotku na kopci: -1 kostka. Pokud jsou obě jednotky na stejném hřebenu, postih neplatí a vidí na sebe. Blokuje viditelnost.' },
  { id: 'river', name: 'Řeka', blocksLOS: false, movementRestriction: 'no-move', diceModifierDefenseInfantry: 0, diceModifierDefenseTank: 0, diceModifierAttackInfantry: 0, diceModifierAttackTank: 0, color: '#3b82f6', description: 'Neprůchodný terén. Neomezuje viditelnost.' },
  { id: 'bridge', name: 'Most', blocksLOS: false, diceModifierDefenseInfantry: 0, diceModifierDefenseTank: 0, diceModifierAttackInfantry: 0, diceModifierAttackTank: 0, color: '#a0522d', description: 'Umožňuje přechod přes řeku.' }
];

export const DEFAULT_OVERLAY_TYPES = [
  { id: 'sandbags', name: 'Pytle s pískem', diceModifierDefense: 1, description: 'Obranný bonus +1 kostka.' },
  { id: 'wire', name: 'Ostnatý drát', movementRestriction: 'stop', description: 'Zastavuje pohyb při vstupu.' }
];

export const DEFAULT_COUNTRIES = [
  { id: 'usa', name: 'USA' },
  { id: 'uk', name: 'Velká Británie' },
  { id: 'ussr', name: 'SSSR' },
  { id: 'germany', name: 'Německo' },
  { id: 'japan', name: 'Japonsko' },
  { id: 'italy', name: 'Itálie' }
];
