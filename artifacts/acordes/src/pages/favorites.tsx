import { useState } from "react";
import { Heart, Search, Music2, Wand2, Trash2, ArrowRight, Copy, Check, BookOpen } from "lucide-react";
import { Link, useLocation } from "wouter";
import { CHORDS } from "@/data/chords";
import { ChordCard } from "@/components/ChordCard";
import { useFavorites } from "@/hooks/use-favorites";
import { useCifrasFavoritas, CifraFavorita } from "@/hooks/use-cifras-favoritas";
import { motion, AnimatePresence } from "framer-motion";

const NIVEL_LABELS: Record<string, { label: string; color: string }> = {
  suave: { label: "Suave", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
  intermediario: { label: "Intermediário", color: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
  avancado: { label: "Avançado", color: "text-rose-400 bg-rose-500/10 border-rose-500/30" },
};

function CifraCard({ cifra, onRemover }: { cifra: CifraFavorita; onRemover: (id: string) => void }) {
  const [, navigate] = useLocation();
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const nivel = NIVEL_LABELS[cifra.nivel] ?? NIVEL_LABELS.intermediario;

  const handleCopy = () => {
    navigator.clipboard.writeText(cifra.textoSofisticado).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const linhas = cifra.textoSofisticado.split("\n");

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 flex flex-col gap-4 hover:border-white/20 transition-all"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-bold text-white text-base leading-tight truncate">
            {cifra.titulo}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {new Date(cifra.salvoEm).toLocaleDateString("pt-BR", {
              day: "2-digit", month: "short", year: "numeric",
            })}
          </p>
        </div>
        <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${nivel.color}`}>
          {nivel.label}
        </span>
      </div>

      {/* Preview da cifra sofisticada */}
      <div className="bg-primary/5 border border-primary/15 rounded-xl px-4 py-3 font-mono text-xs text-white/70 leading-loose overflow-hidden max-h-[100px]">
        {linhas.slice(0, 4).map((linha, i) => (
          <span key={i} className="block whitespace-pre-wrap">{linha || "\u00A0"}</span>
        ))}
        {linhas.length > 4 && (
          <span className="text-white/30">+ {linhas.length - 4} linhas...</span>
        )}
      </div>

      {/* Substituições */}
      {cifra.mudancas.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {cifra.mudancas.slice(0, 6).map((m, i) => (
            <button
              key={i}
              onClick={() => {
                const chordId = m.substituted.replace(/[^a-zA-Z0-9#b]/g, "").toLowerCase();
                navigate(`/acorde/${encodeURIComponent(m.substituted)}`);
              }}
              className="flex items-center gap-1 bg-white/[0.04] border border-white/10 rounded-md px-2 py-1 hover:bg-white/[0.08] transition-colors"
            >
              <span className="text-white/40 text-[10px] font-mono">{m.original}</span>
              <ArrowRight className="w-2.5 h-2.5 text-muted-foreground" />
              <span className="text-primary text-[10px] font-mono font-bold">{m.substituted}</span>
            </button>
          ))}
          {cifra.mudancas.length > 6 && (
            <span className="text-[10px] text-white/30 self-center">+{cifra.mudancas.length - 6}</span>
          )}
        </div>
      )}

      {/* Ações */}
      <div className="flex gap-2 mt-auto pt-1">
        <button
          onClick={handleCopy}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-lg bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-all"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copiado!" : "Copiar cifra"}
        </button>

        {confirmDelete ? (
          <div className="flex gap-1">
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-xs px-3 py-2 rounded-lg border border-white/10 text-white/40 hover:bg-white/5 transition-all"
            >
              Não
            </button>
            <button
              onClick={() => onRemover(cifra.id)}
              className="text-xs px-3 py-2 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 transition-all"
            >
              Sim, excluir
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="p-2 rounded-lg border border-white/10 text-white/30 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/10 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </motion.div>
  );
}

type Tab = "acordes" | "cifras";

export default function Favorites() {
  const [tab, setTab] = useState<Tab>("acordes");
  const { favorites, favoritesCount } = useFavorites();
  const { cifras, cifrasCount, removerCifra } = useCifrasFavoritas();

  const favoriteChords = CHORDS.filter((chord) => favorites.includes(chord.id));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold text-white mb-2 flex items-center gap-3">
            <Heart className="w-8 h-8 text-primary fill-primary" />
            Meus Favoritos
          </h1>
          <p className="text-muted-foreground">Sua coleção pessoal de acordes e cifras sofisticadas.</p>
        </div>
        <div className="flex gap-3">
          <div className="bg-secondary/50 border border-white/5 px-4 py-2 rounded-lg text-sm font-medium text-white inline-flex items-center gap-2 w-max">
            <Music2 className="w-4 h-4 text-primary" />
            {favoritesCount} {favoritesCount === 1 ? "acorde" : "acordes"}
          </div>
          <div className="bg-secondary/50 border border-white/5 px-4 py-2 rounded-lg text-sm font-medium text-white inline-flex items-center gap-2 w-max">
            <Wand2 className="w-4 h-4 text-rose-400" />
            {cifrasCount} {cifrasCount === 1 ? "cifra" : "cifras"}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 border border-white/10 rounded-xl p-1 w-fit mb-8">
        <button
          onClick={() => setTab("acordes")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
            tab === "acordes"
              ? "bg-white/10 text-white"
              : "text-muted-foreground hover:text-white"
          }`}
        >
          <Music2 className="w-4 h-4" />
          Acordes
          {favoritesCount > 0 && (
            <span className="bg-primary/30 text-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {favoritesCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("cifras")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
            tab === "cifras"
              ? "bg-white/10 text-white"
              : "text-muted-foreground hover:text-white"
          }`}
        >
          <Wand2 className="w-4 h-4" />
          Cifras Sofisticadas
          {cifrasCount > 0 && (
            <span className="bg-rose-500/30 text-rose-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {cifrasCount}
            </span>
          )}
        </button>
      </div>

      {/* Tab: Acordes */}
      <AnimatePresence mode="wait">
        {tab === "acordes" && (
          <motion.div
            key="acordes"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            {favoriteChords.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {favoriteChords.map((chord, idx) => (
                  <ChordCard key={chord.id} chord={chord} index={idx} />
                ))}
              </div>
            ) : (
              <div className="py-24 text-center glass-card rounded-2xl border-dashed max-w-2xl mx-auto mt-10">
                <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center mx-auto mb-6 text-muted-foreground">
                  <Music2 className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-display font-bold text-white mb-3">Nenhum acorde salvo</h3>
                <p className="text-muted-foreground mb-8 text-lg">
                  Navegue pelo dicionário e clique no coração para salvar acordes.
                </p>
                <Link
                  href="/dicionario"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold bg-primary text-primary-foreground hover:bg-amber-400 transition-colors shadow-lg shadow-primary/20"
                >
                  <Search className="w-5 h-5" /> Explorar Dicionário
                </Link>
              </div>
            )}
          </motion.div>
        )}

        {/* Tab: Cifras */}
        {tab === "cifras" && (
          <motion.div
            key="cifras"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            {cifras.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                <AnimatePresence>
                  {cifras.map((cifra) => (
                    <CifraCard key={cifra.id} cifra={cifra} onRemover={removerCifra} />
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <div className="py-24 text-center glass-card rounded-2xl border-dashed max-w-2xl mx-auto mt-10">
                <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center mx-auto mb-6 text-muted-foreground">
                  <Wand2 className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-display font-bold text-white mb-3">Nenhuma cifra salva</h3>
                <p className="text-muted-foreground mb-8 text-lg">
                  Use o Sofisticador para gerar cifras e clique em{" "}
                  <span className="text-rose-400 font-semibold">Salvar cifra</span> para guardar aqui.
                </p>
                <Link
                  href="/sofisticador"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold bg-rose-500/80 text-white hover:bg-rose-500 transition-colors shadow-lg shadow-rose-500/20"
                >
                  <Wand2 className="w-5 h-5" /> Abrir Sofisticador
                </Link>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
