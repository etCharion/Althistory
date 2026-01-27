import React from 'react';

interface NatoSymbolProps {
  type: string;
  owner: 'player1' | 'player2';
}

const NatoSymbol: React.FC<NatoSymbolProps> = ({ type, owner }) => {
  const color = owner === 'player1' ? '#1e40af' : '#b91c1c';

  const renderIcon = () => {
    switch (type) {
      case 'infantry':
        return <path d="M-18,-12 L18,12 M18,-12 L-18,12" stroke={color} strokeWidth="1" />;
      case 'tank':
        return <ellipse cx="0" cy="0" rx="12" ry="6" fill="none" stroke={color} strokeWidth="2" />;
      case 'artillery':
        return <circle cx="0" cy="0" r="3" fill={color} />;
      case 'sof':
        return (
          <>
            <path d="M-18,-12 L18,12 M18,-12 L-18,12" stroke={color} strokeWidth="1" />
            <text y="4" x="0" textAnchor="middle" fontSize="8" fontWeight="bold" fill={color} style={{ pointerEvents: 'none' }}>SF</text>
          </>
        );
      case 'engineers':
        return <path d="M-12,4 L-12,-4 L-6,-4 L-6,4 M6,4 L6,-4 L12,-4 L12,4 M-6,0 L6,0" fill="none" stroke={color} strokeWidth="2" />;
      case 'mortar':
        return (
          <>
            <path d="M-6,6 L0,-2 L6,6" fill="none" stroke={color} strokeWidth="2" />
            <circle cx="0" cy="-6" r="2" fill={color} />
          </>
        );
      case 'hmg':
        return (
          <>
            <path d="M0,8 L0,-6 M-4,-2 L4,-2 M-6,2 L6,2" fill="none" stroke={color} strokeWidth="2" />
            <path d="M-3,-6 L0,-10 L3,-6" fill="none" stroke={color} strokeWidth="1.5" />
          </>
        );
      case 'anti-tank':
        return <path d="M-12,8 L0,-4 L12,8" fill="none" stroke={color} strokeWidth="2" />;
      case 'sniper':
        return (
          <>
            <path d="M-18,-12 L18,12 M18,-12 L-18,12" stroke={color} strokeWidth="1" opacity="0.3" />
            <circle cx="0" cy="0" r="8" fill="none" stroke={color} strokeWidth="1.5" />
            <path d="M-10,0 L10,0 M0,-10 L0,10" stroke={color} strokeWidth="1" />
          </>
        );
      case 'tank-destroyer':
        return (
          <>
            <ellipse cx="0" cy="0" rx="12" ry="6" fill="none" stroke={color} strokeWidth="2" />
            <path d="M-18,12 L18,-12" stroke={color} strokeWidth="2" />
          </>
        );
      case 'elite-tank':
        return (
          <>
            <ellipse cx="0" cy="2" rx="12" ry="6" fill="none" stroke={color} strokeWidth="2" />
            <polygon points="0,-12 1.5,-8 5,-8 2,-5.5 3,-2 0,-4.5 -3,-2 -2,-5.5 -5,-8 -1.5,-8" fill={color} />
          </>
        );
      case 'flame-tank':
        return (
          <>
            <ellipse cx="0" cy="0" rx="12" ry="6" fill="none" stroke={color} strokeWidth="2" />
            <path d="M0,-2 Q4,-8 0,-12 Q-4,-8 0,-2" fill={color} />
          </>
        );
      case 'mobile-artillery':
        return (
          <>
            <circle cx="0" cy="-2" r="3" fill={color} />
            <path d="M-10,8 A3,3 0 1,0 -4,8 M4,8 A3,3 0 1,0 10,8" fill="none" stroke={color} strokeWidth="2" />
          </>
        );
      case 'rocket-artillery':
        return (
          <>
            <circle cx="0" cy="4" r="3" fill={color} />
            <path d="M-6,0 L-6,-8 M0,0 L0,-10 M6,0 L6,-8" stroke={color} strokeWidth="2" />
          </>
        );
      case 'long-range-artillery':
        return (
          <>
            <circle cx="0" cy="0" r="3" fill={color} />
            <path d="M-15,0 L15,0" stroke={color} strokeWidth="1.5" strokeDasharray="2,2" />
          </>
        );
      case 'anti-aircraft':
        return (
          <>
            <path d="M-12,8 A12,12 0 0,1 12,8" fill="none" stroke={color} strokeWidth="2" />
            <path d="M0,8 L0,-4" stroke={color} strokeWidth="2" />
          </>
        );
      case 'partisans':
        return <text y="6" x="0" textAnchor="middle" fontSize="16" fontWeight="bold" fill={color}>P</text>;
      case 'half-track':
        return (
          <>
            <rect x="-12" y="-4" width="24" height="8" fill="none" stroke={color} strokeWidth="1" />
            <circle cx="-8" cy="8" r="2" fill={color} />
            <path d="M0,8 L10,8" stroke={color} strokeWidth="2" />
          </>
        );
      case 'mobile-infantry':
        return (
          <>
            <path d="M-18,-12 L18,12 M18,-12 L-18,12" stroke={color} strokeWidth="1" />
            <path d="M-10,10 A2,2 0 1,0 -6,10 M6,10 A2,2 0 1,0 10,10" fill={color} />
          </>
        );
      case 'command-vehicle':
        return (
          <>
            <path d="M-18,0 L18,0 M0,-12 L0,12" stroke={color} strokeWidth="1" />
            <text y="-2" x="2" fontSize="6" fontWeight="bold" fill={color}>HQ</text>
          </>
        );
      case 'supply':
        return <text y="6" x="0" textAnchor="middle" fontSize="16" fontWeight="bold" fill={color}>S</text>;
      case 'ambulance':
        return <path d="M-8,0 L8,0 M0,-8 L0,8" stroke={color} strokeWidth="3" />;
      case 'cavalry':
        return <path d="M-18,12 L18,-12" stroke={color} strokeWidth="2" />;
      case 'mountain':
        return (
          <>
            <path d="M-18,-12 L18,12 M18,-12 L-18,12" stroke={color} strokeWidth="1" />
            <path d="M-12,12 L-6,4 L0,12 L6,4 L12,12" fill="none" stroke={color} strokeWidth="1.5" />
          </>
        );
      case 'landing':
        return (
          <>
            <path d="M0,-8 L0,4 M-4,0 L4,0" stroke={color} strokeWidth="2" />
            <path d="M-6,4 A6,6 0 0,0 6,4" fill="none" stroke={color} strokeWidth="2" />
          </>
        );
      case 'paratroopers':
        return (
          <>
            <path d="M-18,-12 L18,12 M18,-12 L-18,12" stroke={color} strokeWidth="1" />
            <path d="M-10,4 A10,10 0 0,1 10,4" fill="none" stroke={color} strokeWidth="1.5" />
            <path d="M-10,4 L0,10 L10,4" fill="none" stroke={color} strokeWidth="1" />
          </>
        );
      default:
        return <text y="5" textAnchor="middle" fontSize="10" fill={color}>{type[0]?.toUpperCase() || '?'}</text>;
    }
  };

  return (
    <g>
      <rect x="-18" y="-12" width="36" height="24" fill="white" stroke={color} strokeWidth="2" />
      {renderIcon()}
    </g>
  );
};

export default NatoSymbol;
