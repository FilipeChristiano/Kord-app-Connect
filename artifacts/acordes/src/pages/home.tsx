import { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  Search, ArrowRight, ChevronRight, Wand2, Waves, Timer, Layers,
  Lightbulb, Heart, BookOpen, Music2, GitBranch, History, Sparkles,
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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10">
      {/* ── Saudação operacional ───────────────────────────────── */}
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="mb-8"
      >
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
          {saudacao()}, músico.{" "}
          <span className="text-foreground/55 font-semibold">O que vamos estudar hoje?</span>
        </h1>
        <p className="mt-3 text-muted-foreground max-w-2xl text-body-lg">
          Explore acordes sofisticados, transforme cifras, pratique com pad contínuo e mantenha o tempo com o metrônomo inteligente.
        </p>
      </motion.header>

      {/* ── Barra de ação rápida ───────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.06, ease: EASE }}
        className="mb-10"
      >
        <form onSubmit={buscar} className="relative group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors pointer-events-none" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Busque um acorde, uma categoria ou uma cifra..."
            className="w-full bg-surface-elevated border border-white/[0.06] rounded-2xl pl-14 pr-28 py-4 text-foreground text-base placeholder:text-muted-foreground/80 shadow-lg shadow-black/10 focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all"
          />
          <button
            type="submit"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:brightness-105 transition-all"
          >
            Buscar <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-4 flex flex-wrap gap-2.5">
          <QuickAction icon={<Search />} label="Buscar acorde" href="/dicionario" />
          <QuickAction icon={<Wand2 />} label="Sofisticar cifra" href="/sofisticador" />
          <QuickAction icon={<Waves />} label="Abrir Pad" href="/pad" />
          <QuickAction icon={<Timer />} label="Abrir Metrônomo" href="/metronomo" />
        </div>
      </motion.section>

      {/* ── Ferramentas principais ─────────────────────────────── */}
      <Section title="Ferramentas principais" delay={0.12}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5 auto-rows-fr">
          <ToolCard
            icon={<Layers />}
            title="Acordes Sofisticados"
            desc="Explore acordes ricos, voicings e categorias para aplicar no teclado."
            cta="Explorar acordes"
            href="/dicionario"
            featured
            span="lg:col-span-2"
          />
          <ToolCard
            icon={<Wand2 />}
            title="Sofisticador de Cifras"
            desc="Cole uma cifra simples e receba versões mais profissionais em segundos."
            cta="Sofisticar cifra"
            href="/sofisticador"
            featured
          />
          <ToolCard
            icon={<Waves />}
            title="Pad Continuous Worship"
            desc="Crie uma cama harmônica contínua para oração, estudo ou ministração."
            cta="Abrir pad"
            href="/pad"
          />
          <ToolCard
            icon={<Timer />}
            title="Metrônomo Inteligente"
            desc="Pratique com presets, subdivisões e variações de clique para tocar com precisão."
            cta="Abrir metrônomo"
            href="/metronomo"
            span="lg:col-span-2"
          />
        </div>
      </Section>

      {/* ── Continue estudando ─────────────────────────────────── */}
      <Section title="Continue estudando" delay={0.16}>
        <div className="rounded-2xl border border-dashed border-white/[0.08] bg-card/60 px-6 py-10 flex flex-col items-center text-center">
          <span className="w-12 h-12 rounded-xl bg-surface-elevated text-primary flex items-center justify-center mb-4">
            <History className="w-6 h-6" />
          </span>
          <p className="text-foreground/80 font-medium">
            Quando você começar a estudar, seus últimos acessos aparecerão aqui.
          </p>
          <Link
            href="/dicionario"
            className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold bg-primary text-primary-foreground hover:brightness-105 transition-all text-sm"
          >
            <Search className="w-4 h-4" /> Explorar acordes
          </Link>
        </div>
      </Section>

      {/* ── Atalhos de estudo ──────────────────────────────────── */}
      <Section title="Atalhos de estudo" delay={0.2}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StudyShortcut icon={<Layers />} label="Categorias de acordes" href="/dicionario" />
          <StudyShortcut icon={<Lightbulb />} label="Aplicações práticas" href="/aplicacoes" />
          <StudyShortcut icon={<Heart />} label="Favoritos" href="/favoritos" />
          <StudyShortcut icon={<BookOpen />} label="Modo Estudo" href="/estudo" />
          <StudyShortcut icon={<GitBranch />} label="Progressões" href="/aplicacoes" />
          <StudyShortcut icon={<Music2 />} label="Voicings" href="/dicionario" />
        </div>
      </Section>

      {/* ── Favoritos ──────────────────────────────────────────── */}
      <Section
        title="Favoritos"
        delay={0.24}
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
                  <Link
                    href="/favoritos"
                    className="px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    +{favoriteChords.length - 14}
                  </Link>
                )}
              </div>
            )}
            {cifras.length > 0 && (
              <Link
                href="/favoritos"
                className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <Sparkles className="w-4 h-4 text-primary" />
                {cifras.length} {cifras.length === 1 ? "cifra sofisticada salva" : "cifras sofisticadas salvas"}
                <ChevronRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/[0.08] bg-card/60 px-6 py-10 flex flex-col items-center text-center">
            <span className="w-12 h-12 rounded-xl bg-surface-elevated text-primary flex items-center justify-center mb-4">
              <Heart className="w-6 h-6" />
            </span>
            <p className="text-foreground/80 font-medium">Nenhum favorito ainda.</p>
            <p className="mt-1.5 text-sm text-muted-foreground max-w-md">
              Salve acordes, cifras e ferramentas para acessar rapidamente depois.
            </p>
            <Link
              href="/dicionario"
              className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold bg-primary text-primary-foreground hover:brightness-105 transition-all text-sm"
            >
              <Search className="w-4 h-4" /> Explorar acordes
            </Link>
          </div>
        )}
      </Section>
    </div>
  );
}

/* ─── Subcomponentes ──────────────────────────────────────────── */

function Section({
  title,
  delay,
  action,
  children,
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
      className="mb-10"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-small font-semibold uppercase tracking-[0.18em] text-foreground/60">
          {title}
        </h2>
        {action && (
          <Link
            href={action.href}
            className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
          >
            {action.label} <ChevronRight className="w-4 h-4" />
          </Link>
        )}
      </div>
      {children}
    </motion.section>
  );
}

function QuickAction({ icon, label, href }: { icon: React.ReactNode; label: string; href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-card border border-white/[0.05] text-sm font-medium text-foreground/80 hover:text-foreground hover:border-primary/30 hover:bg-surface-elevated transition-all [&_svg]:w-4 [&_svg]:h-4 [&_svg]:text-primary"
    >
      {icon}
      {label}
    </Link>
  );
}

function ToolCard({
  icon,
  title,
  desc,
  cta,
  href,
  featured,
  span,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  cta: string;
  href: string;
  featured?: boolean;
  span?: string;
}) {
  return (
    <motion.div
      whileHover={{ y: -4, transition: { duration: 0.2, ease: EASE } }}
      className={`${span ?? ""} rounded-2xl shadow-lg shadow-black/10 transition-colors duration-200 ${
        featured
          ? "bg-primary/[0.07] border border-primary/15 hover:border-primary/30 hover:bg-primary/[0.1]"
          : "bg-card border border-white/[0.05] hover:border-white/[0.1] hover:bg-surface-elevated"
      }`}
    >
      <Link href={href} className="group flex h-full flex-col p-6 sm:p-7">
        <span
          className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 transition-transform duration-200 group-hover:scale-110 [&_svg]:w-6 [&_svg]:h-6 ${
            featured ? "bg-primary/15 text-primary" : "bg-surface-elevated text-primary"
          }`}
        >
          {icon}
        </span>
        <h3 className="text-h4 font-semibold text-foreground mb-2">{title}</h3>
        <p className="text-muted-foreground leading-relaxed text-small max-w-md">{desc}</p>
        <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
          {cta}
          <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </span>
      </Link>
    </motion.div>
  );
}

function StudyShortcut({ icon, label, href }: { icon: React.ReactNode; label: string; href: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 p-4 rounded-xl bg-card border border-white/[0.05] hover:border-white/[0.1] hover:bg-surface-elevated transition-all"
    >
      <span className="w-10 h-10 shrink-0 rounded-lg bg-surface-elevated text-primary flex items-center justify-center [&_svg]:w-5 [&_svg]:h-5 group-hover:scale-110 transition-transform">
        {icon}
      </span>
      <span className="text-sm font-semibold text-foreground/90 leading-tight">{label}</span>
      <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto shrink-0 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
    </Link>
  );
}
