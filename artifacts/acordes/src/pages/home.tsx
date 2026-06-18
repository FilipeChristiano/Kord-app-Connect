import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, BookOpen, Layers, Star, Search, Lightbulb, Wand2, Timer, Waves, ChevronDown } from "lucide-react";

const EASE = [0.4, 0, 0.2, 1] as const;

export default function Home() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } }
  };

  return (
    <div className="w-full">
      {/* Hero Section */}
      <section className="relative pt-10 pb-14 lg:pt-14 lg:pb-20 overflow-hidden">
        <div className="absolute inset-x-0 bottom-0 -top-24 z-0">
          <img
            src={`${import.meta.env.BASE_URL}images/hero-bg.png`}
            alt=""
            aria-hidden="true"
            className="w-full h-full object-cover opacity-[0.14] brightness-75 blur-[2px] object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-background/80 to-background"></div>
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
              <h1 className="sr-only">Harmonic — Acordes Sofisticados</h1>
              <img
                src={`${import.meta.env.BASE_URL}harmonic-logo-hero.png`}
                alt="Harmonic"
                className="w-full max-w-[360px] sm:max-w-[440px] md:max-w-[510px] h-auto select-none drop-shadow-2xl"
                draggable={false}
              />
            </motion.div>

            <motion.p variants={itemVariants} className="text-body-lg text-foreground/80 -mt-6 sm:-mt-8 mb-9 sm:mb-10 max-w-xl">
              Saia do som básico. Descubra harmonias ricas, entenda suas construções e aplique acordes profissionais nas suas músicas com clareza visual.
            </motion.p>

            <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              <Link href="/dicionario" className="px-8 py-4 rounded-2xl font-bold bg-primary text-primary-foreground glow-primary hover:brightness-105 hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-center gap-2">
                Explorar Acordes <ArrowRight className="w-5 h-5" />
              </Link>
              <Link href="/sofisticador" className="px-8 py-4 rounded-2xl font-bold bg-surface-elevated/80 text-foreground border border-white/10 shadow-[0_4px_16px_-8px_rgba(0,0,0,0.6)] hover:border-primary/30 hover:bg-surface-elevated hover:-translate-y-0.5 hover:shadow-[0_6px_22px_-8px_hsl(var(--primary)/0.3)] transition-all duration-200 flex items-center justify-center gap-2">
                <Wand2 className="w-5 h-5 text-primary" /> Sofisticador de Cifras
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Slogan Strip */}
      <section className="relative border-y border-white/5">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_120%_at_center,_hsl(var(--primary)/0.07),_transparent_70%)] pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-7 relative">
          <h2 className="font-display font-semibold leading-tight text-center whitespace-nowrap text-[clamp(1rem,3.8vw,2.5rem)] text-foreground/90">
            O <span className="text-gradient-primary">próximo nível</span> do seu teclado.
          </h2>
        </div>
        {/* Seta entre a faixa e a seção de baixo */}
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute left-1/2 -ml-5 bottom-[-20px] z-20 flex items-center justify-center w-10 h-10 rounded-full border border-primary/30 bg-background text-primary shadow-lg"
          aria-hidden="true"
        >
          <ChevronDown className="w-5 h-5" />
        </motion.div>
      </section>

      {/* Features Section */}
      <section className="py-20 lg:py-24 relative">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-12 lg:mb-16">
            <p className="text-small font-semibold uppercase tracking-[0.2em] text-primary mb-3">Recursos</p>
            <h2 className="text-h2 font-bold text-foreground mb-4 max-w-2xl">Aprenda de forma visual e intuitiva</h2>
            <p className="text-muted-foreground max-w-2xl text-body-lg">Tudo foi desenhado para facilitar a memorização e aplicação prática no instrumento.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-fr">
            <FeatureCard
              icon={<Search />}
              title="Busca Rápida"
              desc="Encontre acordes pelo nome ou pelas notas que o compõem."
              href="/dicionario"
              delay={0.05}
            />
            <FeatureCard
              icon={<Layers />}
              title="180 Acordes — 15 Categorias"
              desc="Tríades, 7ªM, 9ª, 6/9, sus, diminutos, voicings de mão esquerda e mais."
              href="/dicionario"
              delay={0.1}
            />
            <FeatureCard
              icon={<Lightbulb />}
              title="Guia de Aplicações"
              desc="Onde usar cada categoria, com dicas práticas e progressões reais."
              href="/aplicacoes"
              delay={0.15}
              highlight
            />
            <FeatureCard
              icon={<Wand2 />}
              title="Sofisticador de Cifra"
              desc="Cole a cifra de qualquer música e receba versões sofisticadas dos acordes em 3 níveis."
              href="/sofisticador"
              delay={0.2}
              highlight
              wide
            />
            <FeatureCard
              icon={<Timer />}
              title="Metrônomo Inteligente"
              desc="Presets de worship e gospel, tap tempo e subdivisões."
              href="/metronomo"
              delay={0.25}
              highlight
            />
            <FeatureCard
              icon={<Waves />}
              title="Pad Worship Contínuo"
              desc="Cama harmônica em loop infinito, em qualquer tom — para oração e ministração."
              href="/pad"
              delay={0.3}
              highlight
              wide
            />
            <FeatureCard
              icon={<BookOpen />}
              title="Modo Estudo"
              desc="Memorize com flashcards interativos por categoria."
              href="/estudo"
              delay={0.35}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({ icon, title, desc, delay, href, highlight, wide }: { icon: React.ReactNode, title: string, desc: string, delay: number, href?: string, highlight?: boolean, wide?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, delay, ease: EASE }}
      whileHover={{ y: -4, scale: 1.02, transition: { duration: 0.2, ease: EASE } }}
      className={cardClass(highlight, wide)}
    >
      {href ? (
        <Link href={href} className="block h-full">
          <FeatureCardInner icon={icon} title={title} desc={desc} highlight={highlight} />
        </Link>
      ) : (
        <FeatureCardInner icon={icon} title={title} desc={desc} highlight={highlight} />
      )}
    </motion.div>
  );
}

function cardClass(highlight?: boolean, wide?: boolean) {
  const base = "rounded-2xl p-7 transition-all duration-200 group cursor-pointer shadow-lg shadow-black/10";
  const span = wide ? " lg:col-span-2" : "";
  return highlight
    ? `${base}${span} bg-primary/[0.07] border border-primary/15 hover:border-primary/30 hover:bg-primary/[0.1]`
    : `${base}${span} bg-card border border-white/[0.04] hover:border-white/[0.08] hover:bg-surface-elevated`;
}

function FeatureCardInner({ icon, title, desc, highlight }: { icon: React.ReactNode, title: string, desc: string, highlight?: boolean }) {
  return (
    <>
      <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-6 transition-transform duration-200 group-hover:scale-110 [&_svg]:w-7 [&_svg]:h-7 ${highlight ? "bg-primary/15 text-primary" : "bg-surface-elevated text-primary"}`}>
        {icon}
      </div>
      <h3 className="text-h4 font-semibold text-foreground mb-2.5">{title}</h3>
      <p className="text-muted-foreground leading-relaxed text-small">{desc}</p>
    </>
  );
}
