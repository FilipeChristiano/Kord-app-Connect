import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, BookOpen, Layers, Star, Search, Lightbulb, Wand2 } from "lucide-react";
import { CHORDS, CATEGORIES } from "@/data/chords";

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
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
  };

  return (
    <div className="w-full">
      {/* Hero Section */}
      <section className="relative pt-24 pb-32 lg:pt-36 lg:pb-48 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src={`${import.meta.env.BASE_URL}images/hero-bg.png`} 
            alt="Piano keys" 
            className="w-full h-full object-cover opacity-20 object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/80 to-background"></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={containerVariants}
            className="max-w-3xl mx-auto flex flex-col items-center"
          >
            <motion.div variants={itemVariants} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-6">
              <Star className="w-4 h-4" />
              Para tecladistas e pianistas
            </motion.div>
            
            <motion.div variants={itemVariants} className="flex flex-col items-center gap-5 mb-6">
              <img
                src={`${import.meta.env.BASE_URL}logo.png`}
                alt=""
                aria-hidden="true"
                className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-2xl shadow-2xl shadow-primary/30"
              />
              <h1 className="sr-only">Harmonic — Acordes Sofisticados</h1>
              <img
                src={`${import.meta.env.BASE_URL}wordmark.png`}
                alt="Harmonic"
                className="w-full max-w-[520px] sm:max-w-[640px] md:max-w-[760px] h-auto select-none"
                draggable={false}
              />
            </motion.div>
            <motion.p variants={itemVariants} className="font-display text-xs sm:text-sm text-white/60 mb-6 tracking-[0.35em] uppercase">
              Acordes Sofisticados
            </motion.p>
            
            <motion.p variants={itemVariants} className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl leading-relaxed">
              Saia do som básico. Descubra harmonias ricas, entenda suas construções e aplique acordes profissionais nas suas músicas com clareza visual.
            </motion.p>
            
            <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              <Link href="/dicionario" className="px-8 py-4 rounded-xl font-bold bg-primary text-primary-foreground hover:bg-orange-400 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/40 hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center gap-2">
                Explorar Acordes <ArrowRight className="w-5 h-5" />
              </Link>
              <Link href="/estudo" className="px-8 py-4 rounded-xl font-bold bg-secondary text-white hover:bg-secondary/80 border border-white/5 hover:border-white/10 transition-all duration-300 flex items-center justify-center gap-2">
                <BookOpen className="w-5 h-5" /> Modo Estudo
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Stats Strip */}
      <section className="border-y border-white/5 bg-black/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 py-10 divide-x divide-white/5">
            {[
              { label: "Acordes", value: CHORDS.length },
              { label: "Categorias", value: CATEGORIES.length },
              { label: "Aplicações", value: "Práticas" },
              { label: "Acesso", value: "Offline" },
            ].map((stat, i) => (
              <div key={i} className="text-center px-4">
                <div className="font-display text-3xl font-bold text-white mb-1">{stat.value}</div>
                <div className="text-sm text-muted-foreground uppercase tracking-wider">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-4">Aprenda de forma visual e intuitiva</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">Tudo foi desenhado para facilitar a memorização e aplicação prática no instrumento.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard 
              icon={<Search />}
              title="Busca Rápida"
              desc="Encontre acordes pelo nome ou pelas notas que o compõem instantaneamente."
              href="/dicionario"
              delay={0.1}
            />
            <FeatureCard 
              icon={<Layers />}
              title="180 Acordes — 15 Categorias"
              desc="Tríades, 7ªM, 9ª, 6/9, sus4, sus2, diminutos, meio-diminutos, voicings de mão esquerda e mais."
              href="/dicionario"
              delay={0.2}
            />
            <FeatureCard 
              icon={<Lightbulb />}
              title="Guia de Aplicações"
              desc="Para cada categoria, veja onde usar, dicas práticas e progressões de exemplo reais."
              href="/aplicacoes"
              delay={0.3}
              highlight
            />
            <FeatureCard 
              icon={<Wand2 />}
              title="Sofisticador de Cifra"
              desc="Cole a cifra de qualquer música e receba versões sofisticadas dos acordes em 3 níveis."
              href="/sofisticador"
              delay={0.4}
              highlight
            />
            <FeatureCard 
              icon={<BookOpen />}
              title="Modo Estudo"
              desc="Pratique a memorização com flashcards interativos por categoria de acordes."
              href="/estudo"
              delay={0.5}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({ icon, title, desc, delay, href, highlight }: { icon: React.ReactNode, title: string, desc: string, delay: number, href?: string, highlight?: boolean }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.5, delay }}
      className={`rounded-2xl p-8 transition-all group cursor-pointer ${highlight ? "bg-primary/10 border border-primary/25 hover:border-primary/50 hover:bg-primary/15" : "glass-card hover:border-primary/30"}`}
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

function FeatureCardInner({ icon, title, desc, highlight }: { icon: React.ReactNode, title: string, desc: string, highlight?: boolean }) {
  return (
    <>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform ${highlight ? "bg-primary/20 text-primary" : "bg-secondary text-primary"}`}>
        {icon}
      </div>
      <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
      <p className="text-muted-foreground leading-relaxed">{desc}</p>
    </>
  );
}
