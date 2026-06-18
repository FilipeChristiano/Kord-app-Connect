import { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  Search, ArrowRight, ArrowDown, ChevronRight, Wand2, Waves, Timer,
  Layers, Heart, Sparkles, History,
} from "lucide-react";
import { CHORDS } from "@/data/chords";
import { useFavorites } from "@/hooks/use-favorites";
import { useCifrasFavoritas } from "@/hooks/use-cifras-favoritas";

const EASE = [0.4, 0, 0.2, 1] as const;

function saudacao() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export default function Home() {
  const [, navigate] = useLocation();
  const [busca, setBusca] = useState("");
  const { favorites } = useFavorites();
  const { cifras } = useCifrasFavoritas();

  const favoriteChords = CHORDS.filter((c) => favorites.includes(c.id));
  const temFavoritos = favorites.length > 0 || cifras.length > 0;

  function buscar(e: React.FormEvent) {
    e.preventDefault();
    const q = busca.trim();
    navigate(q ? `/dicionario?q=${encodeURIComponent(q)}` : "/dicionario");
  }

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
      {/* ── Saudação ───────────────────────────────────────────── */}
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="mb-8 lg:mb-10"
      >
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
          {saudacao()}, músico.
        </h1>
        <p className="mt-2.5 text-muted-foreground text-body-lg">
          Escolha uma ferramenta para começar.
        </p>
      </motion.header>

      {/* ── Busca principal ────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.06, ease: EASE }}
        className="mb-14"
      >
        <form onSubmit={buscar} className="relative group max-w-3xl">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors pointer-events-none" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Busque um acorde, uma categoria ou cole uma cifra…"
            className="w-full bg-surface-elevated border border-white/[0.06] rounded-2xl pl-14 pr-28 py-4 text-foreground text-base placeholder:text-muted-foreground/80 shadow-lg shadow-black/10 focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all"
          />
          <button
            type="submit"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:brightness-105 active:scale-[0.97] transition-all"
          >
            Buscar <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          <QuickChip icon={<Search />} label="Buscar acorde" href="/dicionario" />
          <QuickChip icon={<Wand2 />} label="Sofisticar cifra" href="/sofisticador" />
          <QuickChip icon={<Timer />} label="Abrir metrônomo" href="/metronomo" />
        </div>
      </motion.section>

      {/* ── Comece por aqui ────────────────────────────────────── */}
      <Section title="Comece por aqui" delay={0.12}>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          <AcordesCard />
          <SofisticadorCard />
        </div>
      </Section>

      {/* ── Ferramentas rápidas ────────────────────────────────── */}
      <Section title="Ferramentas rápidas" delay={0.16}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <PadCard />
          <MetronomoCard />
        </div>
      </Section>

      {/* ── Continue estudando ─────────────────────────────────── */}
      <Section title="Continue estudando" delay={0.2}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-2xl border border-white/[0.06] bg-card/60 px-5 py-4">
          <span className="w-10 h-10 shrink-0 rounded-xl bg-surface-elevated text-muted-foreground flex items-center justify-center">
            <History className="w-5 h-5" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-foreground/90 font-semibold text-sm">Nada por aqui ainda</p>
            <p className="text-muted-foreground text-sm mt-0.5">
              Seus últimos acordes, cifras e estudos aparecerão aqui.
            </p>
          </div>
          <Link
            href="/dicionario"
            className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl font-semibold bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-all text-sm"
          >
            Explorar acordes <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </Section>

      {/* ── Sugestões para estudar ─────────────────────────────── */}
      <Section title="Sugestões para estudar" delay={0.24}>
        <div className="flex flex-wrap gap-2.5">
          <Suggestion label="Acordes com 9ª" href={`/dicionario?q=${encodeURIComponent("Com 9ª")}`} />
          <Suggestion label="Acordes sus4" href={`/dicionario?q=${encodeURIComponent("Sus4")}`} />
          <Suggestion label="Acordes com 6ª" href={`/dicionario?q=${encodeURIComponent("Com 6ª")}`} />
          <Suggestion label="Voicings de mão esquerda" href={`/dicionario?q=${encodeURIComponent("Mão Esquerda")}`} />
          <Suggestion label="Progressões worship" href="/aplicacoes" />
          <Suggestion label="Campo harmônico maior" href="/aplicacoes" />
        </div>
      </Section>

      {/* ── Favoritos ──────────────────────────────────────────── */}
      <Section
        title="Favoritos"
        delay={0.28}
        action={temFavoritos ? { label: "Ver todos", href: "/favoritos" } : undefined}
      >
        {temFavoritos ? (
          <div className="rounded-2xl border border-white/[0.06] bg-card px-5 py-5">
            {favoriteChords.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {favoriteChords.slice(0, 14).map((chord) => (
                  <Link
                    key={chord.id}
                    href={`/acorde/${chord.id}`}
                    className="px-3 py-1.5 rounded-lg bg-surface-elevated border border-white/[0.06] font-mono text-sm text-foreground/90 hover:border-primary/40 hover:text-primary transition-all"
                  >
                    {chord.name}
                  </Link>
                ))}
                {favoriteChords.length > 14 && (
                  <Link href="/favoritos" className="px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors">
                    +{favoriteChords.length - 14}
                  </Link>
                )}
              </div>
            )}
            {cifras.length > 0 && (
              <Link href="/favoritos" className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
                <Sparkles className="w-4 h-4 text-primary" />
                {cifras.length} {cifras.length === 1 ? "cifra sofisticada salva" : "cifras sofisticadas salvas"}
                <ChevronRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-2xl border border-white/[0.06] bg-card/60 px-5 py-4">
            <span className="w-10 h-10 shrink-0 rounded-xl bg-surface-elevated text-muted-foreground flex items-center justify-center">
              <Heart className="w-5 h-5" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-foreground/90 font-semibold text-sm">Nenhum favorito ainda</p>
              <p className="text-muted-foreground text-sm mt-0.5">
                Salve acordes e cifras para acessar rapidamente depois.
              </p>
            </div>
            <Link
              href="/dicionario"
              className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl font-semibold bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-all text-sm"
            >
              Explorar acordes <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </Section>
    </div>
  );
}

/* ─── Layout helpers ──────────────────────────────────────────── */

function Section({
  title, delay, action, children,
}: {
  title: string;
  delay: number;
  action?: { label: string; href: string };
  children: React.ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay, ease: EASE }}
      className="mb-12"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-small font-semibold uppercase tracking-[0.18em] text-foreground/55">{title}</h2>
        {action && (
          <Link href={action.href} className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
            {action.label} <ChevronRight className="w-4 h-4" />
          </Link>
        )}
      </div>
      {children}
    </motion.section>
  );
}

function QuickChip({ icon, label, href }: { icon: React.ReactNode; label: string; href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-card border border-white/[0.05] text-sm font-medium text-foreground/75 hover:text-foreground hover:border-primary/30 hover:bg-surface-elevated transition-all [&_svg]:w-3.5 [&_svg]:h-3.5 [&_svg]:text-primary"
    >
      {icon}
      {label}
    </Link>
  );
}

function Suggestion({ label, href }: { label: string; href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-card border border-white/[0.05] text-sm font-medium text-foreground/75 hover:text-foreground hover:border-primary/30 hover:bg-surface-elevated transition-all group"
    >
      {label}
      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
    </Link>
  );
}

/* ─── Visual decorations ──────────────────────────────────────── */

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

/* ─── Cards principais ────────────────────────────────────────── */

function AcordesCard() {
  const bubbles = [
    { name: "Cmaj9", c: "top-1 left-2" },
    { name: "Am11", c: "top-0 right-6" },
    { name: "F7M(9)", c: "top-12 left-12" },
    { name: "G13", c: "top-14 right-0" },
    { name: "Dm9", c: "top-24 left-0" },
  ];
  return (
    <motion.div
      whileHover={{ y: -3, transition: { duration: 0.2, ease: EASE } }}
      className="lg:col-span-3 relative overflow-hidden rounded-2xl border border-primary/15 bg-primary/[0.06] shadow-lg shadow-black/10 hover:border-primary/30 transition-colors duration-200"
    >
      <div className="absolute -top-16 -right-10 w-72 h-72 rounded-full bg-primary/15 blur-3xl pointer-events-none" />
      <Link href="/dicionario" className="group relative flex flex-col sm:flex-row h-full">
        <div className="flex-1 p-6 sm:p-8 flex flex-col">
          <span className="w-12 h-12 rounded-xl bg-primary/15 text-primary flex items-center justify-center mb-5 [&_svg]:w-6 [&_svg]:h-6 group-hover:scale-110 transition-transform">
            <Layers />
          </span>
          <h3 className="font-display text-2xl font-bold text-foreground mb-2">Acordes Sofisticados</h3>
          <p className="text-muted-foreground leading-relaxed text-small max-w-sm">
            Explore voicings ricos, categorias e aplicações para tocar com mais musicalidade.
          </p>
          <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
            Explorar acordes
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </div>

        {/* Visual: bolhas de acordes + mini teclado */}
        <div className="relative shrink-0 sm:w-[46%] min-h-[180px] sm:min-h-0 px-6 pb-6 sm:p-6 flex flex-col justify-end">
          <div className="relative h-32 hidden sm:block">
            {bubbles.map((b) => (
              <span
                key={b.name}
                className={`absolute ${b.c} px-2.5 py-1 rounded-lg bg-surface-elevated/90 border border-white/[0.08] font-mono text-xs text-foreground/85 shadow-md backdrop-blur-sm`}
              >
                {b.name}
              </span>
            ))}
          </div>
          <MiniKeyboard className="w-full max-w-[260px] mx-auto sm:mx-0 sm:ml-auto opacity-90" />
        </div>
      </Link>
    </motion.div>
  );
}

function SofisticadorCard() {
  const antes = ["C", "G", "Am", "F"];
  const depois = ["C9", "G/B", "Am11", "F7M(9)"];
  return (
    <motion.div
      whileHover={{ y: -3, transition: { duration: 0.2, ease: EASE } }}
      className="lg:col-span-2 relative overflow-hidden rounded-2xl border border-white/[0.07] bg-card shadow-lg shadow-black/10 hover:border-primary/25 hover:bg-surface-elevated transition-colors duration-200"
    >
      <Link href="/sofisticador" className="group flex h-full flex-col p-6 sm:p-7">
        <span className="w-12 h-12 rounded-xl bg-surface-elevated text-primary flex items-center justify-center mb-5 [&_svg]:w-6 [&_svg]:h-6 group-hover:scale-110 transition-transform">
          <Wand2 />
        </span>
        <h3 className="font-display text-xl font-bold text-foreground mb-2">Sofisticador de Cifras</h3>
        <p className="text-muted-foreground leading-relaxed text-small">
          Cole uma cifra simples e receba versões mais profissionais em segundos.
        </p>

        {/* Antes / depois */}
        <div className="mt-5 rounded-xl border border-white/[0.06] bg-background/40 p-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Antes</p>
          <div className="flex flex-wrap gap-1.5">
            {antes.map((a) => (
              <span key={a} className="px-2 py-0.5 rounded-md bg-white/[0.04] font-mono text-xs text-muted-foreground">{a}</span>
            ))}
          </div>
          <div className="flex justify-center my-2 text-primary/70"><ArrowDown className="w-4 h-4" /></div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-primary/80 mb-1.5">Depois</p>
          <div className="flex flex-wrap gap-1.5">
            {depois.map((d) => (
              <span key={d} className="px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 font-mono text-xs text-primary font-semibold">{d}</span>
            ))}
          </div>
        </div>

        <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
          Sofisticar cifra
          <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </span>
      </Link>
    </motion.div>
  );
}

function PadCard() {
  const bars = [0.5, 0.8, 1, 0.65, 0.9, 0.55, 0.78, 0.6];
  const tons = ["C", "D", "E", "F", "G"];
  return (
    <motion.div
      whileHover={{ y: -3, transition: { duration: 0.2, ease: EASE } }}
      className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-card shadow-lg shadow-black/10 hover:border-primary/25 hover:bg-surface-elevated transition-colors duration-200"
    >
      <Link href="/pad" className="group flex h-full flex-col p-6 sm:p-7">
        <div className="flex items-center justify-between mb-5">
          <span className="w-12 h-12 rounded-xl bg-surface-elevated text-primary flex items-center justify-center [&_svg]:w-6 [&_svg]:h-6 group-hover:scale-110 transition-transform">
            <Waves />
          </span>
          {/* Ondas */}
          <div className="flex items-end gap-1 h-9">
            {bars.map((h, i) => (
              <motion.span
                key={i}
                className="w-1.5 rounded-full bg-primary/55"
                style={{ height: 36, transformOrigin: "bottom" }}
                initial={{ scaleY: h * 0.5 }}
                animate={{ scaleY: [h * 0.45, h, h * 0.55] }}
                transition={{ duration: 1.3 + i * 0.12, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
              />
            ))}
          </div>
        </div>
        <h3 className="font-display text-lg font-bold text-foreground mb-1.5">Pad Continuous Worship</h3>
        <p className="text-muted-foreground leading-relaxed text-small">
          Cama harmônica contínua para oração, estudo ou ministração.
        </p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {tons.map((t) => (
            <span key={t} className="px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.06] font-mono text-xs text-foreground/70">{t}</span>
          ))}
        </div>
        <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
          Abrir pad
          <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </span>
      </Link>
    </motion.div>
  );
}

function MetronomoCard() {
  return (
    <motion.div
      whileHover={{ y: -3, transition: { duration: 0.2, ease: EASE } }}
      className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-card shadow-lg shadow-black/10 hover:border-primary/25 hover:bg-surface-elevated transition-colors duration-200"
    >
      <Link href="/metronomo" className="group flex h-full flex-col p-6 sm:p-7">
        <div className="flex items-center justify-between mb-5">
          <span className="w-12 h-12 rounded-xl bg-surface-elevated text-primary flex items-center justify-center [&_svg]:w-6 [&_svg]:h-6 group-hover:scale-110 transition-transform">
            <Timer />
          </span>
          {/* BPM + pulso */}
          <div className="flex items-center gap-3">
            <div className="text-right leading-none">
              <span className="font-display text-2xl font-bold text-foreground">120</span>
              <span className="ml-1 text-xs font-semibold text-muted-foreground">BPM</span>
              <p className="text-[10px] font-mono text-muted-foreground mt-1">4/4</p>
            </div>
            <div className="flex items-center gap-1.5">
              {[0, 1, 2, 3].map((i) => (
                <motion.span
                  key={i}
                  className={`w-2 h-2 rounded-full ${i === 0 ? "bg-primary" : "bg-white/15"}`}
                  animate={i === 0 ? { scale: [1, 1.5, 1], opacity: [1, 0.6, 1] } : undefined}
                  transition={i === 0 ? { duration: 1, repeat: Infinity, ease: "easeInOut" } : undefined}
                />
              ))}
            </div>
          </div>
        </div>
        <h3 className="font-display text-lg font-bold text-foreground mb-1.5">Metrônomo Inteligente</h3>
        <p className="text-muted-foreground leading-relaxed text-small">
          Pratique com presets, subdivisões e variações de clique para tocar com precisão.
        </p>
        <span className="mt-auto pt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
          Abrir metrônomo
          <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </span>
      </Link>
    </motion.div>
  );
}
