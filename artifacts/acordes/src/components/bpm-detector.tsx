import { useCallback, useEffect, useRef, useState } from "react";
import {
  Upload,
  Mic,
  Square,
  Trash2,
  Loader2,
  Check,
  AudioWaveform,
  Gauge,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  analyzeBpm,
  type BpmAnalysis,
  type DetectedTimeSignature,
} from "@/lib/bpm-detector";

interface BpmDetectorProps {
  onApply: (bpm: number, timeSignature: DetectedTimeSignature | null) => void;
}

const MAX_RECORD_SECONDS = 20;

async function decodeToBuffer(data: ArrayBuffer): Promise<AudioBuffer> {
  const Ctor: typeof AudioContext =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctor();
  try {
    // slice() para garantir um ArrayBuffer "transferível" e não destacado
    const buffer = await ctx.decodeAudioData(data.slice(0));
    return buffer;
  } finally {
    ctx.close().catch(() => {});
  }
}

export default function BpmDetector({ onApply }: BpmDetectorProps) {
  const [source, setSource] = useState<"none" | "upload" | "record">("none");
  const [fileName, setFileName] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioDataRef = useRef<ArrayBuffer | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<BpmAnalysis | null>(null);
  const [selectedBpm, setSelectedBpm] = useState<number | null>(null);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const analysisIdRef = useRef(0);

  // Mantém uma referência atual da URL do blob para revogar com segurança
  const setAudioUrlSafe = useCallback((url: string | null) => {
    if (audioUrlRef.current && audioUrlRef.current !== url) {
      URL.revokeObjectURL(audioUrlRef.current);
    }
    audioUrlRef.current = url;
    setAudioUrl(url);
  }, []);

  const cleanupStream = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      cleanupStream();
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetAll = useCallback(() => {
    cleanupStream();
    analysisIdRef.current++; // invalida qualquer análise em andamento
    setAudioUrlSafe(null);
    audioDataRef.current = null;
    setFileName(null);
    setSource("none");
    setIsRecording(false);
    setRecordSeconds(0);
    setAnalyzing(false);
    setResult(null);
    setSelectedBpm(null);
    setApplied(false);
    setError(null);
    chunksRef.current = [];
  }, [audioUrl, cleanupStream]);

  // ── Upload ───────────────────────────────────────────────────────────────
  const handleFile = async (file: File) => {
    setError(null);
    setResult(null);
    setApplied(false);
    try {
      const data = await file.arrayBuffer();
      audioDataRef.current = data;
      analysisIdRef.current++;
      setFileName(file.name);
      setAudioUrlSafe(URL.createObjectURL(file));
      setSource("upload");
    } catch {
      setError("Não foi possível ler esse arquivo. Tente outro áudio.");
    }
  };

  // ── Gravação ─────────────────────────────────────────────────────────────
  const startRecording = async () => {
    setError(null);
    setResult(null);
    setApplied(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, {
          type: chunksRef.current[0]?.type || "audio/webm",
        });
        try {
          const data = await blob.arrayBuffer();
          audioDataRef.current = data;
          analysisIdRef.current++;
          setAudioUrlSafe(URL.createObjectURL(blob));
          setFileName("Gravação");
          setSource("record");
        } catch {
          setError("Não foi possível processar a gravação.");
        }
        cleanupStream();
        setIsRecording(false);
      };

      recorder.start();
      setIsRecording(true);
      setSource("record");
      setRecordSeconds(0);
      setFileName(null);
      audioDataRef.current = null;

      timerRef.current = window.setInterval(() => {
        setRecordSeconds((prev) => {
          const next = prev + 1;
          if (next >= MAX_RECORD_SECONDS) {
            stopRecording();
          }
          return next;
        });
      }, 1000);
    } catch {
      setError(
        "Não foi possível acessar o microfone. Verifique a permissão do navegador.",
      );
      cleanupStream();
      setIsRecording(false);
      setSource("none");
    }
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const cancelRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      recorder.stop();
    }
    cleanupStream();
    setIsRecording(false);
    setRecordSeconds(0);
    setSource("none");
    audioDataRef.current = null;
  };

  // ── Análise ──────────────────────────────────────────────────────────────
  const handleAnalyze = async () => {
    if (!audioDataRef.current) return;
    const runId = ++analysisIdRef.current; // token para ignorar resultados obsoletos
    setAnalyzing(true);
    setError(null);
    setResult(null);
    setApplied(false);
    try {
      // pequena pausa para o spinner aparecer antes do trabalho pesado
      await new Promise((r) => setTimeout(r, 50));
      const buffer = await decodeToBuffer(audioDataRef.current);
      const analysis = analyzeBpm(buffer);
      if (runId !== analysisIdRef.current) return; // áudio trocado/apagado: descarta
      if (!analysis.bpm) {
        setError(
          "Não consegui identificar uma batida clara nesse áudio. Tente um trecho com ritmo mais marcado.",
        );
      } else {
        setResult(analysis);
        setSelectedBpm(analysis.bpm);
      }
    } catch {
      if (runId !== analysisIdRef.current) return;
      setError(
        "Não foi possível analisar esse áudio. O formato pode não ser suportado neste navegador.",
      );
    } finally {
      if (runId === analysisIdRef.current) setAnalyzing(false);
    }
  };

  const handleApply = () => {
    if (selectedBpm == null) return;
    onApply(selectedBpm, result?.timeSignature ?? null);
    setApplied(true);
  };

  const confidencePct = result ? Math.round(result.confidence * 100) : 0;
  const confidenceLabel =
    confidencePct >= 66 ? "Alta" : confidencePct >= 33 ? "Média" : "Baixa";

  const hasAudio = !!audioDataRef.current && !isRecording;

  return (
    <div className="glass-card rounded-3xl p-6 sm:p-8 border border-white/10 shadow-2xl">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center text-primary">
          <Gauge className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-display text-xl font-bold text-white">Detectar BPM</h2>
          <p className="text-xs text-muted-foreground">
            Suba um áudio ou grave um trecho para descobrir o tempo
          </p>
        </div>
      </div>

      {/* Aviso de limitações */}
      <div className="flex items-start gap-2 mt-4 mb-6 text-[12px] text-muted-foreground/80 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-primary/70" />
        <span>
          A detecção funciona melhor com trechos que tenham batida, palmas, violão ou
          bateria bem marcados. Em introduções livres, pads ou momentos espontâneos, o
          resultado pode ser aproximado.
        </span>
      </div>

      {/* Entradas */}
      {!isRecording && (
        <div className="grid sm:grid-cols-2 gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl font-semibold text-white bg-secondary hover:bg-secondary/80 border border-white/10 transition-all"
          >
            <Upload className="w-5 h-5 text-primary" />
            Subir áudio
          </button>
          <button
            onClick={startRecording}
            className="flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl font-semibold text-white bg-secondary hover:bg-secondary/80 border border-white/10 transition-all"
          >
            <Mic className="w-5 h-5 text-primary" />
            Gravar áudio
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/x-m4a,audio/mp4,audio/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
        </div>
      )}

      {/* Painel de gravação */}
      {isRecording && (
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
            <span className="font-display text-3xl font-bold text-white notranslate" translate="no">
              {recordSeconds}s
            </span>
            <span className="text-sm text-muted-foreground">/ {MAX_RECORD_SECONDS}s</span>
          </div>
          <div className="w-full max-w-sm h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-primary transition-[width] duration-1000 ease-linear"
              style={{ width: `${(recordSeconds / MAX_RECORD_SECONDS) * 100}%` }}
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={stopRecording}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-primary-foreground bg-primary hover:bg-orange-400 transition-all"
            >
              <Square className="w-4 h-4 fill-current" />
              Parar gravação
            </button>
            <button
              onClick={cancelRecording}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl font-semibold text-muted-foreground hover:text-white bg-secondary/50 hover:bg-secondary border border-white/5 transition-all"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Áudio carregado/gravado */}
      {hasAudio && (
        <div className="mt-5 space-y-4">
          <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
            <AudioWaveform className="w-5 h-5 text-primary shrink-0" />
            <span className="text-sm text-white font-medium truncate flex-1">
              {fileName}
            </span>
            <button
              onClick={resetAll}
              className="text-muted-foreground hover:text-red-400 transition-colors p-1"
              aria-label="Apagar áudio"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {audioUrl && (
            <audio src={audioUrl} controls className="w-full h-10" />
          )}

          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className={cn(
              "w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl font-bold transition-all",
              analyzing
                ? "bg-secondary text-muted-foreground cursor-wait"
                : "bg-primary text-primary-foreground hover:bg-orange-400 shadow-lg shadow-primary/20",
            )}
          >
            {analyzing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Analisando…
              </>
            ) : (
              <>
                <Gauge className="w-5 h-5" />
                Analisar BPM
              </>
            )}
          </button>
        </div>
      )}

      {/* Erro */}
      {error && (
        <div className="mt-5 text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {/* Resultado */}
      {result && (
        <div className="mt-6 rounded-2xl border border-primary/20 bg-primary/5 p-5">
          <div className="text-center">
            <div className="text-xs uppercase tracking-widest text-primary/70 font-semibold">
              BPM detectado
            </div>
            <div className="font-display text-6xl font-bold text-white my-1 notranslate" translate="no">
              {result.bpm}
            </div>
            <div className="text-xs text-muted-foreground">
              Confiança: <span className="text-white/90 font-semibold">{confidenceLabel}</span> ({confidencePct}%)
            </div>
          </div>

          {/* Alternativas */}
          <div className="mt-5">
            <div className="text-xs text-muted-foreground text-center mb-2">
              Alternativas (caso o tempo soe rápido ou lento demais)
            </div>
            <div className="flex items-center justify-center gap-2">
              {result.alternatives.map((alt, idx) => {
                const labels = ["metade", "detectado", "dobro"];
                const isSel = selectedBpm === alt;
                return (
                  <button
                    key={`${alt}-${idx}`}
                    onClick={() => {
                      setSelectedBpm(alt);
                      setApplied(false);
                    }}
                    className={cn(
                      "flex flex-col items-center gap-0.5 px-4 py-2.5 rounded-xl border transition-all min-w-[78px]",
                      isSel
                        ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20"
                        : "bg-white/5 text-white border-white/10 hover:border-white/25",
                    )}
                  >
                    <span className="font-display text-xl font-bold notranslate" translate="no">
                      {alt}
                    </span>
                    <span className={cn("text-[10px]", isSel ? "text-primary-foreground/80" : "text-muted-foreground")}>
                      {labels[idx]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Compasso sugerido */}
          <div className="mt-5 text-center text-sm">
            {result.timeSignature ? (
              <span className="text-muted-foreground">
                Compasso provável:{" "}
                <span className="text-white font-bold notranslate" translate="no">
                  {result.timeSignature}
                </span>
              </span>
            ) : (
              <span className="text-muted-foreground/80 text-[13px]">
                Não foi possível identificar o compasso com segurança. Escolha manualmente.
              </span>
            )}
          </div>

          {/* Aplicar */}
          <button
            onClick={handleApply}
            disabled={applied}
            className={cn(
              "w-full mt-5 flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl font-bold transition-all",
              applied
                ? "bg-green-500/20 text-green-300 border border-green-500/30"
                : "bg-primary text-primary-foreground hover:bg-orange-400 shadow-lg shadow-primary/20 hover:-translate-y-0.5",
            )}
          >
            {applied ? (
              <>
                <Check className="w-5 h-5" />
                BPM aplicado ao metrônomo
              </>
            ) : (
              <>Usar {selectedBpm} BPM</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
