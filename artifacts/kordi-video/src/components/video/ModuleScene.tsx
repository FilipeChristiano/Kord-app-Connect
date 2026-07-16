import { motion } from "framer-motion";
import { PhoneFrame } from "@/components/showcase/scenes";

export function ModuleScene({
  badge,
  title,
  subtitle,
  phoneIndex,
  children,
}: {
  badge: string;
  title: React.ReactNode;
  subtitle: string;
  phoneIndex: number;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="absolute inset-0 flex items-center justify-center gap-16 px-[6vw]"
    >
      {/* Frase de destaque */}
      <div className="flex-1 max-w-[560px]">
        <motion.span
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="inline-flex items-center px-4 py-1.5 rounded-full bg-[#9673FF]/15 border border-[#9673FF]/40 text-[#9673FF] text-[15px] font-bold uppercase tracking-[0.18em] mb-6"
        >
          {badge}
        </motion.span>
        <motion.h2
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.3 }}
          className="text-[52px] leading-[1.08] font-black text-white tracking-tight mb-5"
        >
          {title}
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="text-[22px] leading-relaxed text-slate-400 font-medium"
        >
          {subtitle}
        </motion.p>
      </div>

      {/* Celular com a animação real da página de vendas */}
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        className="shrink-0 origin-center scale-[1.05]"
      >
        <PhoneFrame activeIndex={phoneIndex}>{children}</PhoneFrame>
      </motion.div>
    </motion.div>
  );
}
