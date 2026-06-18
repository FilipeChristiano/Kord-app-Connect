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
            <h2 className="text-h2 font-bold text-foreground mb-4 text-balance">Tudo que você precisa para transformar seu som.</h2>
            <p className="text-muted-foreground text-body-lg">
              Ferramentas inteligentes, resultados profissionais.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 auto-rows-fr">
            <ToolCard
              accent="orange"
              icon={<Layers />}
              title="Acordes Sofisticados"
              desc="Explore acordes ricos, voicings e categorias para elevar seu som a outro nível."
              cta="Explorar acordes"
              href="/dicionario"
            >
              <AcordesVisual />
            </ToolCard>

            <ToolCard
              accent="purple"
              icon={<Wand2 />}
              title="Sofisticador de Cifras"
              desc="Transforme cifras simples em versões mais bonitas e musicais em segundos."
              cta="Sofisticar cifra"
              href="/sofisticador"
            >
              <SofisticadorVisual />
            </ToolCard>

            <ToolCard
              accent="teal"
              icon={<Waves />}
              title="Pad Continuous"
              desc="Crie uma atmosfera contínua para tocar, ministrar e acompanhar."
              cta="Abrir pad"
              href="/pad"
            >
              <PadVisual />
            </ToolCard>

            <ToolCard
              accent="orange"
              icon={<Timer />}
              title="Metrônomo Inteligente"
              desc="Pratique com pulso, subdivisões e variações para tocar com precisão."
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

type Accent = "orange" | "purple" | "teal";

const ACCENTS: Record<Accent, {
  glow: string;
  iconBox: string;
  cta: string;
  hoverBorder: string;
  hoverShadow: string;
}> = {
  orange: {
    glow: "bg-[hsl(var(--primary))]",
    iconBox: "bg-primary/15 text-primary ring-1 ring-primary/20",
    cta: "text-primary",
    hoverBorder: "hover:border-primary/30",
    hoverShadow: "hover:shadow-[0_18px_44px_-18px_hsl(var(--primary)/0.4)]",
  },
  purple: {
    glow: "bg-[#8b5cf6]",
    iconBox: "bg-[#8b5cf6]/15 text-[#a78bfa] ring-1 ring-[#8b5cf6]/25",
    cta: "text-[#a78bfa]",
    hoverBorder: "hover:border-[#8b5cf6]/40",
    hoverShadow: "hover:shadow-[0_18px_44px_-18px_rgba(139,92,246,0.45)]",
  },
  teal: {
    glow: "bg-[#14b8a6]",
    iconBox: "bg-[#14b8a6]/15 text-[#2dd4bf] ring-1 ring-[#14b8a6]/25",
    cta: "text-[#2dd4bf]",
    hoverBorder: "hover:border-[#14b8a6]/40",
    hoverShadow: "hover:shadow-[0_18px_44px_-18px_rgba(20,184,166,0.45)]",
  },
};

function ToolCard({
  icon, title, desc, cta, href, accent, children,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  cta: string;
  href: string;
  accent: Accent;
  children: React.ReactNode;
}) {
  const a = ACCENTS[accent];
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, ease: EASE }}
      whileHover={{ y: -4, transition: { duration: 0.2, ease: EASE } }}
      className={`group relative overflow-hidden rounded-3xl bg-card border border-white/[0.06] shadow-lg shadow-black/20 transition-colors duration-200 ${a.hoverBorder} ${a.hoverShadow}`}
    >
      <div className={`pointer-events-none absolute -top-24 -left-20 w-72 h-72 rounded-full blur-[90px] opacity-[0.18] ${a.glow}`} />
      <Link href={href} className="relative flex flex-col sm:flex-row gap-5 sm:gap-6 p-6 sm:p-7 h-full">
        <div className="flex flex-col sm:w-[42%] sm:shrink-0">
          <span className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 [&_svg]:w-6 [&_svg]:h-6 transition-transform duration-200 group-hover:scale-110 ${a.iconBox}`}>
            {icon}
          </span>
          <h3 className="text-h4 font-semibold text-foreground mb-2 text-balance">{title}</h3>
          <p className="text-muted-foreground leading-relaxed text-small">{desc}</p>
          <span className={`mt-auto pt-5 inline-flex items-center gap-1.5 text-sm font-semibold ${a.cta}`}>
            {cta}
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-200" />
          </span>
        </div>
        <div className="flex-1 flex items-center min-w-0">
          {children}
        </div>
      </Link>
    </motion.div>
  );
}

/* ─── Visuais internos ────────────────────────────────────────── */

function AcordesVisual() {
  const chords = ["Cmaj9", "F7M(9)", "G13", "Am11"];
  return (
    <div className="w-full flex flex-col gap-2.5">
      <div className="flex flex-wrap gap-1.5">
        {chords.map((c, i) => (
          <span
            key={c}
            className={`px-2 py-1 rounded-lg font-mono text-[11px] transition-colors ${
              i === 0
                ? "bg-primary/15 border border-primary/30 text-primary font-semibold"
                : "bg-white/[0.04] border border-white/[0.07] text-foreground/75"
            }`}
          >
            {c}
          </span>
        ))}
      </div>
      <ChordKeyboard className="w-full h-14" />
      <div className="rounded-xl border border-white/[0.06] bg-background/50 px-3 py-2.5 flex items-center justify-between gap-3">
        <div className="text-[11px] space-y-1 leading-tight">
          <p className="font-mono text-primary font-semibold text-xs">Cmaj9</p>
          <p className="text-muted-foreground">Notas: <span className="font-mono text-foreground/80">C E G B D</span></p>
          <p className="text-muted-foreground">Tensão: <span className="font-mono text-primary">9ª · 13ª</span></p>
        </div>
        <ChordKeyboard className="w-24 h-9 shrink-0" />
      </div>
    </div>
  );
}

function SofisticadorVisual() {
  const antes = ["C", "G", "Am", "F"];
  const depois = ["C9", "G/B", "Am11", "F7M(9)"];
  return (
    <div className="w-full flex flex-col gap-2">
      <div className="rounded-xl border border-[#8b5cf6]/15 bg-[#8b5cf6]/[0.05] px-3 py-2.5">
        <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-1.5">Antes</p>
        <div className="flex flex-wrap gap-1.5">
          {antes.map((a) => (
            <span key={a} className="min-w-[36px] text-center px-2 py-1 rounded-md bg-white/[0.05] font-mono text-xs text-muted-foreground">{a}</span>
          ))}
        </div>
      </div>
      <div className="flex justify-center text-[#a78bfa]">
        <motion.span animate={{ y: [0, 3, 0] }} transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}>
          <ArrowDown className="w-4 h-4" />
        </motion.span>
      </div>
      <div className="rounded-xl border border-[#8b5cf6]/25 bg-[#8b5cf6]/[0.08] px-3 py-2.5">
        <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#a78bfa] mb-1.5">Depois</p>
        <div className="flex flex-wrap gap-1.5">
          {depois.map((d) => (
            <span key={d} className="px-2 py-1 rounded-md bg-[#8b5cf6]/15 border border-[#8b5cf6]/30 font-mono text-xs text-[#c4b5fd] font-semibold">{d}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function PadWaves() {
  return (
    <div className="relative w-full h-20 overflow-hidden rounded-xl border border-[#14b8a6]/15 bg-[#0c1f1d]/40">
      <svg viewBox="0 0 400 100" className="w-full h-full" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="padTeal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#0d9488" stopOpacity="0.04" />
          </linearGradient>
        </defs>
        <motion.g animate={{ x: [0, -60, 0] }} transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}>
          <path d="M-80 62 Q 30 32 130 56 T 330 52 T 540 60 V100 H-80 Z" fill="url(#padTeal)" />
          <path d="M-80 70 Q 50 46 150 66 T 350 60 T 560 68" fill="none" stroke="#2dd4bf" strokeWidth="2" strokeOpacity="0.55" />
        </motion.g>
        <motion.g animate={{ x: [0, 55, 0] }} transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}>
          <path d="M-80 54 Q 40 76 140 58 T 340 64 T 560 56" fill="none" stroke="#5eead4" strokeWidth="1.5" strokeOpacity="0.35" />
        </motion.g>
      </svg>
    </div>
  );
}

function PadVisual() {
  const stats = [
    { label: "Tom", value: "G" },
    { label: "Modo", value: "Worship" },
    { label: "Camadas", value: "3" },
  ];
  return (
    <div className="w-full flex flex-col gap-3">
      <PadWaves />
      <div className="grid grid-cols-4 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-white/[0.06] bg-background/50 px-2 py-1.5 text-center">
            <p className="text-[9px] uppercase tracking-wide text-muted-foreground/70">{s.label}</p>
            <p className="text-xs font-semibold text-foreground truncate">{s.value}</p>
          </div>
        ))}
        <div className="rounded-lg border border-[#14b8a6]/25 bg-[#14b8a6]/[0.08] px-2 py-1.5 text-center">
          <p className="text-[9px] uppercase tracking-wide text-[#2dd4bf]/80">Pad Ativo</p>
          <p className="text-xs font-semibold text-[#2dd4bf] inline-flex items-center gap-1 justify-center">
            ON <span className="w-1.5 h-1.5 rounded-full bg-[#2dd4bf] animate-pulse" />
          </p>
        </div>
      </div>
    </div>
  );
}

function MetronomoVisual() {
  return (
    <div className="w-full flex flex-col gap-4">
      <div className="flex items-center justify-center gap-4">
        <MetronomeGauge />
        <span className="font-mono text-base text-muted-foreground">4/4</span>
      </div>
      <div className="flex items-center justify-center gap-2.5">
        {[1, 2, 3, 4].map((n) => (
          <motion.span
            key={n}
            className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold ${
              n === 1 ? "bg-primary text-primary-foreground" : "bg-white/[0.06] text-muted-foreground border border-white/[0.06]"
            }`}
            animate={n === 1 ? { scale: [1, 1.12, 1] } : undefined}
            transition={n === 1 ? { duration: 0.83, repeat: Infinity, ease: "easeInOut" } : undefined}
          >
            {n}
          </motion.span>
        ))}
      </div>
    </div>
  );
}

function MetronomeGauge() {
  const size = 148;
  const cx = size / 2;
  const cy = size / 2;
  const rOut = 66;
  const rIn = 57;
  const rArc = 63;
  const start = 135;
  const sweep = 270;
  const frac = 0.42;
  const N = 36;
  const polar = (r: number, a: number) => {
    const rad = (a * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };
  const ticks = Array.from({ length: N + 1 }, (_, i) => {
    const a = start + (sweep * i) / N;
    const p1 = polar(rIn, a);
    const p2 = polar(rOut, a);
    return { p1, p2, on: i / N <= frac, key: i };
  });
  const aStart = polar(rArc, start);
  const aEnd = polar(rArc, start + sweep * frac);
  const large = sweep * frac > 180 ? 1 : 0;
  const arc = `M ${aStart.x} ${aStart.y} A ${rArc} ${rArc} 0 ${large} 1 ${aEnd.x} ${aEnd.y}`;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full" aria-hidden="true">
        {ticks.map((t) => (
          <line
            key={t.key}
            x1={t.p1.x}
            y1={t.p1.y}
            x2={t.p2.x}
            y2={t.p2.y}
            className={t.on ? "stroke-[hsl(var(--primary))]" : ""}
            stroke={t.on ? undefined : "rgba(255,255,255,0.12)"}
            strokeWidth={2}
            strokeLinecap="round"
          />
        ))}
        <path d={arc} fill="none" className="stroke-[hsl(var(--primary))]" strokeWidth={3} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-4xl font-bold text-foreground leading-none tabular-nums">72</span>
        <span className="text-[10px] font-semibold tracking-[0.2em] text-muted-foreground mt-1.5">BPM</span>
      </div>
    </div>
  );
}

function ChordKeyboard({ className = "w-full h-12" }: { className?: string }) {
  const whiteCount = 14;
  const w = 17;
  const h = 60;
  const whites = Array.from({ length: whiteCount }, (_, i) => i);
  const blackPattern = [0, 1, 3, 4, 5];
  const blacks: number[] = [];
  for (let o = 0; o < 2; o++) {
    for (const b of blackPattern) {
      const idx = o * 7 + b;
      if (idx < whiteCount - 1) blacks.push(idx);
    }
  }
  // Cmaj9 = C E G B D — teclas brancas espaçadas (voicing real, sem pretas)
  const hlWhite = new Set([2, 4, 6, 8, 10]);
  const hlBlack = new Set<number>();
  return (
    <svg viewBox={`0 0 ${whiteCount * w} ${h}`} className={className} aria-hidden="true" preserveAspectRatio="xMidYMid meet">
      {whites.map((i) => (
        <rect
          key={`w${i}`}
          x={i * w}
          y={0}
          width={w - 1}
          height={h}
          rx={2.5}
          className={hlWhite.has(i) ? "fill-[hsl(var(--primary))]" : ""}
          fill={hlWhite.has(i) ? undefined : "rgba(255,255,255,0.06)"}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={0.8}
        />
      ))}
      {blacks.map((i) => (
        <rect
          key={`b${i}`}
          x={i * w + w * 0.62}
          y={0}
          width={w * 0.7}
          height={h * 0.62}
          rx={2}
          className={hlBlack.has(i) ? "fill-[hsl(var(--primary))]" : ""}
          fill={hlBlack.has(i) ? undefined : "rgba(8,8,12,0.88)"}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={0.6}
        />
      ))}
    </svg>
  );
}
