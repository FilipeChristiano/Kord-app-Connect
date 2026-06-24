import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wand2, Copy, Check, RotateCcw, Info, ArrowRight, Heart, BookmarkCheck, Music2 } from "lucide-react";
import { useLocation } from "wouter";
import {
  processChordChartFull,
  SophisticationLevel,
  ProcessedLine,
  DetectedTonality,
} from "@/data/substitutions";
import { useCifrasFavoritas } from "@/hooks/use-cifras-favoritas";

const LEVELS: { key: SophisticationLevel; label: string; description: string; color: string }[] =
  [
    {
      key: "suave",
      label: "Suave",
      description: "7M, m7, sus4 — refinamento leve e natural",
      color: "border-emerald-500/50 bg-emerald-500/10 text-emerald-400",
    },
    {
      key: "intermediario",
      label: "Intermediário",
      description: "7M(9), m7(9), 7sus4 — worship moderno e emocional",
      color: "border-orange-500/50 bg-orange-500/10 text-orange-400",
    },
    {
      key: "avancado",
      label: "Avançado",
      description: "7M(9), m7(11), 7sus4(9) — harmonia cinematográfica",
      color: "border-rose-500/50 bg-rose-500/10 text-rose-400",
    },
  ];

const EXAMPLES = [
  { label: "Louvor simples", text: "C  G  Am  F\nC  G  F  C" },
  { label: "Gospel em Bb", text: "Bb  Eb  F  Bb\nGm  Cm  F  Bb" },
  { label: "Tom de G", text: "G  Em  C  D\nG  D  Em  C" },
  { label: "Adoração em Ab", text: "Ab  Db  Eb  Ab\nFm  Db  Eb  Ab" },
];

const SECTION_RE = /^\[[^\]]+\]$/;

// Reconstrói o texto puro da linha (acorde sofisticado + espaços/letra) para
// classificar seções e linhas vazias sem perder o alinhamento monoespaçado.
function lineToText(line: ProcessedLine): string {
  return line.tokens
    .map((t) =>
      t.type === "chord" ? t.substitution?.substituted ?? t.value ?? "" : t.value ?? "",
    )
    .join("");
}

function RenderedLine({
  line,
  onChordClick,
}: {
  line: ProcessedLine;
  onChordClick: (id: string) => void;
}) {
  const text = lineToText(line);
  const trimmed = text.trim();

  // Linha em branco → respiro entre as partes.
  if (!trimmed) return <div className="h-4" aria-hidden />;

  // Cabeçalho de seção ([Intro], [Refrão]…) → etiqueta destacada.
  if (SECTION_RE.test(trimmed)) {
    return (
      <div className="mt-6 mb-1 first:mt-0">
        <span className="inline-block font-sans text-[11px] font-semibold uppercase tracking-wider text-primary bg-primary/10 border border-primary/20 rounded-md px-2.5 py-1">
          {trimmed.replace(/^\[|\]$/g, "")}
        </span>
      </div>
    );
  }

  // Linha de acordes/letra: preserva o alinhamento (whitespace-pre, sem quebra)
  // com bastante respiro vertical. Os acordes não usam caixa com padding (que
  // alargaria o token e quebraria a grade) — só cor/realce.
  return (
    <div className="whitespace-pre leading-[2.05]">
      {line.tokens.map((token, i) => {
        if (token.type === "chord" && token.substitution) {
          const sub = token.substitution;
          const changed = sub.original !== sub.substituted;
          return (
            <span
              key={i}
              onClick={() => sub.chordId && onChordClick(sub.chordId)}
              title={changed ? `${sub.original} → ${sub.substituted}` : sub.original}
              className={`group relative cursor-pointer font-bold ${
                changed
                  ? "text-primary bg-primary/15 rounded-[3px]"
                  : "text-amber-200/80 hover:text-amber-200"
              }`}
            >
              {sub.substituted}
              {changed && (
                <span className="absolute -top-5 left-0 text-[10px] text-white/60 whitespace-nowrap hidden group-hover:block bg-black/85 rounded px-1.5 py-0.5 pointer-events-none z-10">
                  era: {sub.original}
                </span>
              )}
            </span>
          );
        }
        return (
          <span key={i} className="text-white/85">
            {token.value}
          </span>
        );
      })}
    </div>
  );
}

export default function ChordSubstitutor() {
  const [inputText, setInputText] = useState("");
  const [level, setLevel] = useState<SophisticationLevel>("intermediario");
  const [copied, setCopied] = useState(false);
  const [, navigate] = useLocation();
  const { salvarCifra } = useCifrasFavoritas();

  const [salvando, setSalvando] = useState(false);
  const [salvoId, setSalvoId] = useState<string | null>(null);
  const [tituloInput, setTituloInput] = useState("");
  const [showTituloModal, setShowTituloModal] = useState(false);

  // Pré-preenche a cifra vinda do Audio Lab ("Sofisticar cifra"), se houver.
  useEffect(() => {
    try {
      const prefill = sessionStorage.getItem("harmonic:sofisticador:prefill");
      if (prefill) {
        sessionStorage.removeItem("harmonic:sofisticador:prefill");
        setInputText(prefill);
      }
    } catch {
      // sessionStorage indisponível — ignora
    }
  }, []);

  const result = useMemo(() => {
    if (!inputText.trim()) return null;
    return processChordChartFull(inputText, level);
  }, [inputText, level]);

  const processed: ProcessedLine[] = result?.lines ?? [];
  const detectedTonality: DetectedTonality | null = result?.tonality ?? null;

  const outputText = useMemo(() => {
    return processed
      .map((line) =>
        line.tokens
          .map((t) =>
            t.type === "chord" && t.substitution ? t.substitution.substituted : t.value
          )
          .join("")
      )
      .join("\n");
  }, [processed]);

  const chordsChanged = useMemo(() => {
    const changes: Array<{
      original: string;
      substituted: string;
      category: string;
      chordId?: string;
      harmonicFunction?: string;
    }> = [];
    const seen = new Set<string>();
    processed.forEach((line) => {
      line.tokens.forEach((t) => {
        if (
          t.type === "chord" &&
          t.substitution &&
          t.substitution.original !== t.substitution.substituted
        ) {
          const key = `${t.substitution.original}→${t.substitution.substituted}`;
          if (!seen.has(key)) {
            seen.add(key);
            changes.push(t.substitution);
          }
        }
      });
    });
    return changes;
  }, [processed]);

  const handleCopy = () => {
    navigator.clipboard.writeText(outputText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleChordClick = (id: string) => {
    navigate(`/acorde/${id}`);
  };

  const handleAbrirModal = () => {
    const primeiraLinha = inputText.trim().split("\n")[0].trim();
    setTituloInput(primeiraLinha || "Minha cifra sofisticada");
    setShowTituloModal(true);
    setSalvando(false);
    setSalvoId(null);
  };

  const handleConfirmarSalvar = () => {
    if (!outputText || salvando) return;
    setSalvando(true);
    const id = salvarCifra({
      titulo: tituloInput.trim() || "Cifra sem título",
      textoOriginal: inputText,
      textoSofisticado: outputText,
      nivel: level,
      mudancas: chordsChanged,
    });
    setSalvoId(id);
    setSalvando(false);
    setShowTituloModal(false);
  };

  const levelAtual = LEVELS.find((l) => l.key === level);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 lg:py-12">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <Wand2 className="w-5 h-5 text-primary" />
          </div>
          <h1 className="font-display text-3xl font-bold text-white">Sofisticador de Cifra</h1>
        </div>
        <p className="text-muted-foreground text-base leading-relaxed">
          Cole a cifra de uma música e o app substitui automaticamente os acordes por versões
          mais sofisticadas, de acordo com o nível escolhido.
        </p>
      </div>

      {/* Level selector */}
      <div className="mb-6">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
          Nível de sofisticação
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {LEVELS.map((l) => (
            <button
              key={l.key}
              onClick={() => { setLevel(l.key); setSalvoId(null); }}
              className={`flex flex-col items-start gap-1 p-4 rounded-xl border-2 transition-all text-left ${
                level === l.key
                  ? l.color
                  : "border-white/10 bg-white/[0.02] text-white/50 hover:border-white/20 hover:bg-white/[0.04]"
              }`}
            >
              <span className="font-bold text-sm">{l.label}</span>
              <span className={`text-xs leading-snug ${level === l.key ? "opacity-90" : "opacity-50"}`}>
                {l.description}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Examples */}
      <div className="mb-4">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">
          Exemplos rápidos
        </p>
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.label}
              onClick={() => { setInputText(ex.text); setSalvoId(null); }}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white transition-all"
            >
              {ex.label}
            </button>
          ))}
        </div>
      </div>

      {/* Input / Output */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Input */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-white/50 uppercase tracking-widest">
              Cifra original
            </p>
            {inputText && (
              <button
                onClick={() => { setInputText(""); setSalvoId(null); }}
                className="flex items-center gap-1 text-xs text-white/30 hover:text-white/60 transition-colors"
              >
                <RotateCcw className="w-3 h-3" /> Limpar
              </button>
            )}
          </div>
          <textarea
            value={inputText}
            onChange={(e) => { setInputText(e.target.value); setSalvoId(null); }}
            placeholder={`Cole a cifra aqui...\n\nExemplo:\nC  G  Am  F\nC  G  F  C`}
            className="flex-1 min-h-[280px] w-full bg-secondary/40 border border-white/10 rounded-xl px-5 py-4 text-white font-mono text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-none leading-loose"
          />
        </div>

        {/* Output */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="text-xs font-bold text-primary/70 uppercase tracking-widest">
                Cifra sofisticada
              </p>
              {detectedTonality && (
                <motion.span
                  key={detectedTonality.keyName}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    detectedTonality.isMinor
                      ? "bg-violet-500/15 border-violet-500/30 text-violet-300"
                      : "bg-primary/15 border-primary/30 text-primary"
                  }`}
                >
                  <Music2 className="w-2.5 h-2.5" />
                  Tom: {detectedTonality.keyName} {detectedTonality.isMinor ? "menor" : "maior"}
                </motion.span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Botão salvar cifra — sempre visível */}
              <button
                disabled={!outputText}
                onClick={salvoId ? undefined : handleAbrirModal}
                className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all ${
                  !outputText
                    ? "border-white/10 text-white/20 cursor-not-allowed"
                    : salvoId
                    ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400 cursor-default"
                    : "bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/25 cursor-pointer"
                }`}
              >
                {salvoId ? (
                  <><BookmarkCheck className="w-3 h-3" /> Salva!</>
                ) : (
                  <><Heart className={`w-3 h-3 ${outputText ? "fill-rose-400" : ""}`} /> Salvar cifra</>
                )}
              </button>

              {/* Botão copiar — sempre visível */}
              <button
                disabled={!outputText}
                onClick={handleCopy}
                className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all ${
                  !outputText
                    ? "border-white/10 text-white/20 cursor-not-allowed"
                    : "bg-primary/20 border-primary/30 text-primary hover:bg-primary/30 cursor-pointer"
                }`}
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copied ? "Copiado!" : "Copiar"}
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-[280px] bg-primary/5 border border-primary/20 rounded-2xl px-5 py-5 sm:px-6 overflow-auto">
            {processed.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center text-muted-foreground/40">
                  <Wand2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Cole uma cifra ao lado para ver a mágica</p>
                </div>
              </div>
            ) : (
              <div className="font-mono text-sm w-max min-w-full notranslate" translate="no">
                {processed.map((line, i) => (
                  <RenderedLine key={i} line={line} onChordClick={handleChordClick} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Changes summary */}
      <AnimatePresence>
        {chordsChanged.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mt-6"
          >
            <div className="flex items-center gap-2 mb-3">
              <Info className="w-4 h-4 text-primary" />
              <p className="text-xs font-bold text-primary uppercase tracking-widest">
                Substituições realizadas ({chordsChanged.length})
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {chordsChanged.map((change, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center gap-2 bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2"
                >
                  <span className="text-white/50 font-mono text-xs">{change.original}</span>
                  <ArrowRight className="w-3 h-3 text-muted-foreground" />
                  <button
                    onClick={() => {
                      const ch = chordsChanged[i];
                      if (ch) {
                        const found = processed
                          .flatMap((l) => l.tokens)
                          .find(
                            (t) =>
                              t.type === "chord" &&
                              t.substitution?.substituted === ch.substituted &&
                              t.substitution?.chordId
                          );
                        if (found?.substitution?.chordId) {
                          handleChordClick(found.substitution.chordId);
                        }
                      }
                    }}
                    className="text-primary font-mono text-xs font-bold hover:underline"
                  >
                    {change.substituted}
                  </button>
                  {change.harmonicFunction ? (
                    <span className="text-[10px] text-white/40 italic">{change.harmonicFunction}</span>
                  ) : (
                    <span className="text-[10px] text-white/30">({change.category})</span>
                  )}
                </motion.div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground/50 mt-3">
              Clique em qualquer acorde na cifra ou nas substituições acima para ver os detalhes.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal: nomear cifra antes de salvar */}
      <AnimatePresence>
        {showTituloModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) setShowTituloModal(false); }}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-xl bg-rose-500/20 flex items-center justify-center">
                  <Heart className="w-4 h-4 text-rose-400" />
                </div>
                <div>
                  <h2 className="font-display font-bold text-white text-lg">Salvar cifra sofisticada</h2>
                  <p className="text-xs text-muted-foreground">Nível: {levelAtual?.label}</p>
                </div>
              </div>

              <label className="block text-xs font-bold text-white/50 uppercase tracking-widest mb-2">
                Nome da cifra
              </label>
              <input
                autoFocus
                type="text"
                value={tituloInput}
                onChange={(e) => setTituloInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleConfirmarSalvar(); }}
                placeholder="Ex: Louvor em C — Gospel Intermediário"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent mb-5"
              />

              <div className="flex gap-3">
                <button
                  onClick={() => setShowTituloModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/50 text-sm font-medium hover:bg-white/5 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmarSalvar}
                  className="flex-1 py-2.5 rounded-xl bg-rose-500/80 hover:bg-rose-500 text-white text-sm font-bold transition-all flex items-center justify-center gap-2"
                >
                  <Heart className="w-4 h-4" /> Salvar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
