import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lightbulb, ChevronDown, ChevronUp, Music2, Zap, BookOpen } from "lucide-react";
import { CATEGORY_APPLICATIONS, CategoryApplication } from "@/data/applications";
import { CATEGORY_COLORS } from "@/data/chords";

function ProgressionChip({ chords }: { chords: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {chords.map((chord, i) => (
        <span key={i} className="flex items-center gap-2">
          <span className="font-mono font-bold text-sm bg-primary/20 border border-primary/40 text-primary px-3 py-1.5 rounded-lg">
            {chord}
          </span>
          {i < chords.length - 1 && (
            <span className="text-muted-foreground text-xs">→</span>
          )}
        </span>
      ))}
    </div>
  );
}

function CategoryCard({ app }: { app: CategoryApplication }) {
  const [expanded, setExpanded] = useState(false);
  const badgeClass =
    CATEGORY_COLORS[app.category] ||
    "bg-amber-500/10 text-amber-400 border-amber-500/20";

  return (
    <motion.div
      layout
      className="glass-card rounded-2xl border border-white/5 overflow-hidden"
    >
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-4 p-5 sm:p-6 text-left hover:bg-white/[0.02] transition-colors"
      >
        <span className="text-2xl select-none">{app.icon}</span>
        <div className="flex-1 min-w-0">
          <span
            className={`inline-flex text-xs font-bold px-2.5 py-1 rounded-full border mb-2 ${badgeClass}`}
          >
            {app.category}
          </span>
          <p className="text-white/70 text-sm line-clamp-2 leading-relaxed">
            {app.summary}
          </p>
        </div>
        <div className="shrink-0 text-muted-foreground">
          {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-5 sm:px-6 pb-6 space-y-6 border-t border-white/5 pt-5">

              {/* Contexts */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Music2 className="w-4 h-4 text-primary" />
                  <h3 className="text-xs font-bold text-primary uppercase tracking-widest">
                    Onde usar
                  </h3>
                </div>
                <ul className="space-y-1.5">
                  {app.contexts.map((ctx, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-white/70">
                      <span className="text-primary mt-1 shrink-0">•</span>
                      {ctx}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Tips */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <h3 className="text-xs font-bold text-amber-400 uppercase tracking-widest">
                    Dicas práticas
                  </h3>
                </div>
                <div className="space-y-3">
                  {app.tips.map((tip, i) => (
                    <div key={i} className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
                      <p className="text-sm font-semibold text-white mb-1">{tip.title}</p>
                      <p className="text-sm text-white/60 leading-relaxed">{tip.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Progressions */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-widest">
                    Progressões de exemplo
                  </h3>
                </div>
                <div className="space-y-3">
                  {app.progressions.map((prog, i) => (
                    <div key={i} className="bg-emerald-500/5 border border-emerald-500/15 rounded-xl p-4">
                      <p className="text-xs font-bold text-emerald-400 mb-2 uppercase tracking-widest">
                        {prog.label}
                      </p>
                      <ProgressionChip chords={prog.chords} />
                      <p className="text-xs text-white/50 mt-2 leading-relaxed">{prog.context}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function Applications() {
  const [search, setSearch] = useState("");

  const filtered = CATEGORY_APPLICATIONS.filter(
    (a) =>
      a.category.toLowerCase().includes(search.toLowerCase()) ||
      a.summary.toLowerCase().includes(search.toLowerCase()) ||
      a.contexts.some((c) => c.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 lg:py-12">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <Lightbulb className="w-5 h-5 text-primary" />
          </div>
          <h1 className="font-display text-3xl font-bold text-white">Guia de Aplicações</h1>
        </div>
        <p className="text-muted-foreground text-base leading-relaxed">
          Para cada categoria de acordes, veja onde usar, dicas práticas e progressões de
          exemplo para o seu repertório.
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <input
          type="text"
          placeholder="Buscar categoria ou contexto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-secondary/50 border border-white/10 rounded-xl px-5 py-3 text-white placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
        />
      </div>

      {/* Cards */}
      <motion.div layout className="space-y-3">
        <AnimatePresence mode="popLayout">
          {filtered.map((app) => (
            <motion.div
              key={app.category}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <CategoryCard app={app} />
            </motion.div>
          ))}
        </AnimatePresence>
        {filtered.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            Nenhuma categoria encontrada para "{search}".
          </div>
        )}
      </motion.div>
    </div>
  );
}
