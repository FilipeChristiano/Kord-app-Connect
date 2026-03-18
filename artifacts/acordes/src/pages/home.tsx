import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, BookOpen, Layers, Star, Search } from "lucide-react";
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
            
            <motion.h1 variants={itemVariants} className="font-display text-5xl sm:text-6xl md:text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60 mb-6 leading-tight">
              Dicionário de <br className="hidden sm:block" />
              <span className="text-primary bg-none">Acordes Sofisticados</span>
            </motion.h1>
            
            <motion.p variants={itemVariants} className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl leading-relaxed">
              Saia do som básico. Descubra harmonias ricas, entenda suas construções e aplique acordes profissionais nas suas músicas com clareza visual.
            </motion.p>
            
            <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              <Link href="/dicionario" className="px-8 py-4 rounded-xl font-bold bg-primary text-primary-foreground hover:bg-amber-400 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/40 hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center gap-2">
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
              delay={0.1}
            />
            <FeatureCard 
              icon={<Layers />}
              title="Categorias Organizadas"
              desc="Explore de acordes com nona a opções suspensas e substituições avançadas."
              delay={0.2}
            />
            <FeatureCard 
              icon={<BookOpen />}
              title="Modo Estudo"
              desc="Pratique a memorização com flashcards interativos por categoria."
              delay={0.3}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({ icon, title, desc, delay }: { icon: React.ReactNode, title: string, desc: string, delay: number }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.5, delay }}
      className="glass-card rounded-2xl p-8 hover:border-primary/30 transition-colors group"
    >
      <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center text-primary mb-6 group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
      <p className="text-muted-foreground leading-relaxed">{desc}</p>
    </motion.div>
  );
}
