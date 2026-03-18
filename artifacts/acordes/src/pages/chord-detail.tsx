import { useState } from "react";
import { useParams, Link } from "wouter";
import { ArrowLeft, Heart, Tag, Info, Lightbulb, Music, ChevronLeft, ChevronRight } from "lucide-react";
import { getChordById, CHORDS } from "@/data/chords";
import { getChordVariationImages, getChordOverviewImage } from "@/data/chord-images";
import { CategoryBadge } from "@/components/CategoryBadge";
import { PianoKeyboard } from "@/components/PianoKeyboard";
import { useFavorites } from "@/hooks/use-favorites";
import { cn } from "@/lib/utils";
import NotFound from "./not-found";

// Busca um acorde pelo ID ou pelo nome (para links de variações)
function findRelatedChord(variation: string) {
  return CHORDS.find((c) => c.id === variation || c.name === variation);
}

// ── Separação padrão de mãos (usado quando não há imagem PDF) ─────────────────
function splitHands(notes: string[], category: string) {
  if (category.startsWith("Mão Esquerda")) {
    return { leftHand: notes, rightHand: [] as string[] };
  }
  const leftHand = notes.length >= 3 ? [notes[0], notes[2]] : [notes[0]];
  const rightHand = [...notes];
  return { leftHand, rightHand };
}

// ── Painel de imagem PDF ───────────────────────────────────────────────────────
function ImageVariationPanel({ images }: { images: string[] }) {
  const [active, setActive] = useState(0);
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");

  return (
    <div>
      {/* Tabs */}
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

        {/* Mobile: setas */}
        <div className="flex sm:hidden items-center justify-between bg-black/30 rounded-xl px-4 py-3 border border-white/5">
          <button
            onClick={() => setActive((v) => (v - 1 + images.length) % images.length)}
            className="p-1 text-muted-foreground hover:text-white transition-colors"
            aria-label="Variação anterior"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-semibold text-white">
            Variação {active + 1} <span className="text-muted-foreground font-normal">/ {images.length}</span>
          </span>
          <button
            onClick={() => setActive((v) => (v + 1) % images.length)}
            className="p-1 text-muted-foreground hover:text-white transition-colors"
            aria-label="Próxima variação"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Imagem */}
      <div className="bg-white rounded-xl overflow-hidden border border-white/10">
        <img
          key={`${images[active]}-${active}`}
          src={`${base}${images[active]}`}
          alt={`Variação ${active + 1}`}
          className="w-full h-auto block"
          loading="lazy"
        />
      </div>

      {/* Legenda de cores */}
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          <span className="w-3 h-3 rounded-full bg-red-500 flex-shrink-0" />
          <span className="text-red-400 font-medium">Mão Esquerda</span>
        </div>
        <div className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-2">
          <span className="w-3 h-3 rounded-full bg-orange-500 flex-shrink-0" />
          <span className="text-orange-400 font-medium">MD — tecla branca</span>
        </div>
        <div className="flex items-center gap-2 bg-zinc-700/50 border border-zinc-600/30 rounded-lg px-3 py-2">
          <span className="w-3 h-3 rounded-full bg-zinc-900 border border-orange-500 flex-shrink-0" />
          <span className="text-zinc-300 font-medium">MD — tecla preta</span>
        </div>
      </div>

      {/* Dots de navegação */}
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

// ── Painel de imagem única (visão geral do PDF) ───────────────────────────────
function ImageOverviewPanel({ src }: { src: string }) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return (
    <div>
      <div className="bg-white rounded-xl overflow-hidden border border-white/10">
        <img
          src={`${base}${src}`}
          alt="Posição no teclado"
          className="w-full h-auto block"
          loading="lazy"
        />
      </div>

      {/* Legenda de cores */}
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          <span className="w-3 h-3 rounded-full bg-red-500 flex-shrink-0" />
          <span className="text-red-400 font-medium">Mão Esquerda</span>
        </div>
        <div className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-2">
          <span className="w-3 h-3 rounded-full bg-orange-500 flex-shrink-0" />
          <span className="text-orange-400 font-medium">MD — tecla branca</span>
        </div>
        <div className="flex items-center gap-2 bg-zinc-700/50 border border-zinc-600/30 rounded-lg px-3 py-2">
          <span className="w-3 h-3 rounded-full bg-zinc-900 border border-orange-500 flex-shrink-0" />
          <span className="text-zinc-300 font-medium">MD — tecla preta</span>
        </div>
      </div>
    </div>
  );
}

// ── Painel de piano SVG (fallback para acordes sem imagem PDF) ─────────────────
interface Voicing {
  label: string;
  leftHand: string[];
  rightHand: string[];
}

function computeVoicings(notes: string[], category: string): Voicing[] {
  if (category.startsWith("Mão Esquerda")) {
    return [{ label: "Variação 1", leftHand: notes, rightHand: [] }];
  }
  const n = notes.length;
  const voicings: Voicing[] = [];
  const numInversions = Math.min(n, 4);
  for (let k = 0; k < numInversions; k++) {
    const rotated = [...notes.slice(k), ...notes.slice(0, k)];
    voicings.push({
      label:     `Variação ${k + 1}`,
      leftHand:  n >= 3 ? [rotated[0], rotated[2]] : [rotated[0]],
      rightHand: rotated,
    });
  }
  if (n >= 3) {
    voicings.push({
      label:     `Variação ${voicings.length + 1}`,
      leftHand:  [notes[0], notes[1]],
      rightHand: notes.slice(2),
    });
  }
  while (voicings.length < 5) voicings.push({ ...voicings[0], label: `Variação ${voicings.length + 1}` });
  return voicings.slice(0, 5);
}

function SvgVariationPanel({ notes, category }: { notes: string[]; category: string }) {
  const [active, setActive] = useState(0);
  const voicings = computeVoicings(notes, category);
  const v = voicings[active];
  const isLeftOnly = category.startsWith("Mão Esquerda");

  return (
    <div>
      {/* Tabs */}
      {!isLeftOnly && (
        <div className="mb-3">
          <div className="hidden sm:flex items-center gap-1 bg-black/30 rounded-xl p-1 border border-white/5">
            {voicings.map((vx, i) => (
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
                {vx.label}
              </button>
            ))}
          </div>

          <div className="flex sm:hidden items-center justify-between bg-black/30 rounded-xl px-4 py-3 border border-white/5">
            <button
              onClick={() => setActive((a) => (a - 1 + voicings.length) % voicings.length)}
              className="p-1 text-muted-foreground hover:text-white"
              aria-label="Variação anterior"
            ><ChevronLeft className="w-5 h-5" /></button>
            <span className="text-sm font-semibold text-white">
              {voicings[active].label} <span className="text-muted-foreground font-normal">/ {voicings.length}</span>
            </span>
            <button
              onClick={() => setActive((a) => (a + 1) % voicings.length)}
              className="p-1 text-muted-foreground hover:text-white"
              aria-label="Próxima variação"
            ><ChevronRight className="w-5 h-5" /></button>
          </div>
        </div>
      )}

      <div className="bg-black/30 rounded-2xl p-4 border border-white/5">
        <PianoKeyboard key={`${category}-${active}`} leftHandNotes={v.leftHand} rightHandNotes={v.rightHand} />

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            <span className="mt-0.5 w-3 h-3 rounded-full bg-red-500 flex-shrink-0 ring-2 ring-red-500/30" />
            <div>
              <p className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-0.5">Mão Esquerda</p>
              <p className="text-sm text-white/80 font-mono">{v.leftHand.join(" — ")}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 bg-orange-500/10 border border-orange-500/20 rounded-xl px-4 py-3">
            <span className="mt-0.5 w-3 h-3 rounded-full bg-orange-500 flex-shrink-0 ring-2 ring-orange-500/30" />
            <div>
              <p className="text-xs font-semibold text-orange-400 uppercase tracking-wider mb-0.5">Mão Direita</p>
              <p className="text-sm text-white/80 font-mono">
                {isLeftOnly
                  ? <span className="italic text-white/50">Livre para melodia ou extensões</span>
                  : v.rightHand.join(" — ")}
              </p>
            </div>
          </div>
        </div>

        {isLeftOnly && (
          <p className="mt-3 text-center text-xs text-muted-foreground bg-white/5 rounded-lg px-3 py-2">
            Este voicing é executado integralmente pela mão esquerda.
          </p>
        )}
      </div>

      {!isLeftOnly && (
        <div className="flex justify-center gap-1.5 mt-3">
          {voicings.map((_, i) => (
            <button key={i} onClick={() => setActive(i)}
              className={cn("h-2 rounded-full transition-all duration-200",
                i === active ? "bg-primary w-4" : "bg-white/20 w-2 hover:bg-white/40")}
              aria-label={voicings[i].label}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────
export default function ChordDetail() {
  const params = useParams<{ id: string }>();
  const chord  = params.id ? getChordById(params.id) : undefined;
  const { isFavorite, toggleFavorite } = useFavorites();

  if (!chord) return <NotFound />;

  const favorite       = isFavorite(chord.id);
  const images         = getChordVariationImages(chord.id);
  const overviewImage  = !images ? getChordOverviewImage(chord.id) : null;

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
              <h1 className="font-display text-5xl md:text-7xl font-bold text-white tracking-tight">
                {chord.name}
              </h1>
            </div>
            <button
              onClick={() => toggleFavorite(chord.id)}
              className={cn(
                "flex items-center gap-3 px-6 py-4 rounded-xl font-semibold transition-all duration-300 shadow-lg",
                favorite
                  ? "bg-primary text-primary-foreground shadow-primary/20 hover:bg-amber-400"
                  : "bg-secondary text-white hover:bg-secondary/80 border border-white/10"
              )}
            >
              <Heart className={cn("w-5 h-5", favorite ? "fill-current" : "")} />
              {favorite ? "Salvo nos Favoritos" : "Favoritar Acorde"}
            </button>
          </div>
        </div>

        {/* ── Variações (imagem PDF ou piano SVG) ──────────────────────────── */}
        <div className="px-6 md:px-10 pt-8 pb-6 border-b border-white/5 relative z-10">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-5 flex items-center gap-2">
            <Music className="w-4 h-4 text-primary" />
            {images ? "Variações do PDF" : overviewImage ? "Posição do PDF" : "Diagrama do Teclado"}
          </h3>

          {images
            ? <ImageVariationPanel images={images} />
            : overviewImage
              ? <ImageOverviewPanel src={overviewImage} />
              : <SvgVariationPanel notes={chord.notes} category={chord.category} />
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
                      className="w-14 h-16 rounded-lg shadow-md flex items-end justify-center pb-2 font-bold text-xl border-b-4"
                      style={{
                        background:   "linear-gradient(to bottom, #fbbf24, #d97706)",
                        borderColor:  "#b45309",
                        color:        "#1a1a1a",
                      }}
                    >
                      {note}
                    </div>
                    <span className="mt-1 text-xs font-semibold text-amber-400">{i + 1}ª</span>
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
                <code className="text-xl font-mono text-primary font-bold">{chord.formula}</code>
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
                        className="px-4 py-2 bg-secondary text-white rounded-lg font-medium border border-white/5 hover:border-primary/40 hover:bg-secondary/80 transition-all"
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
