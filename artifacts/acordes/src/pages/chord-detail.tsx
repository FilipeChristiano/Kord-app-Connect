import { useState } from "react";
import { useParams, Link } from "wouter";
import { ArrowLeft, Heart, Tag, Info, Lightbulb, Music, ChevronLeft, ChevronRight, Play } from "lucide-react";
import { getChordById, CHORDS } from "@/data/chords";
import { getChordVariationImages, getChordOverviewImage, CHORD_SVG_OVERRIDES } from "@/data/chord-images";
import { CategoryBadge } from "@/components/CategoryBadge";
import { PianoKeyboard } from "@/components/PianoKeyboard";
import { useFavorites } from "@/hooks/use-favorites";
import { cn } from "@/lib/utils";
import { splitHands } from "@/lib/notes";
import { playChordVoicing } from "@/lib/piano";
import { getVoicings7M } from "@/lib/voicings";
import NotFound from "./not-found";

// Busca um acorde pelo ID ou pelo nome (para links de variações)
function findRelatedChord(variation: string) {
  return CHORDS.find((c) => c.id === variation || c.name === variation);
}

// ── Toca o voicing padrão do acorde no piano real ─────────────────────────────
function playDefaultVoicing(notes: string[], category: string) {
  const { leftHand, rightHand } = splitHands(notes, category);
  const isFechado = category === "Mão Esquerda — Fechado";
  playChordVoicing(leftHand, rightHand, { leftBaseOctave: isFechado ? 1 : 0 });
}

// ── Legenda de cores ───────────────────────────────────────────────────────────
function ColorLegend() {
  return (
    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
      <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
        <span className="w-3 h-3 rounded-full bg-red-500 flex-shrink-0" />
        <span className="text-red-400 font-medium">Mão Esquerda</span>
      </div>
      <div className="flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 rounded-lg px-3 py-2">
        <span className="w-3 h-3 rounded-full bg-purple-400 flex-shrink-0" />
        <span className="text-purple-400 font-medium">MD — branca</span>
      </div>
      <div className="flex items-center gap-2 bg-zinc-700/50 border border-zinc-600/30 rounded-lg px-3 py-2">
        <span className="w-3 h-3 rounded-full bg-zinc-900 border border-purple-400 flex-shrink-0" />
        <span className="text-zinc-300 font-medium">MD — preta</span>
      </div>
    </div>
  );
}

// ── Painel SVG para acordes básicos (usados como override) ────────────────────
function SvgOverviewPanel({ notes, category }: { notes: string[]; category: string }) {
  const { leftHand, rightHand } = splitHands(notes, category);
  const isLeftOnly = category.startsWith("Mão Esquerda");
  const isFechado  = category === "Mão Esquerda — Fechado";
  const leftHandBaseOctave = isFechado ? 1 : 0;
  const meLabel = isFechado
    ? `${leftHand[0]} — ${leftHand[1]} (região média)`
    : leftHand.join(" — ");

  return (
    <div>
      <div className="bg-black/30 rounded-2xl p-4 border border-white/5">
        <div className="flex justify-center mb-3">
          <button
            onClick={() => playChordVoicing(leftHand, rightHand, { leftBaseOctave: leftHandBaseOctave })}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary/15 text-primary border border-primary/25 hover:bg-primary/25 transition-colors active:scale-95"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Ouvir
          </button>
        </div>
        <PianoKeyboard
          leftHandNotes={leftHand}
          rightHandNotes={rightHand}
          leftHandBaseOctave={leftHandBaseOctave}
        />
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            <span className="mt-0.5 w-3 h-3 rounded-full bg-red-500 flex-shrink-0 ring-2 ring-red-500/30" />
            <div>
              <p className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-0.5">Mão Esquerda</p>
              <p className="text-sm text-white/80 font-mono notranslate" translate="no">{meLabel}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 bg-purple-500/10 border border-purple-500/20 rounded-xl px-4 py-3">
            <span className="mt-0.5 w-3 h-3 rounded-full bg-purple-400 flex-shrink-0 ring-2 ring-purple-400/30" />
            <div>
              <p className="text-xs font-semibold text-purple-400 uppercase tracking-wider mb-0.5">Mão Direita</p>
              <p className="text-sm text-white/80 font-mono notranslate" translate="no">
                {isLeftOnly
                  ? <span className="italic text-white/50" translate="yes">Livre para melodia ou extensões</span>
                  : rightHand.join(" — ")}
              </p>
            </div>
          </div>
        </div>
        {isLeftOnly && (
          <p className="mt-3 text-center text-xs text-muted-foreground bg-white/5 rounded-lg px-3 py-2">
            {isFechado
              ? "Mão esquerda toca a 3ª e a 5ª do acorde na região média do teclado."
              : "Este voicing é executado integralmente pela mão esquerda."}
          </p>
        )}
      </div>
      <ColorLegend />
    </div>
  );
}

// ── Painel SVG com 5 variações (acordes de 4 notas) ───────────────────────────
function SvgVariationPanel({ chordId, notes }: { chordId: string; notes: string[] }) {
  const [active, setActive] = useState(0);
  const voicings = getVoicings7M(chordId, notes);
  const v = voicings[active];

  return (
    <div>
      {/* Tabs desktop */}
      <div className="mb-3">
        <div className="hidden sm:flex items-center gap-1 bg-black/30 rounded-xl p-1 border border-white/5">
          {voicings.map((vo, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={cn(
                "flex-1 px-2 py-2 rounded-lg text-xs font-semibold transition-all duration-200",
                active === i
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "text-muted-foreground hover:text-white hover:bg-white/5"
              )}
            >
              Variação {i + 1}
            </button>
          ))}
        </div>

        {/* Navegação mobile */}
        <div className="flex sm:hidden items-center justify-between bg-black/30 rounded-xl px-4 py-3 border border-white/5">
          <button
            onClick={() => setActive((a) => (a - 1 + voicings.length) % voicings.length)}
            className="p-1 text-muted-foreground hover:text-white"
            aria-label="Variação anterior"
          ><ChevronLeft className="w-5 h-5" /></button>
          <span className="text-sm font-semibold text-white">
            Variação {active + 1} <span className="text-muted-foreground font-normal">/ {voicings.length}</span>
          </span>
          <button
            onClick={() => setActive((a) => (a + 1) % voicings.length)}
            className="p-1 text-muted-foreground hover:text-white"
            aria-label="Próxima variação"
          ><ChevronRight className="w-5 h-5" /></button>
        </div>
      </div>

      <div className="bg-black/30 rounded-2xl p-4 border border-white/5">
        <div className="flex items-center justify-center gap-3 mb-3">
          <p className="text-center text-xs text-muted-foreground font-medium">{v.label}</p>
          <button
            onClick={() => playChordVoicing(v.leftHand, v.rightHand)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary/15 text-primary border border-primary/25 hover:bg-primary/25 transition-colors active:scale-95"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Ouvir
          </button>
        </div>
        <PianoKeyboard
          leftHandNotes={v.leftHand}
          rightHandNotes={v.rightHand}
        />
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            <span className="mt-0.5 w-3 h-3 rounded-full bg-red-500 flex-shrink-0 ring-2 ring-red-500/30" />
            <div>
              <p className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-0.5">Mão Esquerda</p>
              <p className="text-sm text-white/80 font-mono notranslate" translate="no">{v.leftHand.join(" — ")}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 bg-purple-500/10 border border-purple-500/20 rounded-xl px-4 py-3">
            <span className="mt-0.5 w-3 h-3 rounded-full bg-purple-400 flex-shrink-0 ring-2 ring-purple-400/30" />
            <div>
              <p className="text-xs font-semibold text-purple-400 uppercase tracking-wider mb-0.5">Mão Direita</p>
              <p className="text-sm text-white/80 font-mono notranslate" translate="no">{v.rightHand.join(" — ")}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Indicadores */}
      <div className="flex justify-center gap-1.5 mt-3">
        {voicings.map((_, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className={cn(
              "h-2 rounded-full transition-all duration-200",
              i === active ? "bg-primary w-4" : "bg-white/20 w-2 hover:bg-white/40"
            )}
            aria-label={`Variação ${i + 1}`}
          />
        ))}
      </div>
      <ColorLegend />
    </div>
  );
}

// ── Painel de imagem única (tríades, sus4, sus2, dim, m7b5, ME) ────────────────
function ImageOverviewPanel({ imageUrl }: { imageUrl: string }) {
  return (
    <div className="bg-black/30 rounded-2xl p-4 border border-white/5 flex justify-center">
      <img
        src={imageUrl}
        alt="Posição no teclado"
        className="max-w-full rounded-xl object-contain"
        style={{ maxHeight: 320 }}
      />
    </div>
  );
}

// ── Painel com 5 variações em imagem (acordes sofisticados) ───────────────────
function ImageVariationPanel({ images }: { images: string[] }) {
  const [active, setActive] = useState(0);

  return (
    <div>
      {/* Tabs desktop */}
      <div className="mb-3">
        <div className="hidden sm:flex items-center gap-1 bg-black/30 rounded-xl p-1 border border-white/5">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={cn(
                "flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-200",
                active === i
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "text-muted-foreground hover:text-white hover:bg-white/5"
              )}
            >
              Variação {i + 1}
            </button>
          ))}
        </div>

        {/* Navegação mobile */}
        <div className="flex sm:hidden items-center justify-between bg-black/30 rounded-xl px-4 py-3 border border-white/5">
          <button
            onClick={() => setActive((a) => (a - 1 + images.length) % images.length)}
            className="p-1 text-muted-foreground hover:text-white"
            aria-label="Variação anterior"
          ><ChevronLeft className="w-5 h-5" /></button>
          <span className="text-sm font-semibold text-white">
            Variação {active + 1} <span className="text-muted-foreground font-normal">/ {images.length}</span>
          </span>
          <button
            onClick={() => setActive((a) => (a + 1) % images.length)}
            className="p-1 text-muted-foreground hover:text-white"
            aria-label="Próxima variação"
          ><ChevronRight className="w-5 h-5" /></button>
        </div>
      </div>

      <div className="bg-black/30 rounded-2xl p-4 border border-white/5 flex justify-center">
        <img
          key={active}
          src={images[active]}
          alt={`Variação ${active + 1}`}
          className="max-w-full rounded-xl object-contain"
          style={{ maxHeight: 380 }}
        />
      </div>

      {/* Indicadores */}
      <div className="flex justify-center gap-1.5 mt-3">
        {images.map((_, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className={cn(
              "h-2 rounded-full transition-all duration-200",
              i === active ? "bg-primary w-4" : "bg-white/20 w-2 hover:bg-white/40"
            )}
            aria-label={`Variação ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────
export default function ChordDetail() {
  const params = useParams<{ id: string }>();
  const chord  = params.id ? getChordById(params.id) : undefined;
  const { isFavorite, toggleFavorite } = useFavorites();

  if (!chord) return <NotFound />;

  const favorite     = isFavorite(chord.id);
  // Determine if this chord has multiple voicings (sophisticated) or single position (basic)
  const hasVariations = getChordVariationImages(chord.id) !== null;
  const hasOverview   = !hasVariations && getChordOverviewImage(chord.id) !== null;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 lg:py-12">
      <Link href="/dicionario" className="inline-flex items-center gap-2 text-muted-foreground hover:text-white mb-8 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Voltar ao dicionário
      </Link>

      <div className="glass-card rounded-3xl overflow-hidden border border-white/10 shadow-2xl relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />

        {/* Header */}
        <div className="p-6 md:p-10 border-b border-white/5 relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <CategoryBadge category={chord.category} className="mb-4" />
              <h1 className="font-display text-5xl md:text-7xl font-bold text-white tracking-tight notranslate" translate="no">
                {chord.name}
              </h1>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => playDefaultVoicing(chord.notes, chord.category)}
                className="flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-semibold transition-all duration-300 btn-kordi active:scale-95"
              >
                <Play className="w-5 h-5 fill-current" />
                Ouvir Acorde
              </button>
              <button
                onClick={() => toggleFavorite(chord.id)}
                className={cn(
                  "flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-semibold transition-all duration-300 shadow-lg",
                  favorite
                    ? "btn-kordi"
                    : "bg-secondary text-white hover:bg-secondary/80 border border-white/10"
                )}
              >
                <Heart className={cn("w-5 h-5", favorite ? "fill-current" : "")} />
                {favorite ? "Salvo nos Favoritos" : "Favoritar Acorde"}
              </button>
            </div>
          </div>
        </div>

        {/* ── Diagrama do Teclado ──────────────────────────────────────────────── */}
        <div className="px-6 md:px-10 pt-8 pb-6 border-b border-white/5 relative z-10">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-5 flex items-center gap-2">
            <Music className="w-4 h-4 text-primary" />
            {hasVariations ? "Variações no Teclado" : "Posição no Teclado"}
          </h3>

          {CHORD_SVG_OVERRIDES.has(chord.id)
            ? chord.notes.length >= 4
              ? <SvgVariationPanel chordId={chord.id} notes={chord.notes} />
              : <SvgOverviewPanel notes={chord.notes} category={chord.category} />
            : hasVariations
              ? <ImageVariationPanel images={getChordVariationImages(chord.id)!} />
              : hasOverview
                ? <ImageOverviewPanel imageUrl={getChordOverviewImage(chord.id)!} />
                : null
          }
        </div>

        {/* Content */}
        <div className="p-6 md:p-10 grid md:grid-cols-2 gap-10 lg:gap-16 relative z-10">

          {/* Left Col */}
          <div className="space-y-10">
            {/* Notes */}
            <section>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                <Music className="w-4 h-4" /> Notas do Acorde
              </h3>
              <div className="flex flex-wrap gap-3">
                {chord.notes.map((note, i) => (
                  <div key={i} className="relative flex flex-col items-center">
                    <div
                      className="w-14 h-16 rounded-lg shadow-md flex items-end justify-center pb-2 font-bold text-xl border-b-4 notranslate"
                      translate="no"
                      style={{
                        background:   "linear-gradient(to bottom, #fbbf24, #d97706)",
                        borderColor:  "#b45309",
                        color:        "#1a1a1a",
                      }}
                    >
                      {note}
                    </div>
                    <span className="mt-1 text-xs font-semibold text-purple-400">{i + 1}ª</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Formula */}
            <section>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                <Info className="w-4 h-4" /> Fórmula
              </h3>
              <div className="bg-secondary/50 rounded-xl p-4 border border-white/5">
                <code className="text-xl font-mono text-primary font-bold notranslate" translate="no">{chord.formula}</code>
              </div>
            </section>

            {/* Tags */}
            <section>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                <Tag className="w-4 h-4" /> Tags
              </h3>
              <div className="flex flex-wrap gap-2">
                {chord.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 bg-white/5 text-muted-foreground rounded-full text-sm border border-white/5"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </section>
          </div>

          {/* Right Col */}
          <div className="space-y-10">
            <section>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                Sonoridade
              </h3>
              <p className="text-lg text-white/90 leading-relaxed">{chord.description}</p>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-primary" /> Como Aplicar na Prática
              </h3>
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                <p className="text-white/90 leading-relaxed relative z-10">{chord.application}</p>
              </div>
            </section>

            {chord.variations && chord.variations.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                  Acordes Relacionados
                </h3>
                <div className="flex flex-wrap gap-3">
                  {chord.variations.map((variation) => {
                    const related = findRelatedChord(variation);
                    return related ? (
                      <Link
                        key={variation}
                        href={`/acorde/${related.id}`}
                        className="px-4 py-2 bg-secondary text-white rounded-lg font-medium border border-white/5 hover:border-primary/40 hover:bg-secondary/80 transition-all notranslate"
                        translate="no"
                      >
                        {related.name}
                      </Link>
                    ) : (
                      <span
                        key={variation}
                        className="px-4 py-2 bg-secondary/40 text-white/40 rounded-lg font-medium border border-white/5 cursor-default"
                      >
                        {variation}
                      </span>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
