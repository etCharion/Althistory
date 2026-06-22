import React from 'react'; import { motion } from 'framer-motion';

// Per-face accent colours, matching the field-map design language.
const FACE_COLOR: Record<string, string> = {
  infantry: '#1c3f6b',
  tank: '#2c2c2c',
  grenade: '#c0392b',
  flag: '#7a6f55',
  star: '#c98a10',
};

const DiceIcon = ({ symbol }) => {
  switch (symbol) {
    case 'infantry':
      return (
        <svg viewBox="0 0 24 24" width="34" height="34" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.5 17.5L3 6V3h3l11.5 11.5" />
          <path d="M13 19l6-6" />
          <path d="M16 22l5-5" />
        </svg>
      );
    case 'tank':
      return (
        <svg viewBox="0 0 24 24" width="34" height="34" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="8" rx="2" />
          <path d="M7 11V7h10v4" />
          <circle cx="7" cy="15" r="1" fill="currentColor" />
          <circle cx="12" cy="15" r="1" fill="currentColor" />
          <circle cx="17" cy="15" r="1" fill="currentColor" />
        </svg>
      );
    case 'grenade':
      return (
        <svg viewBox="0 0 24 24" width="34" height="34" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="13" r="7" />
          <path d="M15 9l5-5" />
          <path d="M17 3l4 4" />
          <path d="M10 6c0-1 1-2 2-2s2 1 2 2" />
        </svg>
      );
    case 'flag':
      return (
        <svg viewBox="0 0 24 24" width="34" height="34" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
          <line x1="4" y1="22" x2="4" y2="15" />
        </svg>
      );
    case 'star':
      return (
        <svg viewBox="0 0 24 24" width="34" height="34" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      );
    default:
      return <span>{symbol}</span>;
  }
};

const DiceAnimation = ({ dice, onComplete }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="fixed inset-0 flex items-center justify-center z-50 cursor-pointer"
    style={{ background: 'rgba(20,28,40,.42)' }}
    onClick={onComplete}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      className="flex flex-col items-center gap-4 px-8 py-7 rounded-[20px] cursor-default"
      style={{ background: 'rgba(255,252,244,.97)', border: '2px solid #c4b289', boxShadow: '0 28px 70px -18px rgba(15,23,42,.65)' }}
    >
      <span className="font-condensed font-extrabold text-[13px] tracking-[0.2em] uppercase text-tan">Hod kostkami</span>
      <div className="flex flex-wrap gap-3 justify-center max-w-[440px]">
        {dice.map((d, i) => {
          const color = FACE_COLOR[d] || '#7a6f55';
          return (
            <div
              key={i}
              className="w-[62px] h-[62px] rounded-[13px] flex items-center justify-center"
              style={{
                background: '#fffdf7',
                border: `3px solid ${color}`,
                color,
                boxShadow: '0 8px 20px -6px rgba(0,0,0,.45)',
                animation: `diceSpin 0.45s cubic-bezier(.2,.8,.3,1) ${0.14 * i}s both`,
              }}
            >
              <DiceIcon symbol={d} />
            </div>
          );
        })}
        {dice.length === 0 && <p className="text-base font-bold text-tan-text">Žádné kostky!</p>}
      </div>
      <span className="text-[11px] italic text-tan">Klikni pro pokračování</span>
    </div>
  </motion.div>
);
export default DiceAnimation;
