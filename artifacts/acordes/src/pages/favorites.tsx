import { useState } from "react";
import {
  Heart, Search, Music2, Wand2, Trash2, ArrowRight,
  Copy, Check, X, FileText, ArrowLeft, ExternalLink, Maximize2,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { CHORDS } from "@/data/chords";
import { ChordCard } from "@/components/ChordCard";
import { useFavorites } from "@/hooks/use-favorites";
import { useCifrasFavoritas, CifraFavorita } from "@/hooks/use-cifras-favoritas";
import { CifraFullscreen } from "@/components/CifraFullscreen";
import { motion, AnimatePresence } from "framer-motion";

const NIVEL_LABELS: Record<string, { label: string; color: string }> = {
  original: { label: "Original", color: "text-white/60 bg-white/5 border-white/20" },
  suave: { label: "Suave", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
  intermediario: { label: "Intermediário", color: "text-orange-400 bg-orange-500/10 border-orange-500/30" },
  avancado: { label: "Avançado", color: "text-rose-400 bg-rose-500/10 border-rose-500/30" },
};

/* ─── Modal de visualização completa ───────────────────────────────────────── */
function CifraModal({
  cifra,
  onClose,
  onRemover,
  onFullscreen,
}: {
  cifra: CifraFavorita;
  onClose: () => void;
  onRemover: (id: string) => void;
  onFullscreen: (cifra: CifraFavorita) => void;
}) {
  const [, navigate] = useLocation();
  const [copied, setCopied] = useState<"original" | "sofisticada" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const nivel = NIVEL_LABELS[cifra.nivel] ?? NIVEL_LABELS.intermediario;

  const copy = (text: string, which: "original" | "sofisticada") => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(which);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const handleDelete = () => {
    onRemover(cifra.id);
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ scale: 0.94, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.94, opacity: 0, y: 16 }}
        className="bg-[#12121f] border border-white/10 rounded-2xl w-full max-w-3xl shadow-2xl mb-8"
      >
        {/* Header do modal */}
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4 border-b border-white/10">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${nivel.color}`}>
                {nivel.label}
              </span>
              <span className="text-xs text-muted-foreground">
                {new Date(cifra.salvoEm).toLocaleDateString("pt-BR", {
                  day: "2-digit", month: "short", year: "numeric",
                })}
              </span>
            </div>
            <h2 className="font-display font-bold text-white text-xl leading-tight">
              {cifra.titulo}
            </h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onFullscreen(cifra)}
              aria-label="Ver cifra em tela cheia"
              title="Ver em tela cheia"
              className="flex items-center gap-1.5 p-2 sm:px-3 rounded-lg border border-white/10 text-white/40 hover:bg-white/5 hover:text-[#9673FF] hover:border-[#8B5CF6]/40 transition-all"
            >
              <Maximize2 className="w-4 h-4" />
              <span className="hidden sm:inline text-xs font-medium">Tela cheia</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg border border-white/10 text-white/40 hover:bg-white/5 hover:text-white transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Corpo: apenas cifra sofisticada */}
        <div className="p-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-primary/80 uppercase tracking-widest">
              {cifra.nivel === "original" ? "Cifra" : "Cifra sofisticada"}
            </p>
            <button
              onClick={() => copy(cifra.textoSofisticado, "sofisticada")}
              className="flex items-center gap-1.5 text-xs text-primary/60 hover:text-primary transition-colors"
            >
              {copied === "sofisticada" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied === "sofisticada" ? "Copiado!" : "Copiar cifra"}
            </button>
          </div>
          <div className="bg-[#fdfcf9] border border-primary/25 rounded-xl px-5 py-5 font-mono text-sm text-zinc-800 leading-loose whitespace-pre-wrap max-h-[60vh] overflow-y-auto">
            {cifra.textoSofisticado}
          </div>
        </div>

        {/* Substituições */}
        {cifra.mudancas.length > 0 && (
          <div className="px-6 pb-4">
            <p className="text-xs font-bold text-white/30 uppercase tracking-widest mb-3">
              Substituições realizadas ({cifra.mudancas.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {cifra.mudancas.map((m, i) => (
                <button
                  key={i}
                  onClick={() => m.chordId && navigate(`/acorde/${m.chordId}`)}
                  disabled={!m.chordId}
                  className={`flex items-center gap-1.5 bg-white/[0.04] border border-white/10 rounded-lg px-3 py-1.5 transition-colors ${
                    m.chordId ? "hover:bg-white/[0.08] cursor-pointer" : "cursor-default"
                  }`}
                >
                  <span className="text-white/40 font-mono text-xs">{m.original}</span>
                  <ArrowRight className="w-3 h-3 text-white/20" />
                  <span className="text-primary font-mono text-xs font-bold">{m.substituted}</span>
                  {m.chordId && <ExternalLink className="w-2.5 h-2.5 text-white/20" />}
                </button>
              ))}
            </div>
            {cifra.mudancas.some((m) => m.chordId) && (
              <p className="text-[11px] text-white/20 mt-2">
                Clique em um acorde para ver os detalhes no dicionário.
              </p>
            )}
          </div>
        )}

        {/* Rodapé do modal */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-white/10">
          <button
            onClick={onClose}
            className="flex items-center gap-2 text-sm text-white/40 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>

          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/40">Excluir esta cifra?</span>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-white/40 hover:bg-white/5"
              >
                Não
              </button>
              <button
                onClick={handleDelete}
                className="text-xs px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30"
              >
                Sim, excluir
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1.5 text-xs text-white/30 hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Excluir cifra
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── Card da cifra ─────────────────────────────────────────────────────────── */
function CifraCard({
  cifra,
  onRemover,
  onAbrir,
  onFullscreen,
}: {
  cifra: CifraFavorita;
  onRemover: (id: string) => void;
  onAbrir: (cifra: CifraFavorita) => void;
  onFullscreen: (cifra: CifraFavorita) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const nivel = NIVEL_LABELS[cifra.nivel] ?? NIVEL_LABELS.intermediario;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
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
      onClick={() => onAbrir(cifra)}
      className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 flex flex-col gap-4 hover:border-primary/30 hover:bg-white/[0.05] transition-all cursor-pointer group"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-bold text-white text-base leading-tight truncate group-hover:text-primary transition-colors">
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
      <div className="bg-[#fdfcf9] border border-primary/15 rounded-xl px-4 py-3 font-mono text-xs text-zinc-700 leading-loose overflow-hidden max-h-[90px]">
        {linhas.slice(0, 3).map((linha, i) => (
          <span key={i} className="block whitespace-pre-wrap">{linha || "\u00A0"}</span>
        ))}
        {linhas.length > 3 && (
          <span className="text-zinc-400">+ {linhas.length - 3} linhas...</span>
        )}
      </div>

      {/* Substituições resumidas */}
      {cifra.mudancas.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {cifra.mudancas.slice(0, 5).map((m, i) => (
            <span
              key={i}
              className="flex items-center gap-1 bg-white/[0.04] border border-white/10 rounded-md px-2 py-0.5"
            >
              <span className="text-white/40 text-[10px] font-mono">{m.original}</span>
              <ArrowRight className="w-2 h-2 text-muted-foreground" />
              <span className="text-primary text-[10px] font-mono font-bold">{m.substituted}</span>
            </span>
          ))}
          {cifra.mudancas.length > 5 && (
            <span className="text-[10px] text-white/30 self-center">+{cifra.mudancas.length - 5}</span>
          )}
        </div>
      )}

      {/* Ações */}
      <div className="flex gap-2 mt-auto pt-1" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={handleCopy}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-lg bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-all"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copiado!" : "Copiar cifra"}
        </button>

        <button
          onClick={() => onAbrir(cifra)}
          className="flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:bg-white/10 hover:text-white transition-all"
        >
          <FileText className="w-3.5 h-3.5" /> Ver completa
        </button>

        <button
          onClick={() => onFullscreen(cifra)}
          aria-label="Ver cifra em tela cheia"
          title="Ver em tela cheia"
          className="p-2 rounded-lg border border-white/10 text-white/30 hover:text-[#9673FF] hover:border-[#8B5CF6]/40 hover:bg-[#8B5CF6]/10 transition-all"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>

        {confirmDelete ? (
          <div className="flex gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmDelete(false); }}
              className="text-xs px-2 py-2 rounded-lg border border-white/10 text-white/40 hover:bg-white/5"
            >
              Não
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onRemover(cifra.id); }}
              className="text-xs px-2 py-2 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30"
            >
              Excluir
            </button>
          </div>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
            className="p-2 rounded-lg border border-white/10 text-white/30 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/10 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </motion.div>
  );
}

/* ─── Página principal ──────────────────────────────────────────────────────── */
type Tab = "acordes" | "cifras";

export default function Favorites() {
  const [tab, setTab] = useState<Tab>("acordes");
  const [cifraAberta, setCifraAberta] = useState<CifraFavorita | null>(null);
  const [cifraFullscreen, setCifraFullscreen] = useState<CifraFavorita | null>(null);
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
            Meus <span className="text-gradient-primary">Favoritos</span>
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
            tab === "acordes" ? "bg-white/10 text-white" : "text-muted-foreground hover:text-white"
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
            tab === "cifras" ? "bg-white/10 text-white" : "text-muted-foreground hover:text-white"
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
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold btn-kordi"
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
                    <CifraCard
                      key={cifra.id}
                      cifra={cifra}
                      onRemover={removerCifra}
                      onAbrir={setCifraAberta}
                      onFullscreen={setCifraFullscreen}
                    />
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
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold btn-kordi"
                >
                  <Wand2 className="w-5 h-5" /> Abrir Sofisticador
                </Link>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de visualização */}
      <AnimatePresence>
        {cifraAberta && (
          <CifraModal
            cifra={cifraAberta}
            onClose={() => setCifraAberta(null)}
            onRemover={(id) => { removerCifra(id); setCifraAberta(null); }}
            onFullscreen={setCifraFullscreen}
          />
        )}
      </AnimatePresence>

      {/* Cifra em tela cheia */}
      <AnimatePresence>
        {cifraFullscreen && (
          <CifraFullscreen
            title={cifraFullscreen.titulo}
            onClose={() => setCifraFullscreen(null)}
          >
            <div className="whitespace-pre leading-loose">
              {cifraFullscreen.textoSofisticado}
            </div>
          </CifraFullscreen>
        )}
      </AnimatePresence>
    </div>
  );
}
