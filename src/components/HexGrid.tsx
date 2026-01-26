import React from 'react'; import { axialToPixel, HEX_SIZE } from '../logic/hexGrid';

const getHexPoints = (radius) => {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    pts.push({ x: radius * Math.cos(a), y: radius * Math.sin(a) });
  }
  return pts;
};

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
const HexGrid = ({ width, height, hexes, units, terrainTypes, unitTypes = [], onHexClick, onHexMouseEnter, onHexMouseLeave, leftWidth, centerWidth, selectedUnitId, highlightedHexes, hoveredHex, activePhase, unitSections, onSectionSelect }) => {
  const getTerrain = (id) => terrainTypes.find(t => t.id === id) || terrainTypes[0];
  const getUnitSymbol = (typeId) => unitTypes.find(ut => ut.id === typeId)?.natoSymbol || typeId;
  const padding = 60; const viewBoxWidth = (width + 0.5) * HEX_SIZE * Math.sqrt(3) + padding; const viewBoxHeight = (height * 1.5 + 0.5) * HEX_SIZE + padding;
  const allHexes = [];
  for (let r = 0; r < height; r++) {
    for (let col = 0; col < width; col++) {
      const q = col - Math.floor(r / 2); const key = `${q},${r}`; const hex = hexes[key]; const unit = hex?.unitId ? units[hex.unitId] : null; const terrain = hex ? getTerrain(hex.terrainTypeId) : getTerrain('grass'); const { x, y } = axialToPixel(q, r);
      const isSelected = hex?.unitId && hex.unitId === selectedUnitId;
      const highlight = highlightedHexes?.[key];
      const isHovered = hoveredHex === key;
      const pts = []; for (let i = 0; i < 6; i++) { const a = (Math.PI / 180) * (60 * i - 30); pts.push(`${x + HEX_SIZE * Math.cos(a)},${y + HEX_SIZE * Math.sin(a)}`); }
      allHexes.push(
        <g key={key} data-testid={`hex-${q}-${r}`} onClick={() => onHexClick?.(q, r)} onMouseEnter={() => onHexMouseEnter?.(q, r)} onMouseLeave={() => onHexMouseLeave?.(q, r)} className="cursor-pointer">
          <polygon points={pts.join(' ')} fill={terrain?.color || '#91b94d'} stroke={isSelected ? "white" : "#444"} strokeWidth={isSelected ? "4" : "0.5"} className="hover:filter hover:brightness-110" />
          {highlight && <polygon points={pts.join(' ')} fill={highlight === 'move' ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"} stroke={highlight === 'move' ? "#22c55e" : "#ef4444"} strokeWidth="2" strokeDasharray="4,2" />}
          {isHovered && !highlight && (activePhase === 'movement' || activePhase === 'attack') && selectedUnitId && <polygon points={pts.join(' ')} fill="rgba(239, 68, 68, 0.5)" />}
          {isHovered && highlight && <polygon points={pts.join(' ')} fill={highlight === 'move' ? "rgba(34, 197, 94, 0.5)" : "rgba(239, 68, 68, 0.5)"} />}
          {isSelected && <polygon points={pts.join(' ')} fill="none" stroke="black" strokeWidth="1" opacity="0.5" />}
          {hex?.overlayTypeId === 'sandbags' && (
            <g transform={`translate(${x}, ${y})`}>
              <polygon points={getHexPoints(HEX_SIZE - 4).map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#8b4513" strokeWidth="8" strokeDasharray="12,4" strokeLinecap="round" />
              <polygon points={getHexPoints(HEX_SIZE - 4).map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#a0522d" strokeWidth="4" strokeDasharray="12,4" strokeDashoffset="2" strokeLinecap="round" />
            </g>
          )}
          {hex?.overlayTypeId === 'wire' && (
            <g transform={`translate(${x}, ${y})`}>
               <polygon points={getHexPoints(HEX_SIZE - 6).map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#444" strokeWidth="1" strokeDasharray="2,4" />
               {(() => {
                 const pts = getHexPoints(HEX_SIZE - 6);
                 let d = "";
                 for (let i = 0; i < 6; i++) {
                   const p1 = pts[i];
                   const p2 = pts[(i+1)%6];
                   for (let j = 0; j <= 4; j++) {
                     const t = j / 4;
                     const mx = p1.x + (p2.x - p1.x) * t;
                     const my = p1.y + (p2.y - p1.y) * t;
                     const perpX = -(p2.y - p1.y);
                     const perpY = (p2.x - p1.x);
                     const len = Math.sqrt(perpX*perpX + perpY*perpY);
                     const offset = (j % 2 === 0 ? 3 : -3);
                     const nx = mx + (perpX / len) * offset;
                     const ny = my + (perpY / len) * offset;
                     if (i === 0 && j === 0) d += `M${nx},${ny}`; else d += ` L${nx},${ny}`;
                   }
                 }
                 return <path d={d} fill="none" stroke="#444" strokeWidth="1" />;
               })()}
            </g>
          )}
          {hex?.objective && (
            <g transform={`translate(${x}, ${y-35})`}>
               <circle r="10" fill={hex.objective.controllingPlayerId === 'player1' ? '#1e40af' : (hex.objective.controllingPlayerId === 'player2' ? '#b91c1c' : 'white')} stroke="black" strokeWidth="0.5" opacity={hex.objective.controllingPlayerId ? 1 : 0.1} />
               <polygon points="0,-8 2,-2 8,-2 3,1 5,7 0,3 -5,7 -3,1 -8,-2 -2,-2"
                        fill={hex.objective.validFor === 'player1' ? '#1e40af' : (hex.objective.validFor === 'player2' ? '#b91c1c' : '#ffd700')}
                        stroke={(!hex.objective.validFor || hex.objective.validFor === 'both') ? "black" : "white"} strokeWidth="0.5" />
               <text y="20" textAnchor="middle" fontSize="8" fontWeight="bold" fill="black" className="bg-white/50">{hex.objective.points} VP</text>
            </g>
          )}
          {unit && (
            <g transform={`translate(${x}, ${y})`}>
               <NatoSymbol type={getUnitSymbol(unit.typeId)} owner={unit.ownerId} />
               <g transform="translate(0, 18)">{Array.from({ length: unit.figures }).map((_, i) => <circle key={i} cx={(i - (unit.figures-1)/2) * 6} cy="0" r="2" fill="black" />)}</g>
               {unit.resources > 0 && <g transform="translate(0, -20)">{Array.from({ length: unit.resources }).map((_, i) => <circle key={i} cx={(i - (unit.resources-1)/2) * 8} cy="0" r="3" fill="#006400" stroke="white" strokeWidth="0.5" />)}</g>}
            </g>
          )}
          {isSelected && activePhase === 'distribution-units' && unitSections?.length > 1 && (
            <g transform={`translate(${x}, ${y})`} zIndex="100">
               <g onClick={(e) => { e.stopPropagation(); onSectionSelect?.(unitSections[0]); }} className="cursor-pointer hover:scale-110 transition-transform">
                 <path d="M-45,0 L-30,-10 L-30,10 Z" fill="#1e40af" stroke="white" strokeWidth="1" />
                 <text x="-38" y="22" fontSize="7" textAnchor="middle" fill="#1e40af" fontWeight="bold" className="uppercase pointer-events-none bg-white/80">{unitSections[0]}</text>
               </g>
               <g onClick={(e) => { e.stopPropagation(); onSectionSelect?.(unitSections[1]); }} className="cursor-pointer hover:scale-110 transition-transform">
                 <path d="M45,0 L30,-10 L30,10 Z" fill="#1e40af" stroke="white" strokeWidth="1" />
                 <text x="38" y="22" fontSize="7" textAnchor="middle" fill="#1e40af" fontWeight="bold" className="uppercase pointer-events-none bg-white/80">{unitSections[1]}</text>
               </g>
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
        <line x1={dX1} y1={-HEX_SIZE} x2={dX1} y2={viewBoxHeight} stroke="#1a3a5f" strokeWidth="3" strokeDasharray="10,5" opacity="0.3" className="pointer-events-none" />
        <line x1={dX2} y1={-HEX_SIZE} x2={dX2} y2={viewBoxHeight} stroke="#1a3a5f" strokeWidth="3" strokeDasharray="10,5" opacity="0.3" className="pointer-events-none" />
      </g>
    </svg>
  );
};
export default HexGrid;
