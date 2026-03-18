import { useParams, Link } from "wouter";
import { ArrowLeft, Heart, Tag, Info, Lightbulb, Music } from "lucide-react";
import { getChordById } from "@/data/chords";
import { CategoryBadge } from "@/components/CategoryBadge";
import { PianoKeyboard } from "@/components/PianoKeyboard";
import { useFavorites } from "@/hooks/use-favorites";
import { cn } from "@/lib/utils";
import NotFound from "./not-found";

// ── Separação de mãos — padrão do PDF ────────────────────────────────────────
//
// Para acordes regulares:
//   Mão Esquerda = fundamental (notes[0]) + quinta (notes[2])
//   Mão Direita  = TODAS as notas do acorde (incluindo as que estão na ME)
//
// Para categorias "Mão Esquerda — Aberto/Fechado/Misto":
//   Mão Esquerda = todas as notas (voicing completo da ME)
//   Mão Direita  = vazia (MD complementa livremente)
//
function splitHands(
  notes: string[],
  category: string
): { leftHand: string[]; rightHand: string[] } {
  if (category.startsWith("Mão Esquerda")) {
    return { leftHand: notes, rightHand: [] };
  }

  // Mão Esquerda: fundamental + quinta (índice 0 e 2)
  // Se o acorde tiver menos de 3 notas, usa só a fundamental
  const leftHand = notes.length >= 3
    ? [notes[0], notes[2]]
    : [notes[0]];

  // Mão Direita: acorde completo (todas as notas)
  const rightHand = [...notes];

  return { leftHand, rightHand };
}

// ── Texto descritivo da legenda ───────────────────────────────────────────────
function buildHandDescription(
  leftHand: string[],
  rightHand: string[],
  category: string
): { leftDesc: string; rightDesc: string } {
  if (category.startsWith("Mão Esquerda")) {
    const subType = category.replace("Mão Esquerda — ", "");
    const rightDescMap: Record<string, string> = {
      Aberto:  "Mão direita executa as cores do acorde (3ª, 7ª, extensões)",
      Fechado: "Mão direita toca a melodia ou ornamentos",
      Misto:   "Mão direita acrescenta extensões e cor harmônica",
    };
    return {
      leftDesc:  leftHand.join(" — "),
      rightDesc: rightDescMap[subType] ?? "Mão direita livre para melodia",
    };
  }

  return {
    leftDesc:  leftHand.join(" — ") + " (fundamental + quinta)",
    rightDesc: rightHand.join(" — ") + " (acorde completo)",
  };
}

export default function ChordDetail() {
  const params = useParams<{ id: string }>();
  const chord = params.id ? getChordById(params.id) : undefined;
  const { isFavorite, toggleFavorite } = useFavorites();

  if (!chord) return <NotFound />;

  const favorite = isFavorite(chord.id);
  const { leftHand, rightHand } = splitHands(chord.notes, chord.category);
  const { leftDesc, rightDesc } = buildHandDescription(leftHand, rightHand, chord.category);
  const isLeftHandOnly = chord.category.startsWith("Mão Esquerda");

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

        {/* ── Piano Diagram ─────────────────────────────────────────────── */}
        <div className="px-6 md:px-10 pt-8 pb-6 border-b border-white/5 relative z-10">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-5 flex items-center gap-2">
            <Music className="w-4 h-4 text-primary" /> Diagrama do Teclado
          </h3>

          <div className="bg-black/30 rounded-2xl p-4 border border-white/5">
            <PianoKeyboard leftHandNotes={leftHand} rightHandNotes={rightHand} />

            {/* Legend */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Left hand */}
              <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                <span className="mt-0.5 flex-shrink-0 w-3 h-3 rounded-full bg-red-500 ring-2 ring-red-500/30" />
                <div>
                  <p className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-0.5">
                    Mão Esquerda
                  </p>
                  <p className="text-sm text-white/80 font-mono">{leftDesc}</p>
                </div>
              </div>

              {/* Right hand */}
              <div className="flex items-start gap-3 bg-orange-500/10 border border-orange-500/20 rounded-xl px-4 py-3">
                <span className="mt-0.5 flex-shrink-0 w-3 h-3 rounded-full bg-orange-500 ring-2 ring-orange-500/30" />
                <div>
                  <p className="text-xs font-semibold text-orange-400 uppercase tracking-wider mb-0.5">
                    Mão Direita
                  </p>
                  <p className="text-sm text-white/80 font-mono">
                    {isLeftHandOnly ? (
                      <span className="italic text-white/50">{rightDesc}</span>
                    ) : (
                      rightDesc
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Extra note for Mão Esquerda categories */}
            {isLeftHandOnly && (
              <p className="mt-3 text-center text-xs text-muted-foreground bg-white/5 rounded-lg px-3 py-2">
                Este voicing é executado integralmente pela mão esquerda. A mão direita complementa com notas adicionais do acorde.
              </p>
            )}
          </div>
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
                {chord.notes.map((note, i) => {
                  const inLeft  = leftHand.includes(note);
                  const inRight = rightHand.includes(note);
                  const both = inLeft && inRight;
                  // Cor: vermelho se ME (incluso ME+MD), laranja se só MD
                  const bg    = inLeft
                    ? "linear-gradient(to bottom, #fca5a5, #f87171)"
                    : "linear-gradient(to bottom, #fed7aa, #fb923c)";
                  const border = inLeft ? "#dc2626" : "#ea580c";
                  const labelColor = inLeft ? "#f87171" : "#f97316";
                  const label = both ? "ME+MD" : inLeft ? "ME" : "MD";
                  return (
                    <div key={i} className="relative flex flex-col items-center">
                      <div
                        className="w-14 h-16 rounded-lg shadow-md flex items-end justify-center pb-2 font-bold text-xl border-b-4"
                        style={{ background: bg, borderColor: border, color: "#1a1a1a" }}
                      >
                        {note}
                      </div>
                      <span className="mt-1 text-xs font-semibold" style={{ color: labelColor }}>
                        {label}
                      </span>
                    </div>
                  );
                })}
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
                  Variações Sugeridas
                </h3>
                <div className="flex flex-wrap gap-3">
                  {chord.variations.map((variation) => (
                    <span
                      key={variation}
                      className="px-4 py-2 bg-secondary text-white rounded-lg font-medium border border-white/5"
                    >
                      {variation}
                    </span>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
