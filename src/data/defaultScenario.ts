import { offsetToAxial } from '../logic/hexGrid';

const q1 = offsetToAxial(1, 1);
const q2 = offsetToAxial(10, 6);

export const DEFAULT_SCENARIO = {
  id: 'default-1',
  name: 'První střet',
  description: 'Základní ukázkový scénář.',
  boardWidth: 13,
  boardHeight: 9,
  sections: {
    leftWidth: 4,
    centerWidth: 5,
    rightWidth: 4
  },
  player1: {
    name: 'Spojenci',
    income: 8,
    maxSectionResources: 12
  },
  player2: {
    name: 'Osa',
    income: 8,
    maxSectionResources: 12
  },
  victoryPointsToWin: 2,
  firstPlayerId: 'player1',
  initialHexes: [
    { ...q1, s: -q1.q - q1.r, terrainTypeId: 'grass', unitId: 'u1' },
    { ...q2, s: -q2.q - q2.r, terrainTypeId: 'grass', unitId: 'u2' }
  ],
  initialUnits: [
    { id: 'u1', typeId: 'infantry', ownerId: 'player1', figures: 4, resources: 0, hasMoved: false, hasAttacked: false },
    { id: 'u2', typeId: 'infantry', ownerId: 'player2', figures: 4, resources: 0, hasMoved: false, hasAttacked: false }
  ]
};
