import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { HeroShowcase } from '@/components/showcase/HeroShowcase';
import { getAudio, warmPiano } from '@/lib/piano';

/* Cena única: o showcase REAL da página de vendas (kordi.app.br/assinar), sem nenhuma modificação. */
export function Showcase() {
  /* Destrava o AudioContext e pré-carrega os samples de piano antes de o
     dicionário tocar os acordes — no gravador não há clique do usuário. */
  useEffect(() => {
    const warm = () => {
      const a = getAudio();
      if (a) warmPiano(a.ctx, ['C3', 'Ds3', 'Fs3', 'A3', 'C4', 'Ds4', 'Fs4', 'A4', 'C5']);
      return !!a && a.ctx.state === 'running';
    };
    if (warm()) return;
    const iv = window.setInterval(() => {
      if (warm()) window.clearInterval(iv);
    }, 300);
    return () => window.clearInterval(iv);
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
    >
      <div className="scale-[1.18] origin-center">
        <HeroShowcase />
      </div>
    </motion.div>
  );
}
