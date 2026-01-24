import React from 'react'; import { motion } from 'framer-motion';
const DiceAnimation = ({ dice, onComplete }) => (
  <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} className="fixed inset-0 flex items-center justify-center bg-black/50 z-50" onClick={onComplete}>
    <div className="bg-white p-8 rounded-lg shadow-2xl flex flex-wrap gap-4 justify-center">
      {dice.map((d, i) => (<motion.div key={i} initial={{ rotate: 0 }} animate={{ rotate: 360 }} transition={{ duration: 0.5, delay: i * 0.1 }} className="w-16 h-16 border-2 border-black rounded flex items-center justify-center bg-gray-100 text-xl font-bold">{d[0].toUpperCase()}</motion.div>))}
      {dice.length === 0 && <p className="text-xl">Žádné kostky!</p>}
    </div>
  </motion.div>
);
export default DiceAnimation;
