import React from 'react'; import { axialToPixel, HEX_SIZE, terrainColor } from '../logic/hexGrid';
import NatoSymbol from './NatoSymbol';

const getHexPoints = (radius) => {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    pts.push({ x: radius * Math.cos(a), y: radius * Math.sin(a) });
  }
  return pts;
};
const HexGrid = ({ width, height, hexes, units, terrainTypes, unitTypes = [], onHexClick, onHexMouseEnter, onHexMouseLeave, leftWidth, centerWidth, selectedUnitId, highlightedHexes, hoveredHex, activePhase, unitSections, onSectionSelect, labelMode = 'below' }) => {
  const getTerrain = (id) => terrainTypes.find(t => t.id === id) || terrainTypes[0];
  const getUnitSymbol = (typeId) => unitTypes.find(ut => ut.id === typeId)?.natoSymbol || typeId;
  const padding = 60; const viewBoxWidth = (width + 0.5) * HEX_SIZE * Math.sqrt(3) + padding; const viewBoxHeight = (height * 1.5 - 0.5) * HEX_SIZE + padding;
  // Tři vrstvy kreslené v tomto pořadí: terén (interaktivní políčka) → popisky →
  // jednotky. Popisky vždy přesahují přes okraje sousedních políček (nejsou
  // ořezané); podle `labelMode` se kreslí buď pod jednotkami ('below'), nad nimi
  // ('above'), nebo se nekreslí vůbec ('hidden').
  const terrainLayer = [];
  const labelLayer = [];
  const unitLayer = [];
  for (let r = 0; r < height; r++) {
    const rowWidth = r % 2 === 0 ? width : width - 1;
    for (let col = 0; col < rowWidth; col++) {
      const q = col - Math.floor(r / 2); const key = `${q},${r}`; const hex = hexes[key]; const unit = hex?.unitId ? units[hex.unitId] : null; const terrain = hex ? getTerrain(hex.terrainTypeId) : getTerrain('grass'); const { x, y } = axialToPixel(q, r);
      const isSelected = hex?.unitId && hex.unitId === selectedUnitId;
      const highlight = highlightedHexes?.[key];
      const isHovered = hoveredHex === key;
      const pts = []; for (let i = 0; i < 6; i++) { const a = (Math.PI / 180) * (60 * i - 30); pts.push(`${x + HEX_SIZE * Math.cos(a)},${y + HEX_SIZE * Math.sin(a)}`); }
      terrainLayer.push(
        <g key={key} data-testid={`hex-${q}-${r}`} onClick={() => onHexClick?.(q, r)} onMouseEnter={() => onHexMouseEnter?.(q, r)} onMouseLeave={() => onHexMouseLeave?.(q, r)} className="cursor-pointer">
          <polygon points={pts.join(' ')} fill={terrainColor(terrain?.color)} stroke="#5b4f37" strokeWidth="0.8" className="transition-[filter] hover:brightness-110" />
          {highlight && <polygon points={pts.join(' ')} fill={highlight === 'move' ? "rgba(58,166,87,0.32)" : "rgba(192,57,43,0.28)"} stroke={highlight === 'move' ? "#2c7d42" : "#c0392b"} strokeWidth={highlight === 'move' ? "2.5" : "3"} className="pointer-events-none" />}
          {isHovered && !highlight && (activePhase === 'movement' || activePhase === 'attack') && selectedUnitId && <polygon points={pts.join(' ')} fill="rgba(192,57,43,0.4)" className="pointer-events-none" />}
          {isHovered && highlight && <polygon points={pts.join(' ')} fill={highlight === 'move' ? "rgba(58,166,87,0.5)" : "rgba(192,57,43,0.5)"} className="pointer-events-none" />}
          {isSelected && <polygon points={pts.join(' ')} fill="none" stroke="#ffce4a" strokeWidth="7" opacity="0.65" className="pointer-events-none" />}
          {isSelected && <polygon points={pts.join(' ')} fill="none" stroke="#fff" strokeWidth="3" className="pointer-events-none" />}
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
          {hex?.overlayTypeId === 'bunker' && (
            <g transform={`translate(${x}, ${y})`}>
              <polygon points={getHexPoints(HEX_SIZE - 4).map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#666" strokeWidth="6" strokeLinecap="round" />
              {hex.overlayOwnerId && (
                <polygon points={getHexPoints(HEX_SIZE - 6).map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke={hex.overlayOwnerId === 'player1' ? '#1e40af' : '#b91c1c'} strokeWidth="1.5" strokeLinecap="round" />
              )}
            </g>
          )}
          {hex?.objective && (
            <g transform={`translate(${x}, ${y-35})`}>
               {hex.objective.groupId && (
                 <circle r="13" fill="none" stroke="#7c3aed" strokeWidth="1" strokeDasharray="2 1.5" />
               )}
               <circle r="10" fill={hex.objective.controllingPlayerId === 'player1' ? '#1e40af' : (hex.objective.controllingPlayerId === 'player2' ? '#b91c1c' : 'white')} stroke="black" strokeWidth="0.5" opacity={hex.objective.controllingPlayerId ? 1 : 0.1} />
               <polygon points="0,-8 2,-2 8,-2 3,1 5,7 0,3 -5,7 -3,1 -8,-2 -2,-2"
                        fill={hex.objective.validFor === 'player1' ? '#1e40af' : (hex.objective.validFor === 'player2' ? '#b91c1c' : '#ffd700')}
                        stroke={(!hex.objective.validFor || hex.objective.validFor === 'both') ? "black" : "white"} strokeWidth="0.5" />
               <text y="20" textAnchor="middle" fontSize="8" fontWeight="bold" fill="black" className="bg-white/50">{hex.objective.points} VP</text>
               {hex.objective.groupId && (
                 <text y="-13" textAnchor="middle" fontSize="6" fontWeight="bold" fill="#7c3aed">
                   {hex.objective.condition === 'any' ? '≥1' : (hex.objective.condition === 'majority' ? '>½' : 'VŠE')}
                 </text>
               )}
            </g>
          )}
        </g>
      );

      // Popisek políčka – vlastní vrstva nad terénem, ať přesahuje přes okraje
      // sousedních políček a není ořezaný. Nenápadný styl s lehkým bílým lemem
      // pro čitelnost; neblokuje kliknutí na políčko.
      if (labelMode !== 'hidden' && hex?.label) {
        labelLayer.push(
          <text key={`lbl-${key}`} x={x} y={y} textAnchor="middle" dominantBaseline="middle"
                fontSize="9" fontWeight="500" letterSpacing="0.3" fill="#3f3f46"
                stroke="white" strokeWidth="2" paintOrder="stroke"
                className="select-none pointer-events-none">
            {hex.label}
          </text>
        );
      }

      if (unit) {
        unitLayer.push(
          <g key={`unit-${key}`} transform={`translate(${x}, ${y})`} style={{ pointerEvents: 'none' }}>
             <NatoSymbol type={getUnitSymbol(unit.typeId)} owner={unit.ownerId} />
             <g transform="translate(0, 18)">{Array.from({ length: unit.figures }).map((_, i) => <circle key={i} cx={(i - (unit.figures-1)/2) * 6} cy="0" r="2.2" fill={unit.ownerId === 'player1' ? '#1e40af' : '#b91c1c'} />)}</g>
             {unit.resources > 0 && <g transform="translate(0, -20)">{Array.from({ length: unit.resources }).map((_, i) => <rect key={i} x={(i - (unit.resources-1)/2) * 7 - 2.5} y="-2.5" width="5" height="5" rx="1" fill="#3aa657" stroke="#2c7d42" strokeWidth="0.8" />)}</g>}
          </g>
        );
      }
      if (isSelected && activePhase === 'distribution-units' && unitSections?.length > 1) {
        unitLayer.push(
          <g key={`sec-${key}`} transform={`translate(${x}, ${y})`}>
             <g onClick={(e) => { e.stopPropagation(); onSectionSelect?.(unitSections[0]); }} className="cursor-pointer hover:scale-110 transition-transform">
               <path d="M-48,0 L-30,-12 L-30,12 Z" fill={units[selectedUnitId]?.ownerId === 'player1' ? "#1e40af" : "#b91c1c"} stroke="white" strokeWidth="1.5" />
             </g>
             <g onClick={(e) => { e.stopPropagation(); onSectionSelect?.(unitSections[1]); }} className="cursor-pointer hover:scale-110 transition-transform">
               <path d="M48,0 L30,-12 L30,12 Z" fill={units[selectedUnitId]?.ownerId === 'player1' ? "#1e40af" : "#b91c1c"} stroke="white" strokeWidth="1.5" />
             </g>
          </g>
        );
      }
    }
  }
  const sqrt3 = Math.sqrt(3);
  const dX1 = (leftWidth - 0.5) * HEX_SIZE * sqrt3; const dX2 = (leftWidth + centerWidth - 0.5) * HEX_SIZE * sqrt3;
  const rightEdgeX = (width - 0.5) * HEX_SIZE * sqrt3;
  // Headroom above the board so the LEVÁ / STŘED / PRAVÁ section labels are not clipped.
  const labelSpace = 48;
  const sectionLabels = [
    { t: 'LEVÁ', x: dX1 / 2 },
    { t: 'STŘED', x: (dX1 + dX2) / 2 },
    { t: 'PRAVÁ', x: (dX2 + rightEdgeX) / 2 },
  ];
  return (
    <svg width="100%" height="100%" viewBox={`0 ${-labelSpace} ${viewBoxWidth} ${viewBoxHeight + labelSpace}`} className="max-h-full mx-auto bg-transparent" style={{ filter: 'drop-shadow(0 8px 14px rgba(60,45,20,.22))' }}>
      <g transform={`translate(${padding/2}, ${padding/2})`}>
        {terrainLayer}
        <line x1={dX1} y1={-HEX_SIZE} x2={dX1} y2={viewBoxHeight} stroke="#1c3f6b" strokeWidth="2.5" strokeDasharray="9,6" opacity="0.34" className="pointer-events-none" />
        <line x1={dX2} y1={-HEX_SIZE} x2={dX2} y2={viewBoxHeight} stroke="#1c3f6b" strokeWidth="2.5" strokeDasharray="9,6" opacity="0.34" className="pointer-events-none" />
        {sectionLabels.map(s => (
          <text key={s.t} x={s.x} y={-(labelSpace - 16) - padding / 2} textAnchor="middle" fontFamily="'Barlow Condensed', sans-serif" fontSize="15" fontWeight="800" letterSpacing="3" fill="#8a7a52" className="pointer-events-none select-none">{s.t}</text>
        ))}
        {labelMode === 'below' && labelLayer}
        {unitLayer}
        {labelMode === 'above' && labelLayer}
      </g>
    </svg>
  );
};
export default HexGrid;
