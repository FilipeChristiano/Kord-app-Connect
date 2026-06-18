import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AudioWaveform,
  UploadCloud,
  Loader2,
  Music2,
  Gauge,
  Clock,
  FileAudio,
  RotateCcw,
  Wand2,
  Plus,
  X,
  Info,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { useLocation } from "wouter";
import {
  analyzeAudioBuffer,
  decodeAudioFile,
  formatDuration,
  type AnalysisStep,
  type AudioAnalysisResult,
} from "@/lib/audio-analysis";
import {
  processChordChartFull,
  type SophisticationLevel,
} from "@/data/substitutions";
import { cn } from "@/lib/utils";

const MAX_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_DURATION = 12 * 60; // 12 minutos (limita memória/CPU mesmo com arquivos comprimidos)
const ACCEPT = ".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/x-m4a,audio/mp4,audio/*";

const STEPS: { key: AnalysisStep; label: string }[] = [
  { key: "lendo", label: "Lendo o áudio" },
  { key: "tom", label: "Detectando o tom" },
  { key: "bpm", label: "Detectando o BPM" },
  { key: "acordes", label: "Detectando os acordes" },
  { key: "finalizando", label: "Gerando o resultado" },
];

const LEVELS: { key: SophisticationLevel; label: string }[] = [
  { key: "suave", label: "Suave" },
  { key: "intermediario", label: "Intermediário" },
  { key: "avancado", label: "Avançado" },
];

type Phase = "idle" | "analyzing" | "result" | "error";

function isAllowedFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return /\.(mp3|wav|m4a)$/.test(name) || file.type.startsWith("audio/");
}

export default function AudioLab() {
  const [, navigate] = useLocation();

  const [phase, setPhase] = useState<Phase>("idle");
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string>("");
  const [step, setStep] = useState<AnalysisStep>("lendo");
  const [error, setError] = useState<string>("");

  const [result, setResult] = useState<AudioAnalysisResult | null>(null);
  const [chords, setChords] = useState<string[]>([]);
  const [level, setLevel] = useState<SophisticationLevel>("intermediario");
  const [showSophisticated, setShowSophisticated] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const runIdRef = useRef(0);
  const busyRef = useRef(false);

  useEffect(() => {
    return () => {
      runIdRef.current++; // invalida análise pendente ao sair
    };
  }, []);

  const reset = useCallback(() => {
    runIdRef.current++;
    busyRef.current = false;
    setPhase("idle");
    setFileName("");
    setError("");
    setResult(null);
    setChords([]);
    setShowSophisticated(false);
    setStep("lendo");
  }, []);

  const handleFile = useCallback(async (file: File) => {
    if (busyRef.current) return; // evita uploads simultâneos
    if (!isAllowedFile(file)) {
      setPhase("error");
      setError("Envie um arquivo MP3, WAV ou M4A.");
      return;
    }
    if (file.size > MAX_SIZE) {
      setPhase("error");
      setError("Esse arquivo é muito grande. Tente enviar um áudio menor (até 50MB).");
      return;
    }

    const runId = ++runIdRef.current;
    busyRef.current = true;
    setFileName(file.name);
    setError("");
    setResult(null);
    setShowSophisticated(false);
    setStep("lendo");
    setPhase("analyzing");

    try {
      const data = await file.arrayBuffer();
      if (runId !== runIdRef.current) return;
      const buffer = await decodeAudioFile(data);
      if (runId !== runIdRef.current) return;

      if (buffer.duration > MAX_DURATION) {
        setPhase("error");
        setError(
          "Esse áudio é muito longo. Envie uma música ou um trecho de até 12 minutos.",
        );
        return;
      }

      const analysis = await analyzeAudioBuffer(buffer, (s) => {
        if (runId === runIdRef.current) setStep(s);
      });
      if (runId !== runIdRef.current) return;

      if (!analysis.bpm.bpm && analysis.chords.length === 0) {
        setPhase("error");
        setError(
          "Não conseguimos analisar esse áudio com precisão. Tente um trecho mais limpo ou com menos instrumentos.",
        );
        return;
      }

      setResult(analysis);
      setChords(analysis.chords);
      setPhase("result");
    } catch {
      if (runId !== runIdRef.current) return;
      setPhase("error");
      setError(
        "Não foi possível analisar esse áudio. O formato pode não ser suportado neste navegador (tente MP3 ou WAV).",
      );
    } finally {
      if (runId === runIdRef.current) busyRef.current = false;
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  // ── Edição de acordes ───────────────────────────────────────────────────────
  const updateChord = (i: number, value: string) => {
    setChords((prev) => prev.map((c, idx) => (idx === i ? value : c)));
    setShowSophisticated(false);
  };
  const removeChord = (i: number) => {
    setChords((prev) => prev.filter((_, idx) => idx !== i));
    setShowSophisticated(false);
  };
  const addChord = () => {
    setChords((prev) => [...prev, ""]);
    setShowSophisticated(false);
  };

  // ── Sofisticação ────────────────────────────────────────────────────────────
  const sophisticated = useMemo(() => {
    const clean = chords.map((c) => c.trim()).filter(Boolean);
    if (clean.length === 0) return [];
    const { lines } = processChordChartFull(clean.join("  "), level);
    return lines
      .flatMap((l) => l.tokens)
      .filter((t) => t.type === "chord" && t.substitution)
      .map((t) => ({
        original: t.substitution!.original,
        substituted: t.substitution!.substituted,
        chordId: t.substitution!.chordId,
      }));
  }, [chords, level]);

  const bpmOpt = result?.bpm.options[result.bpm.recommendedIndex];
  const altBpms = result
    ? result.bpm.options
        .filter((_, i) => i !== result.bpm.recommendedIndex)
        .map((o) => o.bpm)
        .filter((b) => b > 0)
    : [];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 lg:py-12">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <AudioWaveform className="w-5 h-5 text-primary" />
          </div>
          <h1 className="font-display text-3xl font-bold text-white">Audio Lab</h1>
        </div>
        <p className="text-muted-foreground text-base leading-relaxed">
          Envie uma música e descubra o tom, o BPM e os acordes. Depois é só ajustar e
          mandar a progressão para o Sofisticador de Cifras.
        </p>
      </div>

      <AnimatePresence mode="wait">
        {/* ── Upload ─────────────────────────────────────────────────────────── */}
        {(phase === "idle" || phase === "error") && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "glass-card rounded-3xl border-2 border-dashed p-10 sm:p-14 text-center cursor-pointer transition-all",
                dragOver
                  ? "border-primary bg-primary/10"
                  : "border-white/15 hover:border-primary/50 hover:bg-white/[0.03]",
              )}
            >
              <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/15 border border-primary/20 flex items-center justify-center text-primary mb-5">
                <UploadCloud className="w-8 h-8" />
              </div>
              <h2 className="font-display text-xl font-bold text-white mb-2">
                Envie uma música
              </h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
                O Harmonic analisa o áudio e identifica tom, BPM e acordes. Arraste o
                arquivo aqui ou clique para escolher.
              </p>
              <span className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl font-semibold text-white bg-primary hover:bg-primary/90 transition-all">
                <FileAudio className="w-5 h-5" />
                Enviar áudio
              </span>
              <p className="text-xs text-muted-foreground/60 mt-5">
                Formatos: MP3, WAV ou M4A • até 50MB
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />

            {phase === "error" && error && (
              <div className="flex items-start gap-2 mt-5 text-sm text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 py-3">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-start gap-2 mt-5 text-[12px] text-muted-foreground/80 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-primary/70" />
              <span>
                A análise acontece direto no seu navegador. A detecção de acordes é uma
                estimativa — você poderá ajustar tudo antes de sofisticar.
              </span>
            </div>
          </motion.div>
        )}

        {/* ── Analisando ─────────────────────────────────────────────────────── */}
        {phase === "analyzing" && (
          <motion.div
            key="analyzing"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="glass-card rounded-3xl border border-white/10 p-8 sm:p-10"
          >
            <div className="flex items-center gap-3 mb-6">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
              <div className="min-w-0">
                <p className="font-display font-bold text-white">Analisando sua música</p>
                <p className="text-xs text-muted-foreground truncate">{fileName}</p>
              </div>
            </div>

            <div className="space-y-3">
              {STEPS.map((s, i) => {
                const currentIdx = STEPS.findIndex((x) => x.key === step);
                const state =
                  i < currentIdx ? "done" : i === currentIdx ? "active" : "todo";
                return (
                  <div key={s.key} className="flex items-center gap-3">
                    <span
                      className={cn(
                        "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border transition-colors",
                        state === "done" && "bg-primary border-primary text-primary-foreground",
                        state === "active" && "border-primary text-primary",
                        state === "todo" && "border-white/15 text-white/30",
                      )}
                    >
                      {state === "active" ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        i + 1
                      )}
                    </span>
                    <span
                      className={cn(
                        "text-sm transition-colors",
                        state === "todo" ? "text-white/35" : "text-white/85",
                      )}
                    >
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* ── Resultado ──────────────────────────────────────────────────────── */}
        {phase === "result" && result && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-5"
          >
            {/* Resumo */}
            <div className="glass-card rounded-3xl border border-white/10 p-6">
              <div className="flex items-center justify-between gap-3 mb-5">
                <div className="flex items-center gap-2 min-w-0">
                  <FileAudio className="w-4 h-4 text-primary shrink-0" />
                  <p className="text-sm text-white/80 truncate">{fileName}</p>
                </div>
                <button
                  onClick={reset}
                  className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/80 transition-colors shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Nova música
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <SummaryCard icon={Music2} label="Tom" value={result.key.symbol} hint={result.key.ptLabel} />
                <SummaryCard
                  icon={Gauge}
                  label="BPM"
                  value={String(bpmOpt?.bpm ?? result.bpm.bpm)}
                  hint={altBpms.length ? `alt: ${altBpms.join(" / ")}` : undefined}
                />
                <SummaryCard
                  icon={AudioWaveform}
                  label="Compasso"
                  value={result.bpm.timeSignature ?? "—"}
                />
                <SummaryCard
                  icon={Clock}
                  label="Duração"
                  value={formatDuration(result.duration)}
                />
              </div>
            </div>

            {/* Acordes detectados (editáveis) */}
            <div className="glass-card rounded-3xl border border-white/10 p-6">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-display font-bold text-white">Acordes detectados</h3>
              </div>
              <div className="flex items-start gap-2 mb-4 text-[12px] text-amber-300/90 bg-amber-500/10 border border-amber-500/25 rounded-xl px-3 py-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Os acordes abaixo são uma estimativa. Você pode ajustar antes de
                  sofisticar.
                </span>
              </div>

              {chords.length === 0 && (
                <p className="text-sm text-muted-foreground mb-3">
                  Não identificamos acordes claros. Adicione manualmente abaixo.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {chords.map((c, i) => (
                    <div
                      key={i}
                      className="group relative flex items-center bg-white/[0.04] border border-white/10 rounded-xl focus-within:border-primary/50 transition-colors"
                    >
                      <input
                        value={c}
                        onChange={(e) => updateChord(i, e.target.value)}
                        className="w-16 bg-transparent text-center text-white font-mono text-sm py-2.5 px-2 focus:outline-none notranslate"
                        translate="no"
                        aria-label={`Acorde ${i + 1}`}
                      />
                      <button
                        onClick={() => removeChord(i)}
                        className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-secondary border border-white/15 text-white/50 opacity-0 group-hover:opacity-100 hover:text-rose-400 hover:border-rose-400/40 transition-all flex items-center justify-center"
                        aria-label="Remover acorde"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                <button
                  onClick={addChord}
                  className="flex items-center gap-1 px-3 py-2.5 rounded-xl border border-dashed border-white/15 text-white/50 hover:text-white hover:border-primary/50 text-sm transition-all"
                >
                  <Plus className="w-4 h-4" /> Acorde
                </button>
              </div>

              {/* Nível + ação */}
              <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center gap-2">
                  {LEVELS.map((l) => (
                    <button
                      key={l.key}
                      onClick={() => {
                        setLevel(l.key);
                        setShowSophisticated(false);
                      }}
                      className={cn(
                        "text-xs font-medium px-3 py-1.5 rounded-lg border transition-all",
                        level === l.key
                          ? "bg-primary/20 border-primary/30 text-primary"
                          : "border-white/10 text-white/50 hover:bg-white/5 hover:text-white",
                      )}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setShowSophisticated(true)}
                  disabled={sophisticated.length === 0}
                  className={cn(
                    "sm:ml-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all",
                    sophisticated.length === 0
                      ? "bg-white/5 text-white/30 cursor-not-allowed"
                      : "bg-primary text-primary-foreground hover:bg-primary/90",
                  )}
                >
                  <Wand2 className="w-4 h-4" /> Sofisticar progressão
                </button>
              </div>
            </div>

            {/* Resultado sofisticado */}
            <AnimatePresence>
              {showSophisticated && sophisticated.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="glass-card rounded-3xl border border-primary/20 bg-primary/5 p-6"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <Wand2 className="w-4 h-4 text-primary" />
                    <h3 className="font-display font-bold text-white">
                      Progressão sofisticada
                    </h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {sophisticated.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => s.chordId && navigate(`/acorde/${s.chordId}`)}
                        className={cn(
                          "flex items-center gap-2 rounded-xl px-3 py-2 border transition-all",
                          s.chordId
                            ? "cursor-pointer hover:bg-primary/15"
                            : "cursor-default",
                          s.original !== s.substituted
                            ? "bg-primary/10 border-primary/30"
                            : "bg-white/[0.03] border-white/10",
                        )}
                        title={
                          s.original !== s.substituted
                            ? `${s.original} → ${s.substituted}`
                            : s.original
                        }
                      >
                        {s.original !== s.substituted && (
                          <>
                            <span className="text-white/40 font-mono text-xs">
                              {s.original}
                            </span>
                            <ArrowRight className="w-3 h-3 text-muted-foreground" />
                          </>
                        )}
                        <span
                          className={cn(
                            "font-mono text-sm font-bold notranslate",
                            s.original !== s.substituted ? "text-primary" : "text-white/70",
                          )}
                          translate="no"
                        >
                          {s.substituted}
                        </span>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground/60 mt-4">
                    Clique em um acorde para ver os detalhes no dicionário. Quer mais
                    opções? Leve esta progressão para o{" "}
                    <button
                      onClick={() => navigate("/sofisticador")}
                      className="text-primary hover:underline"
                    >
                      Sofisticador de Cifras
                    </button>
                    .
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1.5">
        <Icon className="w-3.5 h-3.5" />
        <span className="text-[11px] font-bold uppercase tracking-widest">{label}</span>
      </div>
      <p className="text-2xl font-display font-bold text-white notranslate" translate="no">
        {value}
      </p>
      {hint && <p className="text-[11px] text-muted-foreground/70 mt-0.5">{hint}</p>}
    </div>
  );
}
