export const DEFAULT_UNIT_TYPES = [
  { id: 'infantry', name: 'Pěchota', movement: 2, shootingRange: [3, 2, 1], canShootAfterMovingMax: 1, maxFigures: 4, natoSymbol: 'infantry' },
  { id: 'tank', name: 'Tank', movement: 3, shootingRange: [3, 3, 3], canShootAfterMovingMax: 3, maxFigures: 3, natoSymbol: 'tank' },
  { id: 'artillery', name: 'Dělostřelectvo', movement: 1, shootingRange: [3, 3, 2, 2, 1, 1], canShootAfterMovingMax: 0, maxFigures: 2, natoSymbol: 'artillery' }
];
export const DEFAULT_TERRAIN_TYPES = [
  { id: 'grass', name: 'Tráva', blocksLOS: false, diceModifierDefense: 0, diceModifierAttack: 0, color: '#91b94d' },
  { id: 'forest', name: 'Les', blocksLOS: true, movementRestriction: 'stop', diceModifierDefense: 1, diceModifierAttack: -1, color: '#4d7c2a' },
  { id: 'town', name: 'Město', blocksLOS: true, movementRestriction: 'stop', diceModifierDefense: 2, diceModifierAttack: -1, color: '#9e9e9e' }
];
