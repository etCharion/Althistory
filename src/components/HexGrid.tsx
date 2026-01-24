import React from 'react'; import { axialToPixel, HEX_SIZE } from '../logic/hexGrid';
const NatoSymbol = ({ type, owner }) => {
  const color = owner === 'player1' ? '#1e40af' : '#b91c1c';
  return (
    <g>
      <rect x="-18" y="-12" width="36" height="24" fill="white" stroke={color} strokeWidth="2" />
      {type === 'infantry' && <path d="M-18,-12 L18,12 M18,-12 L-18,12" stroke={color} strokeWidth="1" />}
      {type === 'tank' && <ellipse cx="0" cy="0" rx="12" ry="6" fill="none" stroke={color} strokeWidth="2" />}
      {type === 'artillery' && <circle cx="0" cy="0" r="3" fill={color} />}
      {['infantry', 'tank', 'artillery'].indexOf(type) === -1 && <text y="5" textAnchor="middle" fontSize="10" fill={color}>{type[0].toUpperCase()}</text>}
    </g>
  );
};
const HexGrid = ({ width, height, hexes, units, terrainTypes, onHexClick, leftWidth, centerWidth }) => {
  const getTerrain = (id) => terrainTypes.find(t => t.id === id) || terrainTypes[0];
  const padding = 60; const viewBoxWidth = (width + 0.5) * HEX_SIZE * Math.sqrt(3) + padding; const viewBoxHeight = (height * 1.5 + 0.5) * HEX_SIZE + padding;
  const allHexes = [];
  for (let r = 0; r < height; r++) {
    for (let col = 0; col < width; col++) {
      const q = col - Math.floor(r / 2); const key = `${q},${r}`; const hex = hexes[key]; const unit = hex?.unitId ? units[hex.unitId] : null; const terrain = hex ? getTerrain(hex.terrainTypeId) : getTerrain('grass'); const { x, y } = axialToPixel(q, r);
      const pts = []; for (let i = 0; i < 6; i++) { const a = (Math.PI / 180) * (60 * i - 30); pts.push(`${x + HEX_SIZE * Math.cos(a)},${y + HEX_SIZE * Math.sin(a)}`); }
      allHexes.push(
        <g key={key} onClick={() => onHexClick?.(q, r)} className="cursor-pointer">
          <polygon points={pts.join(' ')} fill={terrain?.color || '#91b94d'} stroke="#444" strokeWidth="0.5" className="hover:filter hover:brightness-110" />
          {unit && (
            <g transform={`translate(${x}, ${y})`}>
               <NatoSymbol type={unit.typeId} owner={unit.ownerId} />
               <g transform="translate(0, 18)">{Array.from({ length: unit.figures }).map((_, i) => <circle key={i} cx={(i - (unit.figures-1)/2) * 6} cy="0" r="2" fill="black" />)}</g>
               {unit.resources > 0 && <g transform="translate(0, -20)">{Array.from({ length: unit.resources }).map((_, i) => <circle key={i} cx={(i - (unit.resources-1)/2) * 8} cy="0" r="3" fill="#006400" stroke="white" strokeWidth="0.5" />)}</g>}
            </g>
          )}
        </g>
      );
    }
  }
  const dX1 = (leftWidth - 0.5) * HEX_SIZE * Math.sqrt(3); const dX2 = (leftWidth + centerWidth - 0.5) * HEX_SIZE * Math.sqrt(3);
  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`} className="max-h-full mx-auto drop-shadow-md bg-transparent">
      <g transform={`translate(${padding/2}, ${padding/2})`}>
        {allHexes}
        <line x1={dX1} y1={-HEX_SIZE} x2={dX1} y2={viewBoxHeight} stroke="#1a3a5f" strokeWidth="3" strokeDasharray="10,5" opacity="0.3" />
        <line x1={dX2} y1={-HEX_SIZE} x2={dX2} y2={viewBoxHeight} stroke="#1a3a5f" strokeWidth="3" strokeDasharray="10,5" opacity="0.3" />
      </g>
    </svg>
  );
};
export default HexGrid;
