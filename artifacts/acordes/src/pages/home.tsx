import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  playAcordesHover, playSofisticadorHover, playPadHover, playMetronomoHover,
} from "@/lib/hover-sounds";
import {
  ArrowRight, Layers, Wand2, Waves, Timer,
  Music3, Users, Globe, CirclePlay,
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
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 z-0 bg-background">
          <img
            src={`${import.meta.env.BASE_URL}images/hero-keyboard-v5.png`}
            alt=""
            aria-hidden="true"
            className="w-full h-full object-cover opacity-20 blur-[2px] brightness-75 object-[70%_center] mix-blend-luminosity"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/90 to-background/50" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-transparent to-background" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 pt-16 lg:pt-24 pb-20">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={containerVariants}
            className="grid lg:grid-cols-2 gap-10 lg:gap-8 items-center"
          >
            {/* Texto */}
            <div className="flex flex-col items-center lg:items-start text-center lg:text-left order-2 lg:order-1">
              <motion.span
                variants={itemVariants}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/20 bg-background/80 text-foreground/90 text-[13px] font-sans font-medium backdrop-blur-md"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-primary" aria-hidden="true" />
                Para tecladistas e pianistas
              </motion.span>
              <motion.h1
                variants={itemVariants}
                className="font-display font-bold text-[clamp(2.1rem,4.6vw,4rem)] tracking-[-0.04em] leading-[1.05] text-foreground mt-6 mb-5 text-balance"
              >
                Tudo o que faltava para <span className="text-primary">elevar o nível</span> do seu teclado.
              </motion.h1>
              <motion.p
                variants={itemVariants}
                className="text-body-lg text-muted-foreground font-sans font-medium text-balance max-w-[420px] mb-10 leading-[1.55]"
              >
                Acordes sofisticados, cifras inteligentes, pads contínuos e metrônomo profissional.
              </motion.p>
              <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                <Link href="/dicionario" className="group relative px-7 py-4 rounded-xl font-display font-semibold text-white bg-gradient-to-br from-[#C24BF7] to-[#4B45E8] shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_0_28px_-8px_rgba(194,75,247,0.5)] hover:brightness-110 hover:-translate-y-0.5 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_0_34px_-8px_rgba(194,75,247,0.65)] transition-all duration-200 flex items-center justify-center gap-2">
                  Explorar ferramentas
                  <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
                </Link>
                <Link href="/aplicacoes" className="px-7 py-4 rounded-xl font-display font-semibold bg-white/5 text-foreground border border-[rgba(255,255,255,0.12)] backdrop-blur-md hover:border-primary/50 hover:bg-white/[0.09] transition-all duration-200 flex items-center justify-center gap-2">
                  <CirclePlay className="w-4 h-4 opacity-90" />
                  Ver demonstração
                </Link>
              </motion.div>
            </div>

            {/* Lockup da marca */}
            <motion.div
              variants={itemVariants}
              className="order-1 lg:order-2 flex flex-col items-center gap-5 sm:gap-6 select-none py-2 lg:py-8 opacity-80"
              aria-hidden="true"
            >
              <img
                src={`${import.meta.env.BASE_URL}logo.svg`}
                alt=""
                className="h-[100px] sm:h-[130px] lg:h-[158px] w-auto select-none"
                draggable={false}
              />
              <img
                src={`${import.meta.env.BASE_URL}wordmark.svg`}
                alt=""
                className="h-7 sm:h-9 lg:h-10 w-auto select-none"
                draggable={false}
              />
            </motion.div>
          </motion.div>

          {/* Cards de ferramentas */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-16 lg:mt-20 auto-rows-fr">
            <HeroCard
              accent="violet"
              icon={<Layers />}
              title="Acordes Sofisticados"
              desc="Centenas de acordes sofisticados prontos para usar."
              cta="Explorar acordes"
              href="/dicionario"
              visual={<AcordesMini />}
              onHoverSound={playAcordesHover}
            />
            <HeroCard
              accent="fuchsia"
              icon={<Wand2 />}
              title="Sofisticador de Cifras"
              desc="Transforme cifras simples em versões sofisticadas."
              cta="Sofisticar agora"
              href="/sofisticador"
              visual={<SofisticadorMini />}
              onHoverSound={playSofisticadorHover}
            />
            <HeroCard
              accent="blue"
              icon={<Waves />}
              title="Pad Continuous"
              desc="Som de fundo contínuo que preenche e acompanha você."
              cta="Abrir pad"
              href="/pad"
              visual={<PadMini />}
              onHoverSound={playPadHover}
            />
            <HeroCard
              accent="orange"
              icon={<Timer />}
              title="Metrônomo Inteligente"
              desc="Marca o tempo da música para você treinar com precisão."
              cta="Abrir metrônomo"
              href="/metronomo"
              visual={<MetronomeGauge size={80} bpmClass="text-lg" labelClass="text-[7px]" meter="4/4" />}
              onHoverSound={playMetronomoHover}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

/* ─── Card base ───────────────────────────────────────────────── */

type Accent = "orange" | "violet" | "fuchsia" | "blue";

const ACCENTS: Record<Accent, {
  iconBox: string;
  topLine: string;
  glow: string;
  hoverBorder: string;
  hoverShadow: string;
}> = {
  orange: {
    iconBox: "text-[#fb923c] bg-[#f97316]/10",
    topLine: "via-[#f97316]/40",
    glow: "bg-[#f97316]/[0.09]",
    hoverBorder: "hover:border-[#f97316]/30",
    hoverShadow: "hover:shadow-[0_8px_30px_-12px_rgba(249,115,22,0.2)]",
  },
  violet: {
    iconBox: "text-[#A78BFF] bg-[#8B5CF6]/10",
    topLine: "via-[#8B5CF6]/40",
    glow: "bg-[#8B5CF6]/[0.09]",
    hoverBorder: "hover:border-[#8B5CF6]/30",
    hoverShadow: "hover:shadow-[0_8px_30px_-12px_rgba(139,92,246,0.2)]",
  },
  fuchsia: {
    iconBox: "text-[#e879f9] bg-[#d946ef]/10",
    topLine: "via-[#d946ef]/40",
    glow: "bg-[#d946ef]/[0.08]",
    hoverBorder: "hover:border-[#d946ef]/30",
    hoverShadow: "hover:shadow-[0_8px_30px_-12px_rgba(217,70,239,0.18)]",
  },
  blue: {
    iconBox: "text-[#7dd3fc] bg-[#38bdf8]/10",
    topLine: "via-[#38bdf8]/40",
    glow: "bg-[#38bdf8]/[0.09]",
    hoverBorder: "hover:border-[#38bdf8]/30",
    hoverShadow: "hover:shadow-[0_8px_30px_-12px_rgba(56,189,248,0.2)]",
  },
};

function HeroCard({
  icon, title, desc, cta, href, accent, visual, onHoverSound,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  cta: string;
  href: string;
  accent: Accent;
  visual: React.ReactNode;
  onHoverSound?: () => void;
}) {
  const a = ACCENTS[accent];
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, ease: EASE }}
      whileHover={{ y: -4, transition: { duration: 0.2, ease: EASE } }}
      onHoverStart={() => onHoverSound?.()}
      className={`group relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#141c2e] to-[#0f1624] border border-white/[0.05] transition-colors duration-200 ${a.hoverBorder} ${a.hoverShadow} h-full`}
    >
      <span aria-hidden="true" className={`absolute top-0 inset-x-6 h-px bg-gradient-to-r from-transparent to-transparent ${a.topLine}`} />
      <Link href={href} className="relative flex flex-col gap-4 p-7 h-full">
        <div className="flex items-start justify-between gap-4 min-h-[64px]">
          <span className={`w-10 h-10 shrink-0 flex items-center justify-center rounded-xl [&_svg]:w-5 [&_svg]:h-5 transition-all duration-200 group-hover:scale-110 group-hover:brightness-125 ${a.iconBox}`}>
            {icon}
          </span>
          <div className="relative flex-1 min-w-0 flex justify-end opacity-80 group-hover:opacity-100 transition-opacity">
            <span aria-hidden="true" className={`absolute -top-3 right-4 w-24 h-12 rounded-full blur-2xl pointer-events-none ${a.glow}`} />
            {visual}
          </div>
        </div>
        <h3 className="text-[22px] font-display font-semibold text-foreground text-balance mt-auto pt-4 leading-[1.2]">{title}</h3>
        <p className="text-[15px] font-sans text-muted-foreground leading-[1.55]">{desc}</p>
        <span className="inline-flex items-center gap-1.5 text-[13px] font-display font-semibold text-primary group-hover:text-white transition-colors duration-200">
          {cta}
          <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-1" />
        </span>
      </Link>
    </motion.div>
  );
}

/* ─── Mini-visuais do hero ────────────────────────────────────── */

function AcordesMini() {
  return (
    <div className="flex flex-col items-end gap-1.5 w-full max-w-[130px]">
      <div className="flex gap-1">
        {["Cmaj9", "G13", "Am11"].map((c, i) => (
          <motion.span
            key={c}
            animate={{ opacity: [0.55, 1, 0.55] }}
            transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut", delay: i * 1.2 }}
            className="px-1.5 py-0.5 rounded bg-[#8B5CF6]/15 border border-[#8B5CF6]/30 font-mono text-[9px] text-[#A78BFF] font-semibold"
          >
            {c}
          </motion.span>
        ))}
      </div>
      <ChordKeyboard className="w-full h-8" />
    </div>
  );
}

function SofisticadorMini() {
  return (
    <div className="flex flex-col items-end gap-1 w-full max-w-[150px]">
      <div className="flex gap-1 transition-all duration-500 group-hover:opacity-30 group-hover:scale-95 origin-right">
        {["C", "G", "Am", "F"].map((c) => (
          <span key={c} className="min-w-[24px] text-center px-1.5 py-0.5 rounded bg-white/[0.05] font-mono text-[9px] text-muted-foreground">
            {c}
          </span>
        ))}
      </div>
      <div className="flex gap-1 transition-all duration-500 group-hover:scale-110 group-hover:drop-shadow-[0_0_8px_rgba(217,70,239,0.45)] origin-right">
        {["C9", "G/B", "Am11"].map((c, i) => (
          <motion.span
            key={c}
            animate={{ opacity: [0.5, 1, 1, 0.5] }}
            transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut", delay: i * 0.5 }}
            className="px-1.5 py-0.5 rounded bg-[#d946ef]/15 border border-[#d946ef]/30 font-mono text-[9px] text-[#e879f9] font-semibold"
          >
            {c}
          </motion.span>
        ))}
      </div>
    </div>
  );
}

function PadMini() {
  return (
    <div className="w-full max-w-[150px]">
      <PadWaves className="h-12" />
    </div>
  );
}

function PadWaves({ className = "h-20" }: { className?: string }) {
  return (
    <div className={`relative w-full overflow-hidden rounded-xl border border-[#38bdf8]/15 bg-[#0c1a26]/40 ${className}`}>
      <svg viewBox="0 0 400 100" className="w-full h-full" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="padBlue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#0284c7" stopOpacity="0.04" />
          </linearGradient>
        </defs>
        <motion.g animate={{ x: [0, -60, 0] }} transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}>
          <path d="M-80 62 Q 30 32 130 56 T 330 52 T 540 60 V100 H-80 Z" fill="url(#padBlue)" />
          <path d="M-80 70 Q 50 46 150 66 T 350 60 T 560 68" fill="none" stroke="#38bdf8" strokeWidth="2" strokeOpacity="0.55" />
        </motion.g>
        <motion.g animate={{ x: [0, 55, 0] }} transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}>
          <path d="M-80 54 Q 40 76 140 58 T 340 64 T 560 56" fill="none" stroke="#7dd3fc" strokeWidth="1.5" strokeOpacity="0.35" />
        </motion.g>
      </svg>
    </div>
  );
}

function MetronomeGauge({
  size = 150,
  bpmClass = "text-4xl",
  labelClass = "text-[10px]",
  meter,
}: {
  size?: number;
  bpmClass?: string;
  labelClass?: string;
  meter?: string;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.4;
  const startA = 125;       // ponto inferior esquerdo
  const sweep = 290;        // deixa uma folga de 70° embaixo
  const frac = 0.26;        // quanto do arco fica em laranja
  const endA = startA + sweep;
  const progA = startA + sweep * frac;
  const polar = (deg: number) => {
    const rad = (deg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };
  const arc = (a0: number, a1: number) => {
    const p0 = polar(a0);
    const p1 = polar(a1);
    const large = a1 - a0 > 180 ? 1 : 0;
    return `M ${p0.x} ${p0.y} A ${r} ${r} 0 ${large} 1 ${p1.x} ${p1.y}`;
  };
  const knob = polar(progA);
  const strokeW = size >= 120 ? 4 : 3;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full" aria-hidden="true">
        <path d={arc(startA, endA)} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={strokeW} strokeLinecap="round" />
        <path d={arc(startA, progA)} fill="none" stroke="#fb923c" strokeWidth={strokeW} strokeLinecap="round" />
        <motion.circle
          cx={knob.x}
          cy={knob.y}
          r={size * 0.06}
          fill="none"
          stroke="#fb923c"
          strokeWidth={1.5}
          initial={{ r: size * 0.06, opacity: 0.5 }}
          animate={{ r: [size * 0.06, size * 0.115], opacity: [0.5, 0] }}
          transition={{ duration: 0.833, repeat: Infinity, ease: "easeOut" }}
        />
        <circle cx={knob.x} cy={knob.y} r={size * 0.06} fill="#1c1410" stroke="#fb923c" strokeWidth={2} strokeOpacity={0.5} />
        <circle cx={knob.x} cy={knob.y} r={size * 0.033} fill="#fb923c" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`font-semibold tracking-[0.2em] text-muted-foreground mb-0.5 ${labelClass}`}>BPM</span>
        <span className={`font-display font-bold text-foreground leading-none tabular-nums ${bpmClass}`}>72</span>
        {meter && <span className="text-[9px] text-muted-foreground mt-0.5 font-mono">{meter}</span>}
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
      {whites.map((i) =>
        hlWhite.has(i) ? (
          <motion.rect
            key={`w${i}`}
            x={i * w}
            y={0}
            width={w - 1}
            height={h}
            rx={2.5}
            className="fill-[#8B5CF6]"
            stroke="rgba(0,0,0,0.35)"
            strokeWidth={0.8}
            animate={{ opacity: [0.55, 1, 0.55] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut", delay: (i / 2) * 0.35 }}
          />
        ) : (
          <rect
            key={`w${i}`}
            x={i * w}
            y={0}
            width={w - 1}
            height={h}
            rx={2.5}
            fill="#f4f4f5"
            stroke="rgba(0,0,0,0.35)"
            strokeWidth={0.8}
          />
        )
      )}
      {blacks.map((i) => (
        <rect
          key={`b${i}`}
          x={i * w + w * 0.62}
          y={0}
          width={w * 0.7}
          height={h * 0.62}
          rx={2}
          className={hlBlack.has(i) ? "fill-[#8B5CF6]" : ""}
          fill={hlBlack.has(i) ? undefined : "rgba(8,8,12,0.88)"}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={0.6}
        />
      ))}
    </svg>
  );
}
