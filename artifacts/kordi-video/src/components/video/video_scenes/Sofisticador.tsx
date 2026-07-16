import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

export function Sofisticador() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 400),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 2800), // sofisticar
      setTimeout(() => setPhase(4), 4800),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center px-[10vw]"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.1 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.h2 
        className="text-[4vw] font-bold text-white mb-[4vh] text-center"
        initial={{ opacity: 0, y: -30 }}
        animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: -30 }}
        transition={{ duration: 0.6 }}
      >
        <span className="text-gradient">Sofisticador</span> de Cifras
      </motion.h2>

      <motion.div 
        className="flex items-center gap-[4vw] w-full max-w-[60vw]"
        initial={{ opacity: 0, y: 30 }}
        animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
        transition={{ duration: 0.6 }}
      >
        <div className="flex-1 bg-white/5 p-[3vw] rounded-2xl border border-white/10 flex flex-col items-center">
          <span className="text-white/50 text-[1.5vw] mb-[1vh]">Simples</span>
          <div className="text-[3.5vw] font-mono font-bold text-white">E</div>
        </div>

        <motion.div 
          className="text-primary text-[3vw]"
          initial={{ scale: 0.8, opacity: 0.5 }}
          animate={phase >= 3 ? { scale: 1.2, opacity: 1, x: [0, 10, 0] } : { scale: 0.8, opacity: 0.5 }}
          transition={{ duration: 0.4 }}
        >
          →
        </motion.div>

        <div className="flex-1 bg-primary/10 p-[3vw] rounded-2xl border border-primary/30 flex flex-col items-center relative overflow-hidden">
          <span className="text-primary text-[1.5vw] mb-[1vh]">Rico</span>
          <motion.div 
            className="text-[3.5vw] font-mono font-bold text-white"
            initial={{ y: 20, opacity: 0 }}
            animate={phase >= 3 ? { y: 0, opacity: 1 } : { y: 20, opacity: 0 }}
            transition={{ type: 'spring', delay: 0.2 }}
          >
            Emaj7(9)
          </motion.div>
          {phase >= 3 && (
            <motion.div 
              className="absolute inset-0 bg-primary/20 pointer-events-none"
              initial={{ opacity: 1 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
            />
          )}
        </div>
      </motion.div>

      <motion.p
        className="text-[2vw] text-white/70 mt-[4vh] text-center"
        initial={{ opacity: 0 }}
        animate={phase >= 3 ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
      >
        Acordes simples viram arranjos profissionais.
      </motion.p>
    </motion.div>
  );
}
