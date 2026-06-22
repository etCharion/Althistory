import React from 'react'; import { motion } from 'framer-motion';
const DiceIcon = ({ symbol }) => {
  switch (symbol) {
    case 'infantry':
      return (
        <svg viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" fill="none" strokeWidth="2">
          <path d="M14.5 17.5L3 6V3h3l11.5 11.5" />
          <path d="M13 19l6-6" />
          <path d="M16 22l5-5" />
        </svg>
      );
    case 'tank':
      return (
        <svg viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" fill="none" strokeWidth="2">
          <rect x="3" y="11" width="18" height="8" rx="2" />
          <path d="M7 11V7h10v4" />
          <circle cx="7" cy="15" r="1" fill="currentColor" />
          <circle cx="12" cy="15" r="1" fill="currentColor" />
          <circle cx="17" cy="15" r="1" fill="currentColor" />
        </svg>
      );
    case 'grenade':
      return (
        <svg viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" fill="none" strokeWidth="2">
          <circle cx="11" cy="13" r="7" />
          <path d="M15 9l5-5" />
          <path d="M17 3l4 4" />
          <path d="M10 6c0-1 1-2 2-2s2 1 2 2" />
        </svg>
      );
    case 'flag':
      return (
        <svg viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" fill="none" strokeWidth="2">
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
          <line x1="4" y1="22" x2="4" y2="15" />
        </svg>
      );
    case 'star':
      return (
        <svg viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" fill="none" strokeWidth="2">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      );
    default:
      return <span>{symbol}</span>;
  }
};

const DiceAnimation = ({ dice, onComplete }) => (
  <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} className="fixed inset-0 flex items-center justify-center bg-black/50 z-50" onClick={onComplete}>
    <div className="bg-white p-8 rounded-lg shadow-2xl flex flex-wrap gap-4 justify-center">
      {dice.map((d, i) => (
        <motion.div
          key={i}
          initial={{ rotate: 0 }}
          animate={{ rotate: 360 }}
          transition={{ duration: 0.5, delay: i * 0.1 }}
          className={`w-16 h-16 border-2 border-black rounded flex items-center justify-center bg-gray-100 ${d === 'star' ? 'text-gray-400' : 'text-black'}`}
        >
          <DiceIcon symbol={d} />
        </motion.div>
      ))}
      {dice.length === 0 && <p className="text-xl">Žádné kostky!</p>}
    </div>
  </motion.div>
);
export default DiceAnimation;
