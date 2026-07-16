import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

export function AudioLab() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 400),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 2000),
      setTimeout(() => setPhase(4), 2800),
      setTimeout(() => setPhase(5), 4800),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center px-[10vw]"
      initial={{ opacity: 0, y: '20vh' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: '-20vh' }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="w-1/2 z-10 pr-[5vw]">
        <motion.h2 
          className="text-[4.5vw] font-bold text-white leading-tight"
          initial={{ opacity: 0, x: -30 }}
          animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: -30 }}
          transition={{ duration: 0.6 }}
        >
          Audio <span className="text-gradient">Lab</span>
        </motion.h2>
        <motion.p
          className="text-[2vw] text-white/70 mt-[2vh]"
          initial={{ opacity: 0, x: -20 }}
          animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          Isole voz e instrumentos. Crie playbacks perfeitos para estudo.
        </motion.p>
      </div>

      <div className="w-1/2 flex flex-col gap-[2vh]">
        {[
          { label: 'Voz', color: '#9673FF', p: 2 },
          { label: 'Bateria', color: '#4B45E8', p: 3 },
          { label: 'Baixo', color: '#C24BF7', p: 4 }
        ].map((track, i) => (
          <motion.div 
            key={track.label}
            className="bg-white/5 border border-white/10 rounded-xl p-[2vw] flex items-center gap-[2vw]"
            initial={{ opacity: 0, x: 50 }}
            animate={phase >= track.p ? { opacity: 1, x: 0 } : { opacity: 0, x: 50 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          >
            <div className="w-[8vw] text-[1.8vw] font-medium text-white">{track.label}</div>
            <div className="flex-1 h-[1vh] bg-white/10 rounded-full overflow-hidden">
              <motion.div 
                className="h-full rounded-full"
                style={{ backgroundColor: track.color }}
                initial={{ width: 0 }}
                animate={phase >= track.p ? { width: '80%' } : { width: 0 }}
                transition={{ duration: 1, delay: 0.3, ease: 'easeOut' }}
              />
            </div>
            <motion.div 
              className="w-[3vw] h-[3vw] rounded-full border-2 border-white/20 flex items-center justify-center"
              initial={{ scale: 0.8 }}
              animate={phase >= track.p ? { scale: 1, borderColor: track.color } : { scale: 0.8 }}
            >
              <div className="w-[1vw] h-[1vw] bg-white rounded-full" style={{ backgroundColor: track.color }} />
            </motion.div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
