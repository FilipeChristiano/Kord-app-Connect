import { useState } from "react";
import { useParams, Link } from "wouter";
import { ArrowLeft, Heart, Tag, Info, Lightbulb, Music, ChevronLeft, ChevronRight } from "lucide-react";
import { getChordById, CHORDS } from "@/data/chords";
import { CategoryBadge } from "@/components/CategoryBadge";
import { PianoKeyboard } from "@/components/PianoKeyboard";
import { useFavorites } from "@/hooks/use-favorites";
import { cn } from "@/lib/utils";
import NotFound from "./not-found";

// Busca um acorde pelo ID ou pelo nome (para links de variações)
function findRelatedChord(variation: string) {
  return CHORDS.find((c) => c.id === variation || c.name === variation);
}

// ── Tipos ──────────────────────────────────────────────────────────────────────
interface Voicing {
  label: string;
  subtitle: string;
  leftHand: string[];
  rightHand: string[];
}

// ── Cálculo de voicings ────────────────────────────────────────────────────────
//
// Gera até 5 posições para um acorde a partir de suas notas, seguindo o padrão
// do PDF: inversões rotacionando o baixo + voicing aberto (spread).
//
// Legenda de posições:
//   Posição Fundamental — nota fundamental no baixo (padrão do dicionário)
//   1ª Inversão         — 3ª (ou 2ª nota) no baixo
//   2ª Inversão         — 5ª (ou 3ª nota) no baixo
//   3ª Inversão         — 7ª (ou 4ª nota) no baixo — apenas acordes com ≥4 notas
//   Voicing Aberto      — ME toca fundamental + 2ª nota; MD toca o restante
//
function computeVoicings(notes: string[], category: string): Voicing[] {
  if (category.startsWith("Mão Esquerda")) {
    return [{
      label: "Posição Única",
      subtitle: "Voicing completo na mão esquerda",
      leftHand: notes,
      rightHand: [],
    }];
  }

  const n = notes.length;
  const voicings: Voicing[] = [];

  const inversionLabels = [
    { label: "Posição Fundamental", subtitle: "Fundamental no baixo (ME)" },
    { label: "1ª Inversão",         subtitle: "3ª no baixo (ME)" },
    { label: "2ª Inversão",         subtitle: "5ª no baixo (ME)" },
    { label: "3ª Inversão",         subtitle: "7ª no baixo (ME)" },
    { label: "4ª Inversão",         subtitle: "9ª no baixo (ME)" },
  ];

  // Inversões: roda as notas para cada posição
  const numInversions = Math.min(n, 4);
  for (let k = 0; k < numInversions; k++) {
    const rotated = [...notes.slice(k), ...notes.slice(0, k)];
    const leftHand  = n >= 3 ? [rotated[0], rotated[2]] : [rotated[0]];
    const rightHand = rotated;
    voicings.push({
      label:    inversionLabels[k].label,
      subtitle: inversionLabels[k].subtitle,
      leftHand,
      rightHand,
    });
  }

  // Voicing Aberto: ME = fundamental + 2ª nota, MD = notas restantes
  if (n >= 3) {
    voicings.push({
      label:    "Voicing Aberto",
      subtitle: "ME: fundamental + 3ª  |  MD: extensões",
      leftHand:  [notes[0], notes[1]],
      rightHand: notes.slice(2),
    });
  }

  // Garante exatamente 5 posições (repete a fundamental se acorde tiver ≤2 notas)
  while (voicings.length < 5) voicings.push(voicings[0]);

  return voicings.slice(0, 5);
}

// ── Texto descritivo da legenda ───────────────────────────────────────────────
function buildHandDescription(
  leftHand: string[],
  rightHand: string[],
  category: string,
  voicingLabel: string,
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
    leftDesc:  leftHand.join(" — "),
    rightDesc: rightHand.length > 0 ? rightHand.join(" — ") : "—",
  };
}

// ── Componente principal ───────────────────────────────────────────────────────
export default function ChordDetail() {
  const params = useParams<{ id: string }>();
  const chord  = params.id ? getChordById(params.id) : undefined;
  const { isFavorite, toggleFavorite } = useFavorites();
  const [activeVoicing, setActiveVoicing] = useState(0);

  if (!chord) return <NotFound />;

  const favorite = isFavorite(chord.id);
  const isLeftHandOnly = chord.category.startsWith("Mão Esquerda");

  const voicings = computeVoicings(chord.notes, chord.category);
  const voicing  = voicings[activeVoicing];

  const { leftDesc, rightDesc } = buildHandDescription(
    voicing.leftHand,
    voicing.rightHand,
    chord.category,
    voicing.label,
  );

  // Quais notas são ME, MD ou ambas (para o display de pílulas)
  const lhSet = new Set(voicing.leftHand);
  const rhSet = new Set(voicing.rightHand);

  function prevVoicing() { setActiveVoicing(v => (v - 1 + voicings.length) % voicings.length); }
  function nextVoicing() { setActiveVoicing(v => (v + 1) % voicings.length); }

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

        {/* ── Piano Diagram + Voicings ──────────────────────────────────────── */}
        <div className="px-6 md:px-10 pt-8 pb-6 border-b border-white/5 relative z-10">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-5 flex items-center gap-2">
            <Music className="w-4 h-4 text-primary" /> Diagrama do Teclado
          </h3>

          {/* ── Seletor de Posições ──────────────────────────────────────────── */}
          {!isLeftHandOnly && (
            <div className="mb-4">
              {/* Tabs — desktop */}
              <div className="hidden sm:flex items-center gap-1 bg-black/30 rounded-xl p-1 border border-white/5 overflow-x-auto">
                {voicings.map((v, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveVoicing(i)}
                    className={cn(
                      "flex-1 min-w-0 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-200 whitespace-nowrap",
                      activeVoicing === i
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "text-muted-foreground hover:text-white hover:bg-white/5"
                    )}
                  >
                    <span className="block truncate">{v.label}</span>
                  </button>
                ))}
              </div>

              {/* Controle compacto — mobile */}
              <div className="flex sm:hidden items-center justify-between bg-black/30 rounded-xl px-4 py-3 border border-white/5">
                <button
                  onClick={prevVoicing}
                  className="p-1 text-muted-foreground hover:text-white transition-colors"
                  aria-label="Posição anterior"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="text-center">
                  <p className="text-sm font-semibold text-white">{voicing.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {activeVoicing + 1} / {voicings.length}
                  </p>
                </div>
                <button
                  onClick={nextVoicing}
                  className="p-1 text-muted-foreground hover:text-white transition-colors"
                  aria-label="Próxima posição"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Subtítulo da posição atual */}
              <p className="mt-2 text-xs text-center text-muted-foreground">{voicing.subtitle}</p>
            </div>
          )}

          {/* ── Teclado ─────────────────────────────────────────────────────── */}
          <div className="bg-black/30 rounded-2xl p-4 border border-white/5">
            <PianoKeyboard
              key={`${chord.id}-${activeVoicing}`}
              leftHandNotes={voicing.leftHand}
              rightHandNotes={voicing.rightHand}
            />

            {/* Legenda ME / MD */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                <span className="mt-0.5 flex-shrink-0 w-3 h-3 rounded-full bg-red-500 ring-2 ring-red-500/30" />
                <div>
                  <p className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-0.5">
                    Mão Esquerda
                  </p>
                  <p className="text-sm text-white/80 font-mono">{leftDesc}</p>
                </div>
              </div>

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

            {/* Nota para categorias Mão Esquerda */}
            {isLeftHandOnly && (
              <p className="mt-3 text-center text-xs text-muted-foreground bg-white/5 rounded-lg px-3 py-2">
                Este voicing é executado integralmente pela mão esquerda. A mão direita complementa com notas adicionais do acorde.
              </p>
            )}
          </div>

          {/* Indicadores de posição — pontos */}
          {!isLeftHandOnly && voicings.length > 1 && (
            <div className="flex justify-center gap-1.5 mt-4">
              {voicings.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveVoicing(i)}
                  className={cn(
                    "w-2 h-2 rounded-full transition-all duration-200",
                    i === activeVoicing ? "bg-primary w-4" : "bg-white/20 hover:bg-white/40"
                  )}
                  aria-label={`Ir para ${voicings[i].label}`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-6 md:p-10 grid md:grid-cols-2 gap-10 lg:gap-16 relative z-10">

          {/* Left Col */}
          <div className="space-y-10">
            {/* Notes — atualiza com o voicing ativo */}
            <section>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                <Music className="w-4 h-4" /> Notas do Acorde
              </h3>
              <div className="flex flex-wrap gap-3">
                {chord.notes.map((note, i) => {
                  const inLeft  = lhSet.has(note);
                  const inRight = rhSet.has(note);
                  const both    = inLeft && inRight;
                  const bg      = inLeft
                    ? "linear-gradient(to bottom, #fca5a5, #f87171)"
                    : inRight
                      ? "linear-gradient(to bottom, #fed7aa, #fb923c)"
                      : "linear-gradient(to bottom, #374151, #1f2937)";
                  const border  = inLeft ? "#dc2626" : inRight ? "#ea580c" : "#4b5563";
                  const labelColor = inLeft ? "#f87171" : inRight ? "#f97316" : "#6b7280";
                  const label   = both ? "ME+MD" : inLeft ? "ME" : inRight ? "MD" : "—";
                  return (
                    <div key={i} className="relative flex flex-col items-center">
                      <div
                        className="w-14 h-16 rounded-lg shadow-md flex items-end justify-center pb-2 font-bold text-xl border-b-4"
                        style={{ background: bg, borderColor: border, color: inLeft || inRight ? "#1a1a1a" : "#9ca3af" }}
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
              <p className="mt-2 text-xs text-muted-foreground">
                Notas destacadas correspondem à posição selecionada acima.
              </p>
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
