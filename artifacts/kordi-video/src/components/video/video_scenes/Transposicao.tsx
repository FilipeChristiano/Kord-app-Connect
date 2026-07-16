import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

export function Transposicao() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 400),
      setTimeout(() => setPhase(2), 1500), // chord appears
      setTimeout(() => setPhase(3), 2800), // change key
      setTimeout(() => setPhase(4), 5200), // exit
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center px-[10vw]"
      initial={{ opacity: 0, x: '20vw' }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: '-20vw' }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="w-1/2 z-10 pr-[5vw]">
        <motion.h2 
          className="text-[4vw] font-bold text-white leading-tight"
          initial={{ opacity: 0, y: 30 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6 }}
        >
          Qualquer cifra.<br/>
          <span className="text-gradient">Em qualquer tom.</span>
        </motion.h2>
        <motion.p
          className="text-[2vw] text-white/70 mt-[2vh]"
          initial={{ opacity: 0, y: 20 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          Busque e transponha com 1 toque.
        </motion.p>
      </div>

      <div className="w-1/2 flex items-center justify-center relative">
        <motion.div 
          className="bg-white/5 border border-white/10 rounded-2xl p-[4vw] flex items-center justify-center relative overflow-hidden"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={phase >= 2 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        >
          <div className="text-[4vw] font-mono font-bold text-white flex gap-[2vw]">
            <motion.span 
              initial={{ color: '#fff' }}
              animate={phase >= 3 ? { color: 'var(--color-primary)' } : { color: '#fff' }}
            >
              {phase >= 3 ? 'C' : 'B'}
            </motion.span>
            <motion.span 
              initial={{ color: '#fff' }}
              animate={phase >= 3 ? { color: 'var(--color-primary)' } : { color: '#fff' }}
            >
              {phase >= 3 ? 'G' : 'F#'}
            </motion.span>
            <motion.span 
              initial={{ color: '#fff' }}
              animate={phase >= 3 ? { color: 'var(--color-primary)' } : { color: '#fff' }}
            >
              {phase >= 3 ? 'Am7' : 'G#m7'}
            </motion.span>
            <motion.span 
              initial={{ color: '#fff' }}
              animate={phase >= 3 ? { color: 'var(--color-primary)' } : { color: '#fff' }}
            >
              {phase >= 3 ? 'F' : 'E'}
            </motion.span>
          </div>
          
          {phase >= 3 && (
            <motion.div 
              className="absolute inset-0 bg-primary/20 pointer-events-none"
              initial={{ opacity: 1, scale: 0.9 }}
              animate={{ opacity: 0, scale: 1.5 }}
              transition={{ duration: 0.8 }}
            />
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}
