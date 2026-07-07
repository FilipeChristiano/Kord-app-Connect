import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowRight, ArrowDown, ChevronDown, Layers, Wand2, Waves, Timer,
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
        <div className="absolute inset-0 z-0">
          <img
            src={`${import.meta.env.BASE_URL}images/hero-keyboard-v5.png`}
            alt=""
            aria-hidden="true"
            className="w-full h-full object-cover opacity-60 brightness-90 object-[70%_center]"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/25" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/45 via-transparent to-background" />
          <div className="absolute inset-x-0 top-0 h-[460px] bg-[radial-gradient(ellipse_55%_65%_at_68%_-5%,hsl(var(--primary)/0.22),transparent_70%)] pointer-events-none" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 pt-10 lg:pt-14 pb-10">
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
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-background/60 text-foreground/90 text-small font-semibold backdrop-blur-sm"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-primary" aria-hidden="true" />
                Para tecladistas e pianistas
              </motion.span>
              <motion.h1
                variants={itemVariants}
                className="font-display font-bold text-[clamp(2.1rem,4.6vw,3.4rem)] leading-[1.12] text-foreground mt-5 mb-4 text-balance"
              >
                Tudo o que faltava para <span className="text-gradient-primary">elevar o nível</span> do seu teclado.
              </motion.h1>
              <motion.p
                variants={itemVariants}
                className="text-body-lg text-muted-foreground text-balance max-w-md mb-8"
              >
                Acordes sofisticados, cifras inteligentes, pads contínuos e metrônomo profissional.
              </motion.p>
              <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-3.5 w-full sm:w-auto">
                <Link href="/dicionario" className="px-6 py-3.5 rounded-xl font-bold bg-gradient-cta text-primary-foreground glow-primary hover:brightness-105 hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-center gap-2">
                  Explorar ferramentas <ArrowRight className="w-5 h-5" />
                </Link>
                <a href="#recursos" className="px-6 py-3.5 rounded-xl font-semibold bg-background/60 text-foreground border border-white/15 backdrop-blur-sm hover:border-primary/35 hover:bg-surface-elevated/80 hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-center gap-2">
                  <CirclePlay className="w-5 h-5" /> Ver demonstração
                </a>
              </motion.div>
              <motion.div
                variants={itemVariants}
                className="flex flex-wrap items-center justify-center lg:justify-start gap-x-8 gap-y-4 mt-9"
              >
                <HeroStat icon={<Music3 />} top="+50 MIL" bottom="Acordes" />
                <HeroStat icon={<Users />} top="+10 MIL" bottom="Músicos" />
                <HeroStat icon={<Globe />} top="Em constante" bottom="evolução" />
              </motion.div>
            </div>

            {/* Lockup da marca */}
            <motion.div
              variants={itemVariants}
              className="order-1 lg:order-2 flex flex-col items-center gap-5 sm:gap-6 select-none drop-shadow-2xl py-2 lg:py-8"
              aria-hidden="true"
            >
              <img
                src={`${import.meta.env.BASE_URL}logo.svg`}
                alt=""
                className="h-32 sm:h-40 lg:h-48 w-auto select-none"
                draggable={false}
              />
              <img
                src={`${import.meta.env.BASE_URL}wordmark.svg`}
                alt=""
                className="h-9 sm:h-11 lg:h-12 w-auto select-none"
                draggable={false}
              />
            </motion.div>
          </motion.div>

          {/* Cards de ferramentas */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-12 lg:mt-14">
            <HeroCard
              accent="orange"
              icon={<Layers />}
              title="Acordes Sofisticados"
              desc="Centenas de acordes sofisticados prontos para usar."
              cta="Explorar acordes"
              href="/dicionario"
              visual={<AcordesMini />}
            />
            <HeroCard
              accent="purple"
              icon={<Wand2 />}
              title="Sofisticador de Cifras"
              desc="Transforme cifras simples em versões sofisticadas."
              cta="Sofisticar agora"
              href="/sofisticador"
              visual={<SofisticadorMini />}
            />
            <HeroCard
              accent="blue"
              icon={<Waves />}
              title="Pad Continuous"
              desc="Ambientes sonoros contínuos para sustentar sua música."
              cta="Abrir pad"
              href="/pad"
              visual={<PadMini />}
            />
            <HeroCard
              accent="orange"
              icon={<Timer />}
              title="Metrônomo Inteligente"
              desc="Precisão, variações e recursos para seu estudo e performance."
              cta="Abrir metrônomo"
              href="/metronomo"
              visual={<MetronomeGauge size={88} bpmClass="text-lg" labelClass="text-[7px]" meter="4/4" />}
            />
          </div>

          <div className="flex justify-center mt-10">
            <motion.a
              href="#recursos"
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
              className="flex items-center justify-center w-10 h-10 rounded-full border border-primary/30 bg-background/80 text-primary shadow-lg"
              aria-label="Ver recursos"
            >
              <ChevronDown className="w-5 h-5" />
            </motion.a>
          </div>
        </div>
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
              accent="blue"
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

type Accent = "orange" | "purple" | "blue";

const ACCENTS: Record<Accent, {
  glow: string;
  iconBox: string;
  cta: string;
  hoverBorder: string;
  hoverShadow: string;
}> = {
  orange: {
    glow: "bg-[#f97316]",
    iconBox: "bg-[#f97316]/15 text-[#fb923c] ring-1 ring-[#f97316]/25",
    cta: "text-[#fb923c]",
    hoverBorder: "hover:border-[#f97316]/40",
    hoverShadow: "hover:shadow-[0_18px_44px_-18px_rgba(249,115,22,0.45)]",
  },
  purple: {
    glow: "bg-[#4f46e5]",
    iconBox: "bg-[#4f46e5]/15 text-[#a5b4fc] ring-1 ring-[#4f46e5]/25",
    cta: "text-[#a5b4fc]",
    hoverBorder: "hover:border-[#4f46e5]/40",
    hoverShadow: "hover:shadow-[0_18px_44px_-18px_rgba(79,70,229,0.45)]",
  },
  blue: {
    glow: "bg-[#38bdf8]",
    iconBox: "bg-[#38bdf8]/15 text-[#7dd3fc] ring-1 ring-[#38bdf8]/25",
    cta: "text-[#7dd3fc]",
    hoverBorder: "hover:border-[#38bdf8]/40",
    hoverShadow: "hover:shadow-[0_18px_44px_-18px_rgba(56,189,248,0.45)]",
  },
};

function HeroStat({ icon, top, bottom }: { icon: React.ReactNode; top: string; bottom: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/12 text-primary ring-1 ring-primary/20 [&_svg]:w-5 [&_svg]:h-5">
        {icon}
      </span>
      <div className="text-left leading-tight">
        <p className="text-sm font-bold text-foreground">{top}</p>
        <p className="text-[12px] text-muted-foreground">{bottom}</p>
      </div>
    </div>
  );
}

function HeroCard({
  icon, title, desc, cta, href, accent, visual,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  cta: string;
  href: string;
  accent: Accent;
  visual: React.ReactNode;
}) {
  const a = ACCENTS[accent];
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, ease: EASE }}
      whileHover={{ y: -4, transition: { duration: 0.2, ease: EASE } }}
      className={`group relative overflow-hidden rounded-2xl bg-card/85 backdrop-blur-sm border border-white/[0.07] shadow-lg shadow-black/25 transition-colors duration-200 ${a.hoverBorder} ${a.hoverShadow}`}
    >
      <div className={`pointer-events-none absolute -top-16 -left-14 w-48 h-48 rounded-full blur-[70px] opacity-[0.16] ${a.glow}`} />
      <Link href={href} className="relative flex flex-col gap-3 p-5 h-full">
        <div className="flex items-start justify-between gap-3 min-h-[64px]">
          <span className={`w-11 h-11 shrink-0 rounded-xl flex items-center justify-center [&_svg]:w-5 [&_svg]:h-5 transition-transform duration-200 group-hover:scale-110 ${a.iconBox}`}>
            {icon}
          </span>
          <div className="flex-1 min-w-0 flex justify-end">{visual}</div>
        </div>
        <h3 className="text-base font-semibold text-foreground text-balance">{title}</h3>
        <p className="text-[13px] text-muted-foreground leading-relaxed flex-1">{desc}</p>
        <span className={`inline-flex items-center gap-1.5 text-[13px] font-semibold ${a.cta}`}>
          {cta}
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform duration-200" />
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
        {["Cmaj9", "G13", "Am11"].map((c) => (
          <span key={c} className="px-1.5 py-0.5 rounded bg-[#f97316]/15 border border-[#f97316]/30 font-mono text-[9px] text-[#fb923c] font-semibold">
            {c}
          </span>
        ))}
      </div>
      <ChordKeyboard className="w-full h-8" />
    </div>
  );
}

function SofisticadorMini() {
  return (
    <div className="flex flex-col items-end gap-1 w-full max-w-[150px]">
      <div className="flex gap-1">
        {["C", "G", "Am", "F"].map((c) => (
          <span key={c} className="min-w-[24px] text-center px-1.5 py-0.5 rounded bg-white/[0.05] font-mono text-[9px] text-muted-foreground">
            {c}
          </span>
        ))}
      </div>
      <div className="flex gap-1">
        {["C9", "G/B", "Am11"].map((c) => (
          <span key={c} className="px-1.5 py-0.5 rounded bg-[#4f46e5]/15 border border-[#4f46e5]/30 font-mono text-[9px] text-[#a5b4fc] font-semibold">
            {c}
          </span>
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
                ? "bg-[#f97316]/15 border border-[#f97316]/30 text-[#fb923c] font-semibold"
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
          <p className="font-mono text-[#fb923c] font-semibold text-xs">Cmaj9</p>
          <p className="text-muted-foreground">Notas: <span className="font-mono text-foreground/80">C E G B D</span></p>
          <p className="text-muted-foreground">Tensão: <span className="font-mono text-[#fb923c]">9ª · 13ª</span></p>
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
      <div className="rounded-xl border border-[#4f46e5]/15 bg-[#4f46e5]/[0.05] px-3 py-2.5">
        <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-1.5">Antes</p>
        <div className="flex flex-wrap gap-1.5">
          {antes.map((a) => (
            <span key={a} className="min-w-[36px] text-center px-2 py-1 rounded-md bg-white/[0.05] font-mono text-xs text-muted-foreground">{a}</span>
          ))}
        </div>
      </div>
      <div className="flex justify-center text-[#a5b4fc]">
        <motion.span animate={{ y: [0, 3, 0] }} transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}>
          <ArrowDown className="w-4 h-4" />
        </motion.span>
      </div>
      <div className="rounded-xl border border-[#4f46e5]/25 bg-[#4f46e5]/[0.08] px-3 py-2.5">
        <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#a5b4fc] mb-1.5">Depois</p>
        <div className="flex flex-wrap gap-1.5">
          {depois.map((d) => (
            <span key={d} className="px-2 py-1 rounded-md bg-[#4f46e5]/15 border border-[#4f46e5]/30 font-mono text-xs text-[#a5b4fc] font-semibold">{d}</span>
          ))}
        </div>
      </div>
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

function PadVisual() {
  const stats = [
    { label: "Tom", value: "G" },
    { label: "Tipo", value: "Warm" },
    { label: "Low Cut", value: "80Hz" },
  ];
  return (
    <div className="w-full flex flex-col gap-3">
      <PadWaves />
      <div className="grid grid-cols-4 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-white/[0.06] bg-background/50 px-2 py-1.5 text-center">
            <p className="text-[9px] uppercase tracking-wide text-muted-foreground/70 truncate">{s.label}</p>
            <p className="text-xs font-semibold text-foreground truncate">{s.value}</p>
          </div>
        ))}
        <div className="rounded-lg border border-[#38bdf8]/25 bg-[#38bdf8]/[0.08] px-2 py-1.5 text-center">
          <p className="text-[9px] uppercase tracking-wide text-[#7dd3fc]/80 truncate">Fade</p>
          <p className="text-xs font-semibold text-[#7dd3fc] truncate">2.5s</p>
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
              n === 1 ? "bg-[#f97316] text-primary-foreground" : "bg-white/[0.06] text-muted-foreground border border-white/[0.06]"
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
      {whites.map((i) => (
        <rect
          key={`w${i}`}
          x={i * w}
          y={0}
          width={w - 1}
          height={h}
          rx={2.5}
          className={hlWhite.has(i) ? "fill-[#f97316]" : ""}
          fill={hlWhite.has(i) ? undefined : "#f4f4f5"}
          stroke="rgba(0,0,0,0.35)"
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
          className={hlBlack.has(i) ? "fill-[#f97316]" : ""}
          fill={hlBlack.has(i) ? undefined : "rgba(8,8,12,0.88)"}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={0.6}
        />
      ))}
    </svg>
  );
}
