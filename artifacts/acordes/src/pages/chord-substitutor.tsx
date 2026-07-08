import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wand2, Copy, Check, RotateCcw, Heart, BookmarkCheck, Music2, Maximize2 } from "lucide-react";
import {
  processChordChartFull,
  chordIdForToken,
  SophisticationLevel,
  ProcessedLine,
  DetectedTonality,
  SubstitutionResult,
} from "@/data/substitutions";
import { useCifrasFavoritas } from "@/hooks/use-cifras-favoritas";
import { useIsActive } from "@/components/KeepAlive";
import { CifraFullscreen } from "@/components/CifraFullscreen";
import { ChordPopup } from "@/components/ChordPopup";

type ViewLevel = SophisticationLevel | "original";

const LEVELS: { key: ViewLevel; label: string }[] = [
  { key: "original", label: "Original" },
  { key: "suave", label: "Suave" },
  { key: "intermediario", label: "Intermediário" },
  { key: "avancado", label: "Avançado" },
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

// Linha em branco (sem conteúdo visível).
function isBlankLine(line: ProcessedLine): boolean {
  return lineToText(line).trim() === "";
}

// Linha só de acordes (acordes + espaços, sem letra).
function isChordOnlyLine(line: ProcessedLine): boolean {
  if (!line.hasChords) return false;
  return line.tokens.every((t) => t.type === "chord" || /^\s*$/.test(t.value));
}

// Marcações de execução isoladas ("(2x)", "Solo", "Intro"…) — não são letra.
const ANNOTATION_RE =
  /^\(?\s*(?:\d+\s*x|x\s*\d+|bis|solo|intro|instrumental|final|riff|coda|tutti|(?:repete|repetir)[a-zçãõéêáà0-9 ]*)\s*\)?\s*[:.\-–—]*\s*$/i;

// Linha de letra (tem texto visível que não é seção, marcação nem só acordes).
function isLyricLine(line: ProcessedLine): boolean {
  const t = lineToText(line).trim();
  if (!t || SECTION_RE.test(t) || ANNOTATION_RE.test(t) || isChordOnlyLine(line)) return false;
  return true;
}

// Uma linha de acordes é "instrumental" (intro/solo/passagem) quando NÃO há uma
// linha de letra logo abaixo. Nesse caso o espaçamento gigante herdado da fonte
// não serve para alinhar nada — normalizamos para uma fileira limpa. Quando há
// letra embaixo, preservamos o alinhamento monoespaçado (acorde sobre a sílaba).
function isInstrumentalChordLine(lines: ProcessedLine[], i: number): boolean {
  if (!isChordOnlyLine(lines[i])) return false;
  let j = i + 1;
  while (j < lines.length && isBlankLine(lines[j])) j++;
  const next = j < lines.length ? lines[j] : null;
  return !next || !isLyricLine(next);
}

function ChordToken({
  sub,
  onChordClick,
}: {
  sub: SubstitutionResult;
  onChordClick: (id: string, label: string) => void;
}) {
  const changed = sub.original !== sub.substituted;
  return (
    <span
      onClick={() => sub.chordId && onChordClick(sub.chordId, sub.substituted)}
      title={changed ? `${sub.original} → ${sub.substituted}` : sub.original}
      className={[
        "group relative cursor-pointer font-bold text-[#7C3AED] hover:text-[#6D28D9]",
        changed ? "underline decoration-dotted decoration-[#8B5CF6] underline-offset-4" : "",
      ].join(" ")}
    >
      {sub.substituted}
      {changed && (
        <span className="absolute -top-5 left-0 text-[10px] text-white/90 whitespace-nowrap hidden group-hover:block bg-zinc-800 rounded px-1.5 py-0.5 pointer-events-none z-10 shadow-md">
          era: {sub.original}
        </span>
      )}
    </span>
  );
}

function RenderedLine({
  line,
  instrumental,
  onChordClick,
}: {
  line: ProcessedLine;
  instrumental: boolean;
  onChordClick: (id: string, label: string) => void;
}) {
  const text = lineToText(line);
  const trimmed = text.trim();

  // Linha em branco → respiro entre as partes.
  if (!trimmed) return <div className="h-4" aria-hidden />;

  // Cabeçalho de seção ([Intro], [Refrão]…) → etiqueta destacada.
  if (SECTION_RE.test(trimmed)) {
    return (
      <div className="mt-6 mb-1 first:mt-0">
        <span className="font-bold text-zinc-900">{trimmed}</span>
      </div>
    );
  }

  // Linha de acordes instrumental (sem letra embaixo): espaçamento uniforme,
  // sem os recuos enormes da fonte que deixavam a intro "bagunçada".
  if (instrumental) {
    const chords = line.tokens.filter((t) => t.type === "chord" && t.substitution);
    return (
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 leading-[2.05]">
        {chords.map((t, i) => (
          <ChordToken key={i} sub={t.substitution!} onChordClick={onChordClick} />
        ))}
      </div>
    );
  }

  // Linha de acordes sobre letra (ou linha de letra): preserva o alinhamento
  // (whitespace-pre, sem quebra). Acordes sem padding para não quebrar a grade.
  return (
    <div className="whitespace-pre leading-[2.05]">
      {line.tokens.map((token, i) => {
        if (token.type === "chord" && token.substitution) {
          return (
            <ChordToken key={i} sub={token.substitution} onChordClick={onChordClick} />
          );
        }
        return (
          <span key={i} className="text-zinc-800">
            {token.value}
          </span>
        );
      })}
    </div>
  );
}

export default function ChordSubstitutor() {
  const [inputText, setInputText] = useState("");
  const [level, setLevel] = useState<ViewLevel>("intermediario");
  const [copied, setCopied] = useState(false);
  const { salvarCifra } = useCifrasFavoritas();

  const [fullscreenAberto, setFullscreenAberto] = useState(false);
  const [popupChord, setPopupChord] = useState<{ id: string; label: string } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [salvoId, setSalvoId] = useState<string | null>(null);
  const [tituloInput, setTituloInput] = useState("");
  const [showTituloModal, setShowTituloModal] = useState(false);

  // Pré-preenche a cifra vinda do Audio Lab ("Sofisticar cifra"), se houver.
  // Como o módulo fica montado (keep-alive), checamos sempre que ele fica ativo
  // — e não só na montagem — para pegar a cifra enviada do Audio Lab a cada vez.
  const active = useIsActive();
  useEffect(() => {
    if (!active) return;
    try {
      const prefill = sessionStorage.getItem("harmonic:sofisticador:prefill");
      if (prefill) {
        sessionStorage.removeItem("harmonic:sofisticador:prefill");
        setInputText(prefill);
      }
    } catch {
      // sessionStorage indisponível — ignora
    }
  }, [active]);

  const result = useMemo(() => {
    if (!inputText.trim()) return null;
    if (level === "original") {
      // Visualização "Original": mesma formatação bonita (tom detectado, acordes
      // clicáveis), mas sem nenhuma substituição — cada acorde permanece como está.
      const full = processChordChartFull(inputText, "suave");
      return {
        ...full,
        lines: full.lines.map((line) => ({
          ...line,
          tokens: line.tokens.map((t) =>
            t.type === "chord" && t.substitution
              ? {
                  ...t,
                  substitution: {
                    ...t.substitution,
                    substituted: t.substitution.original,
                    chordId: chordIdForToken(t.substitution.original),
                  },
                }
              : t,
          ),
        })),
      };
    }
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

  // Clicar num acorde abre um popup minimalista com a formação, em vez de
  // navegar para o dicionário — funciona igual dentro e fora da tela cheia.
  const handleChordClick = (id: string, label: string) => {
    setPopupChord({ id, label });
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
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#C24BF7] to-[#4B45E8] flex items-center justify-center shadow-lg shadow-violet-500/30">
            <Wand2 className="w-5 h-5 text-white" />
          </div>
          <h1 className="font-display text-3xl font-bold text-white">Sofisticador de <span className="text-gradient-primary">Cifra</span></h1>
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {LEVELS.map((l) => (
            <button
              key={l.key}
              onClick={() => { setLevel(l.key); setSalvoId(null); }}
              className={`flex items-center justify-center py-3 px-4 rounded-xl border transition-all ${
                level === l.key
                  ? "border-[#8B5CF6] bg-[#8B5CF6]/10 shadow-lg shadow-violet-500/20"
                  : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
              }`}
            >
              <span className={`font-bold text-sm ${level === l.key ? "text-[#9673FF]" : "text-white/50"}`}>
                {l.label}
              </span>
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
            className="flex-1 min-h-[280px] w-full bg-[#fdfcf9] border border-white/10 rounded-2xl px-5 py-4 text-zinc-800 font-mono text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6] focus:border-transparent transition-all resize-none leading-loose"
          />
        </div>

        {/* Output */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="text-xs font-bold text-[#9673FF] uppercase tracking-widest">
                {level === "original" ? "Cifra original" : "Cifra sofisticada"}
              </p>
              {detectedTonality && (
                <motion.span
                  key={detectedTonality.keyName}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border bg-[#8B5CF6]/15 border-[#8B5CF6]/40 text-[#9673FF]"
                >
                  <Music2 className="w-2.5 h-2.5" />
                  Tom: {detectedTonality.keyName} {detectedTonality.isMinor ? "menor" : "maior"}
                </motion.span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Botão tela cheia */}
              <button
                disabled={!outputText}
                onClick={() => setFullscreenAberto(true)}
                aria-label="Ver cifra em tela cheia"
                title="Ver em tela cheia"
                className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all ${
                  !outputText
                    ? "border-white/10 text-white/20 cursor-not-allowed"
                    : "bg-white/5 border-white/15 text-white/70 hover:border-[#8B5CF6]/50 hover:text-[#9673FF] cursor-pointer"
                }`}
              >
                <Maximize2 className="w-3 h-3" />
                <span className="hidden sm:inline">Tela cheia</span>
              </button>

              {/* Botão salvar cifra — sempre visível */}
              <button
                disabled={!outputText}
                onClick={salvoId ? undefined : handleAbrirModal}
                className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all ${
                  !outputText
                    ? "border-white/10 text-white/20 cursor-not-allowed"
                    : salvoId
                    ? "bg-[#8B5CF6]/15 border-[#8B5CF6]/40 text-[#9673FF] cursor-default"
                    : "bg-white/5 border-white/15 text-white/70 hover:border-[#8B5CF6]/50 hover:text-[#9673FF] cursor-pointer"
                }`}
              >
                {salvoId ? (
                  <><BookmarkCheck className="w-3 h-3" /> Salva!</>
                ) : (
                  <><Heart className={`w-3 h-3 ${outputText ? "fill-[#9673FF] text-[#9673FF]" : ""}`} /> Salvar cifra</>
                )}
              </button>

              {/* Botão copiar — sempre visível */}
              <button
                disabled={!outputText}
                onClick={handleCopy}
                className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all ${
                  !outputText
                    ? "border-white/10 text-white/20 cursor-not-allowed"
                    : "btn-kordi border-transparent cursor-pointer"
                }`}
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copied ? "Copiado!" : "Copiar"}
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-[280px] bg-[#fdfcf9] border border-[#8B5CF6]/30 rounded-2xl px-5 py-5 sm:px-6 overflow-auto">
            {processed.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center text-zinc-400">
                  <Wand2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">Cole uma cifra ao lado para ver a mágica</p>
                </div>
              </div>
            ) : (
              <div className="font-mono text-sm w-max min-w-full notranslate" translate="no">
                {processed.map((line, i) => (
                  <RenderedLine
                    key={i}
                    line={line}
                    instrumental={isInstrumentalChordLine(processed, i)}
                    onChordClick={handleChordClick}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cifra sofisticada em tela cheia */}
      <AnimatePresence>
        {fullscreenAberto && processed.length > 0 && (
          <CifraFullscreen
            title={
              detectedTonality
                ? `${level === "original" ? "Cifra original" : "Cifra sofisticada"} — Tom: ${detectedTonality.keyName} ${detectedTonality.isMinor ? "menor" : "maior"}`
                : level === "original"
                ? "Cifra original"
                : "Cifra sofisticada"
            }
            onClose={() => { setFullscreenAberto(false); setPopupChord(null); }}
          >
            {processed.map((line, i) => (
              <RenderedLine
                key={i}
                line={line}
                instrumental={isInstrumentalChordLine(processed, i)}
                onChordClick={handleChordClick}
              />
            ))}
            {/* Em fullscreen nativo só o elemento em tela cheia é visível,
                então o popup precisa ser renderizado aqui dentro. */}
            <AnimatePresence>
              {popupChord && (
                <ChordPopup
                  chordId={popupChord.id}
                  label={popupChord.label}
                  onClose={() => setPopupChord(null)}
                />
              )}
            </AnimatePresence>
          </CifraFullscreen>
        )}
      </AnimatePresence>

      {/* Popup de formação do acorde (fora da tela cheia) */}
      <AnimatePresence>
        {!fullscreenAberto && popupChord && (
          <ChordPopup
            chordId={popupChord.id}
            label={popupChord.label}
            onClose={() => setPopupChord(null)}
          />
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
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#C24BF7] to-[#4B45E8] flex items-center justify-center">
                  <Heart className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="font-display font-bold text-white text-lg">
                    {level === "original" ? "Salvar cifra original" : "Salvar cifra sofisticada"}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {level === "original" ? "Versão: Original" : `Nível: ${levelAtual?.label}`}
                  </p>
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
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6] focus:border-transparent mb-5"
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
                  className="flex-1 py-2.5 rounded-xl btn-kordi text-sm font-bold flex items-center justify-center gap-2"
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
