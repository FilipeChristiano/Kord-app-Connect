import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

export function Metronomo() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 400),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 2000),
      setTimeout(() => setPhase(4), 4800),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center px-[10vw]"
      initial={{ opacity: 0, scale: 1.1 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div 
        className="w-[20vw] h-[20vw] rounded-full border-[1vw] border-primary/20 flex items-center justify-center relative mb-[4vh]"
        initial={{ opacity: 0, scale: 0.5 }}
        animate={phase >= 1 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.5 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      >
        {phase >= 2 && (
          <motion.div 
            className="absolute inset-0 rounded-full border-[1vw] border-primary"
            initial={{ scale: 1, opacity: 1 }}
            animate={{ scale: 1.5, opacity: 0 }}
            transition={{ duration: 1.2, repeat: Infinity }}
          />
        )}
        <div className="text-center">
          <div className="text-[5vw] font-black text-white leading-none">120</div>
          <div className="text-[1.5vw] text-primary font-bold">BPM</div>
        </div>
      </motion.div>

      <motion.h2 
        className="text-[3.5vw] font-bold text-white text-center leading-tight mb-[2vh]"
        initial={{ opacity: 0, y: 30 }}
        animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
        transition={{ duration: 0.6 }}
      >
        Metrônomo inteligente &<br/>
        <span className="text-gradient">Pads Worship</span>
      </motion.h2>

      <motion.p
        className="text-[2vw] text-white/70 text-center"
        initial={{ opacity: 0 }}
        animate={phase >= 3 ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.6 }}
      >
        Sincronia automática. Ambientação perfeita.
      </motion.p>
    </motion.div>
  );
}
