import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

export function Intro() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 3200), // Exiting
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center bg-white"
      initial={{ opacity: 0, scale: 1.1 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="relative z-10 text-center flex flex-col items-center">
        <motion.img
          src={`${import.meta.env.BASE_URL}logo-kordi.png`}
          alt="Kordi"
          draggable={false}
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={phase >= 1 ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 50, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="h-[34vh] w-auto"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={phase >= 2 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mt-[3vh]"
        >
          <p className="text-[2.6vw] font-semibold text-slate-700 tracking-tight">
            O app do{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#C24BF7] to-[#9673FF] font-bold">
              tecladista inteligente
            </span>
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}
