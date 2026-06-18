import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowRight, ArrowDown, ChevronDown, Star, Layers, Wand2, Waves, Timer,
} from "lucide-react";

const EASE = [0.4, 0, 0.2, 1] as const;

export default function Home() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
  };

  return (
    <div className="w-full">
      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="relative pt-10 pb-14 lg:pt-14 lg:pb-20 overflow-hidden">
        <div className="absolute inset-x-0 bottom-0 -top-24 z-0">
          <img
            src={`${import.meta.env.BASE_URL}images/hero-bg.png`}
            alt=""
            aria-hidden="true"
            className="w-full h-full object-cover opacity-[0.14] brightness-75 blur-[2px] object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-background/80 to-background" />
          <div className="absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_60%_60%_at_50%_-10%,hsl(var(--primary)/0.14),transparent_70%)] pointer-events-none" />
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={containerVariants}
            className="max-w-3xl mx-auto flex flex-col items-center"
          >
            <motion.div variants={itemVariants} className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-semibold mb-8">
              <Star className="w-4 h-4" />
              Para tecladistas e pianistas
            </motion.div>

            <motion.div variants={itemVariants} className="flex flex-col items-center mb-2">
              <h1 className="sr-only">Harmonic — As ferramentas que faltavam para transformar o seu som</h1>
              <img
                src={`${import.meta.env.BASE_URL}harmonic-logo-hero.png`}
                alt="Harmonic"
                className="w-full max-w-[360px] sm:max-w-[440px] md:max-w-[510px] h-auto select-none drop-shadow-2xl"
                draggable={false}
              />
            </motion.div>

            <motion.h2 variants={itemVariants} className="font-display text-2xl sm:text-3xl font-bold text-foreground -mt-4 sm:-mt-6 mb-4 max-w-2xl text-balance">
              O próximo nível do seu teclado
            </motion.h2>

            <motion.p variants={itemVariants} className="text-body-lg text-foreground/75 mb-9 sm:mb-10 max-w-xl">
              As ferramentas que faltavam para transformar seu som em um só lugar.
            </motion.p>

            <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              <Link href="/dicionario" className="px-8 py-4 rounded-2xl font-bold bg-primary text-primary-foreground glow-primary hover:brightness-105 hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-center gap-2">
                Explorar ferramentas <ArrowRight className="w-5 h-5" />
              </Link>
              <a href="#recursos" className="px-8 py-4 rounded-2xl font-bold bg-surface-elevated/80 text-foreground border border-white/10 shadow-[0_4px_16px_-8px_rgba(0,0,0,0.6)] hover:border-primary/30 hover:bg-surface-elevated hover:-translate-y-0.5 hover:shadow-[0_6px_22px_-8px_hsl(var(--primary)/0.3)] transition-all duration-200 flex items-center justify-center gap-2">
                Conhecer recursos
              </a>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── Slogan strip ──────────────────────────────────────── */}
      <section className="relative border-y border-white/5">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_120%_at_center,_hsl(var(--primary)/0.07),_transparent_70%)] pointer-events-none" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-7 relative">
          <h2 className="font-display font-semibold leading-tight text-center whitespace-nowrap text-[clamp(1rem,3.8vw,2.5rem)] text-foreground/90">
            O <span className="text-gradient-primary">próximo nível</span> do seu teclado.
          </h2>
        </div>
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute left-1/2 -ml-5 bottom-[-20px] z-20 flex items-center justify-center w-10 h-10 rounded-full border border-primary/30 bg-background text-primary shadow-lg"
          aria-hidden="true"
        >
          <ChevronDown className="w-5 h-5" />
        </motion.div>
      </section>

      {/* ── Recursos principais ───────────────────────────────── */}
      <section id="recursos" className="scroll-mt-24 py-20 lg:py-24 relative">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-12 lg:mb-16 text-center max-w-2xl mx-auto">
            <p className="text-small font-semibold uppercase tracking-[0.2em] text-primary mb-3">Recursos principais</p>
            <h2 className="text-h2 font-bold text-foreground mb-4">Ferramentas do Harmonic</h2>
            <p className="text-muted-foreground text-body-lg">
              Quatro ferramentas para transformar o seu som — em um só lugar.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 auto-rows-fr">
            <ToolCard
              icon={<Layers />}
              title="Acordes Sofisticados"
              desc="Explore acordes mais ricos para deixar seu som mais profissional."
              cta="Explorar acordes"
              href="/dicionario"
            >
              <AcordesVisual />
            </ToolCard>

            <ToolCard
              icon={<Wand2 />}
              title="Sofisticador de Cifras"
              desc="Transforme cifras simples em versões mais bonitas e musicais."
              cta="Sofisticar cifra"
              href="/sofisticador"
            >
              <SofisticadorVisual />
            </ToolCard>

            <ToolCard
              icon={<Waves />}
              title="Pad Continuous"
              desc="Crie uma atmosfera contínua para tocar, ministrar ou acompanhar."
              cta="Abrir pad"
              href="/pad"
            >
              <PadVisual />
            </ToolCard>

            <ToolCard
              icon={<Timer />}
              title="Metrônomo Inteligente"
              desc="Pratique com pulso, subdivisões e precisão musical."
              cta="Abrir metrônomo"
              href="/metronomo"
            >
              <MetronomoVisual />
            </ToolCard>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ─── Card base ───────────────────────────────────────────────── */

function ToolCard({
  icon, title, desc, cta, href, children,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  cta: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, ease: EASE }}
      whileHover={{ y: -4, scale: 1.01, transition: { duration: 0.2, ease: EASE } }}
      className="rounded-2xl bg-card border border-white/[0.05] shadow-lg shadow-black/10 hover:border-primary/25 hover:bg-surface-elevated hover:shadow-[0_10px_30px_-12px_hsl(var(--primary)/0.25)] transition-colors duration-200"
    >
      <Link href={href} className="group flex flex-col h-full p-6 sm:p-7">
        <span className="w-12 h-12 rounded-xl bg-surface-elevated text-primary flex items-center justify-center mb-5 [&_svg]:w-6 [&_svg]:h-6 group-hover:scale-110 transition-transform duration-200">
          {icon}
        </span>

        {/* visual interno */}
        <div className="rounded-xl border border-white/[0.05] bg-background/40 px-4 py-3.5 min-h-[104px] flex flex-col justify-center mb-5">
          {children}
        </div>

        <h3 className="text-h4 font-semibold text-foreground mb-2">{title}</h3>
        <p className="text-muted-foreground leading-relaxed text-small">{desc}</p>

        <span className="mt-auto pt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
          {cta}
          <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-200" />
        </span>
      </Link>
    </motion.div>
  );
}

/* ─── Visuais internos ────────────────────────────────────────── */

function AcordesVisual() {
  const chords = ["Cmaj9", "F7M(9)", "G13", "Am11"];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {chords.map((c) => (
          <span key={c} className="px-2.5 py-1 rounded-lg bg-surface-elevated border border-white/[0.07] font-mono text-xs text-foreground/85">
            {c}
          </span>
        ))}
      </div>
      <MiniKeyboard className="w-full max-w-[220px] h-9" />
    </div>
  );
}

function SofisticadorVisual() {
  const antes = ["C", "G", "Am", "F"];
  const depois = ["C9", "G/B", "Am11", "F7M"];
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-1.5">
        {antes.map((a) => (
          <span key={a} className="px-2 py-0.5 rounded-md bg-white/[0.04] font-mono text-xs text-muted-foreground">{a}</span>
        ))}
      </div>
      <div className="flex justify-center text-primary/70"><ArrowDown className="w-3.5 h-3.5" /></div>
      <div className="flex flex-wrap gap-1.5">
        {depois.map((d) => (
          <span key={d} className="px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 font-mono text-xs text-primary font-semibold">{d}</span>
        ))}
      </div>
    </div>
  );
}

function PadVisual() {
  const bars = [0.5, 0.85, 1, 0.65, 0.9, 0.55, 0.78];
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="space-y-1.5 text-xs">
        <p className="text-muted-foreground">Tom <span className="ml-1 font-mono text-foreground/85">G</span></p>
        <p className="text-muted-foreground">Modo <span className="ml-1 font-mono text-foreground/85">Worship</span></p>
        <span className="inline-flex items-center gap-1.5 mt-1">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span className="font-semibold text-primary text-[11px] uppercase tracking-wide">Pad ON</span>
        </span>
      </div>
      <div className="flex items-end gap-1 h-9">
        {bars.map((h, i) => (
          <motion.span
            key={i}
            className="w-1.5 rounded-full bg-primary/55"
            style={{ height: 34, transformOrigin: "bottom" }}
            initial={{ scaleY: h * 0.5 }}
            animate={{ scaleY: [h * 0.45, h, h * 0.55] }}
            transition={{ duration: 1.3 + i * 0.12, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
          />
        ))}
      </div>
    </div>
  );
}

function MetronomoVisual() {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="leading-none">
        <span className="font-display text-3xl font-bold text-foreground">72</span>
        <span className="ml-1.5 text-xs font-semibold text-muted-foreground">BPM</span>
        <p className="text-[11px] font-mono text-muted-foreground mt-1.5">4/4</p>
      </div>
      <div className="flex items-center gap-2">
        {[0, 1, 2, 3].map((i) => (
          <motion.span
            key={i}
            className={`w-2.5 h-2.5 rounded-full ${i === 0 ? "bg-primary" : "bg-white/15"}`}
            animate={i === 0 ? { scale: [1, 1.5, 1], opacity: [1, 0.6, 1] } : undefined}
            transition={i === 0 ? { duration: 1, repeat: Infinity, ease: "easeInOut" } : undefined}
          />
        ))}
      </div>
    </div>
  );
}

function MiniKeyboard({ className }: { className?: string }) {
  const whites = [0, 1, 2, 3, 4, 5, 6];
  const blacks = [0, 1, 3, 4, 5];
  return (
    <svg viewBox="0 0 240 84" className={className} fill="none" aria-hidden="true" preserveAspectRatio="xMidYMax meet">
      {whites.map((i) => (
        <rect key={`w${i}`} x={i * 34} y={2} width={32} height={80} rx={4}
          fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.09)" strokeWidth={1} />
      ))}
      {blacks.map((i) => (
        <rect key={`b${i}`} x={i * 34 + 22} y={2} width={20} height={50} rx={3}
          fill="rgba(8,8,12,0.7)" stroke="rgba(255,255,255,0.07)" strokeWidth={1} />
      ))}
    </svg>
  );
}
