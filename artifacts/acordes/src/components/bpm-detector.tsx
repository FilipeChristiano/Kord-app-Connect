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
  AlertTriangle,
  Hand,
  RotateCcw,
  Play,
  Pause,
  Minus,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  analyzeBpm,
  type BpmAnalysis,
  type BpmOption,
  type BpmRelation,
  type DetectedTimeSignature,
} from "@/lib/bpm-detector";

interface BpmDetectorProps {
  onApply: (bpm: number, timeSignature: DetectedTimeSignature | null) => void;
}

const MAX_RECORD_SECONDS = 30;
const TAP_TARGETS = [8, 12] as const;
const MIN_BPM = 40;
const MAX_BPM = 240;
const LS_KEY = "harmonic:lastBpm";
const FINE_PLAY_KEY = -1;

const RELATION_LABEL: Record<BpmRelation, string> = {
  metade: "Metade",
  principal: "Principal",
  dobro: "Dobro",
};

interface LastConfirmed {
  bpm: number;
  ts: DetectedTimeSignature | null;
  name: string | null;
}

interface TapResult {
  bpm: number;
  stability: number; // 0..1
  used: number;
}

const clampBpm = (v: number) => Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(v)));

function formatTime(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

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

// Calcula BPM + estabilidade dos toques, ignorando toques muito fora do padrão.
function computeTapResult(times: number[], target: number): TapResult | null {
  if (times.length < 2) return null;
  const recent = times.slice(-target);
  const intervals: number[] = [];
  for (let i = 1; i < recent.length; i++) intervals.push(recent[i] - recent[i - 1]);
  if (intervals.length === 0) return null;

  // mediana p/ rejeição de outliers
  const sorted = [...intervals].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const kept = intervals.filter((d) => Math.abs(d - median) <= 0.35 * median);
  const use = kept.length >= 2 ? kept : intervals;

  const avg = use.reduce((a, b) => a + b, 0) / use.length;
  if (!(avg > 0)) return null;
  const bpm = clampBpm(60000 / avg);

  // estabilidade a partir do coeficiente de variação (CV ~15% => 0)
  let v = 0;
  for (const d of use) v += (d - avg) ** 2;
  const sd = Math.sqrt(v / use.length);
  const cv = sd / avg;
  const stability = Math.max(0, Math.min(1, 1 - cv / 0.15));

  return { bpm, stability, used: use.length };
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
  const [selectedIndex, setSelectedIndex] = useState(1);
  const [finalBpm, setFinalBpm] = useState(0);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastConfirmed, setLastConfirmed] = useState<LastConfirmed | null>(null);

  // ── Player "Ouvir com metrônomo" ───────────────────────────────────────────
  const bufferRef = useRef<AudioBuffer | null>(null);
  const previewCtxRef = useRef<AudioContext | null>(null);
  const previewRef = useRef<{
    source: AudioBufferSourceNode;
    nodes: OscillatorNode[];
  } | null>(null);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);

  // ── Modo "Marcar Pulso" ────────────────────────────────────────────────────
  const [tapMode, setTapMode] = useState(false);
  const [tapTarget, setTapTarget] = useState<(typeof TAP_TARGETS)[number]>(8);
  const [tapCount, setTapCount] = useState(0);
  const [tapResult, setTapResult] = useState<TapResult | null>(null);
  const [tapApplied, setTapApplied] = useState(false);
  const tapTimesRef = useRef<number[]>([]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const analysisIdRef = useRef(0);

  // Carrega a última referência confirmada (armazenamento local)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as LastConfirmed;
        if (parsed && typeof parsed.bpm === "number") setLastConfirmed(parsed);
      }
    } catch {
      /* ignora */
    }
  }, []);

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

  const stopPreview = useCallback(() => {
    const p = previewRef.current;
    if (p) {
      try {
        p.source.onended = null;
        p.source.stop();
      } catch {
        /* já parado */
      }
      p.nodes.forEach((n) => {
        try {
          n.stop();
        } catch {
          /* já parado */
        }
      });
      previewRef.current = null;
    }
    setPlayingIndex(null);
  }, []);

  useEffect(() => {
    return () => {
      cleanupStream();
      stopPreview();
      previewCtxRef.current?.close().catch(() => {});
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetAll = useCallback(() => {
    cleanupStream();
    stopPreview();
    analysisIdRef.current++; // invalida qualquer análise em andamento
    setAudioUrlSafe(null);
    audioDataRef.current = null;
    bufferRef.current = null;
    setFileName(null);
    setSource("none");
    setIsRecording(false);
    setRecordSeconds(0);
    setAnalyzing(false);
    setResult(null);
    setSelectedIndex(1);
    setFinalBpm(0);
    setApplied(false);
    setError(null);
    chunksRef.current = [];
  }, [cleanupStream, setAudioUrlSafe, stopPreview]);

  // ── Upload ───────────────────────────────────────────────────────────────
  const handleFile = async (file: File) => {
    setError(null);
    setResult(null);
    setApplied(false);
    stopPreview();
    try {
      const data = await file.arrayBuffer();
      audioDataRef.current = data;
      bufferRef.current = null;
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
    stopPreview();
    analysisIdRef.current++; // invalida qualquer análise em andamento
    bufferRef.current = null;
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
          bufferRef.current = null;
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
    stopPreview();
    setAnalyzing(true);
    setError(null);
    setResult(null);
    setApplied(false);
    try {
      // pequena pausa para o spinner aparecer antes do trabalho pesado
      await new Promise((r) => setTimeout(r, 50));
      const buffer = await decodeToBuffer(audioDataRef.current);
      const analysis = await analyzeBpm(buffer);
      if (runId !== analysisIdRef.current) return; // áudio trocado/apagado: descarta
      if (!analysis.bpm) {
        setError(
          "Não consegui identificar uma batida clara nesse áudio. Tente um trecho com ritmo mais marcado ou use o modo Marcar Pulso.",
        );
      } else {
        bufferRef.current = buffer; // guarda p/ tocar o trecho com metrônomo
        setResult(analysis);
        const idx = analysis.recommendedIndex;
        setSelectedIndex(idx);
        setFinalBpm(analysis.options[idx]?.bpm ?? analysis.bpm);
      }
    } catch {
      if (runId !== analysisIdRef.current) return;
      setError(
        "Não foi possível analisar esse áudio. O formato pode não ser suportado neste navegador (tente mp3 ou wav).",
      );
    } finally {
      if (runId === analysisIdRef.current) setAnalyzing(false);
    }
  };

  // ── Player "Ouvir com metrônomo" ───────────────────────────────────────────
  // Toca o trecho analisado com cliques do metrônomo num dado BPM/fase.
  // `key` identifica quem está tocando (índice da opção, ou FINE_KEY p/ ajuste fino).
  const startMetronomePlayback = useCallback(
    async (bpm: number, phaseSec: number, key: number) => {
      if (playingIndex === key) {
        stopPreview();
        return;
      }
      stopPreview();
      const buffer = bufferRef.current;
      const seg = result?.segment;
      if (!buffer || !seg || !(bpm > 0)) return;

      let ctx = previewCtxRef.current;
      if (!ctx) {
        const Ctor: typeof AudioContext =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        ctx = new Ctor();
        previewCtxRef.current = ctx;
      }
      if (ctx.state === "suspended") {
        try {
          await ctx.resume();
        } catch {
          /* ignora */
        }
      }

      const start = ctx.currentTime + 0.12;
      const dur = Math.max(0.5, seg.end - seg.start);

      // Áudio do trecho analisado
      const master = ctx.createGain();
      master.gain.value = 0.85;
      master.connect(ctx.destination);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(master);
      src.start(start, seg.start, dur);

      // Cliques do metrônomo sincronizados à fase informada
      const nodes: OscillatorNode[] = [];
      const T = 60 / bpm;
      const first = phaseSec - T * Math.floor(phaseSec / T);
      for (let t = first; t < dur; t += T) {
        const when = start + t;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.frequency.value = 1500;
        g.gain.setValueAtTime(0.0001, when);
        g.gain.exponentialRampToValueAtTime(0.5, when + 0.001);
        g.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(when);
        osc.stop(when + 0.06);
        nodes.push(osc);
      }

      src.onended = () => {
        if (previewRef.current?.source === src) {
          previewRef.current = null;
          setPlayingIndex(null);
        }
      };
      previewRef.current = { source: src, nodes };
      setPlayingIndex(key);
    },
    [playingIndex, result, stopPreview],
  );

  const playPreview = useCallback(
    (index: number) => {
      const opt = result?.options[index];
      if (!opt) return;
      startMetronomePlayback(opt.bpm, opt.phaseSec, index);
    },
    [result, startMetronomePlayback],
  );

  // "Ouvir" com o BPM do ajuste fino (fase 0 = do início do trecho)
  const playFinePreview = useCallback(() => {
    startMetronomePlayback(clampBpm(finalBpm), 0, FINE_PLAY_KEY);
  }, [finalBpm, startMetronomePlayback]);

  const selectOption = (index: number) => {
    const opt = result?.options[index];
    if (!opt) return;
    setSelectedIndex(index);
    setFinalBpm(opt.bpm);
    setApplied(false);
  };

  const nudgeBpm = (delta: number) => {
    setFinalBpm((b) => clampBpm((b || 0) + delta));
    setApplied(false);
  };

  const handleManualBpm = (raw: string) => {
    const n = parseInt(raw, 10);
    if (Number.isFinite(n)) {
      setFinalBpm(Math.max(0, Math.min(MAX_BPM, n)));
      setApplied(false);
    } else if (raw === "") {
      setFinalBpm(0);
    }
  };

  const confirmBpm = () => {
    const bpm = clampBpm(finalBpm);
    if (!(bpm > 0)) return;
    const ts = result?.timeSignature ?? null;
    onApply(bpm, ts);
    setApplied(true);
    const entry: LastConfirmed = { bpm, ts, name: fileName };
    setLastConfirmed(entry);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(entry));
    } catch {
      /* ignora */
    }
  };

  // ── Marcar Pulso ────────────────────────────────────────────────────────────
  const openTapMode = () => {
    setTapMode(true);
    setTapCount(0);
    setTapResult(null);
    setTapApplied(false);
    tapTimesRef.current = [];
  };

  const resetTaps = () => {
    setTapCount(0);
    setTapResult(null);
    setTapApplied(false);
    tapTimesRef.current = [];
  };

  const handleTap = () => {
    const now = performance.now();
    const taps = tapTimesRef.current;
    // Reinicia se demorou demais entre toques (> 2s)
    if (taps.length && now - taps[taps.length - 1] > 2000) {
      tapTimesRef.current = [];
      setTapResult(null);
      setTapApplied(false);
    }
    tapTimesRef.current.push(now);
    // Mantém só os toques recentes necessários para a média
    if (tapTimesRef.current.length > tapTarget + 4) {
      tapTimesRef.current = tapTimesRef.current.slice(-(tapTarget + 4));
    }
    const arr = tapTimesRef.current;
    setTapCount(arr.length);

    const res = computeTapResult(arr, tapTarget);
    if (res) {
      setTapResult(res);
      setTapApplied(false);
    }
  };

  const applyTapBpm = () => {
    if (!tapResult) return;
    onApply(tapResult.bpm, null);
    setTapApplied(true);
    const entry: LastConfirmed = { bpm: tapResult.bpm, ts: null, name: "Marcar Pulso" };
    setLastConfirmed(entry);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(entry));
    } catch {
      /* ignora */
    }
  };

  const confidencePct = result ? Math.round(result.confidence * 100) : 0;
  const lowConfidence = !!result && confidencePct < 80;
  const selectedOption = result?.options[selectedIndex] ?? null;
  const hasAudio = !!audioDataRef.current && !isRecording;
  const tapStabilityPct = tapResult ? Math.round(tapResult.stability * 100) : 0;
  const tapStabilityLabel =
    tapStabilityPct >= 80 ? "Ótima" : tapStabilityPct >= 55 ? "Boa" : "Irregular";

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
          bateria bem marcados. Use <span className="text-white/90 font-medium">Ouvir com
          metrônomo</span> para conferir qual opção encaixa e o modo{" "}
          <span className="text-white/90 font-medium">Marcar Pulso</span> para acertar
          manualmente.
        </span>
      </div>

      {/* Última referência confirmada */}
      {lastConfirmed && !result && !isRecording && (
        <div className="flex items-center gap-2 mb-4 text-[12px] text-muted-foreground bg-white/5 border border-white/10 rounded-xl px-3 py-2">
          <Check className="w-3.5 h-3.5 text-primary" />
          <span>
            Último BPM confirmado:{" "}
            <span className="text-white font-semibold notranslate" translate="no">
              {lastConfirmed.bpm}
            </span>
            {lastConfirmed.ts ? ` • ${lastConfirmed.ts}` : ""}
          </span>
        </div>
      )}

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

          {audioUrl && <audio src={audioUrl} controls className="w-full h-10" />}

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
      {result && selectedOption && (
        <div className="mt-6 rounded-2xl border border-primary/20 bg-primary/5 p-5">
          {/* BPM escolhido */}
          <div className="text-center">
            <div className="text-xs uppercase tracking-widest text-primary/70 font-semibold">
              BPM escolhido
            </div>
            <div className="font-display text-6xl font-bold text-white my-1 notranslate" translate="no">
              {clampBpm(finalBpm)}
            </div>
            {result.segment && (
              <div className="text-[11px] text-muted-foreground/80 notranslate" translate="no">
                Trecho analisado: {formatTime(result.segment.start)} até{" "}
                {formatTime(result.segment.end)}
              </div>
            )}
          </div>

          {/* Aviso de baixa confiança (<80%) */}
          {lowConfidence && (
            <div className="flex items-start gap-2 mt-4 text-[12px] text-orange-200 bg-orange-500/10 border border-orange-500/25 rounded-xl px-3 py-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-orange-300" />
              <span>
                Resultado aproximado. Utilize{" "}
                <span className="font-medium">Ouvir com Metrônomo</span> ou{" "}
                <span className="font-medium">Marcar Pulso</span> para confirmar.
              </span>
            </div>
          )}

          {/* 3 opções: metade / principal / dobro */}
          <div className="mt-5 grid grid-cols-3 gap-2">
            {result.options.map((opt, idx) => (
              <OptionCard
                key={opt.relation}
                option={opt}
                selected={selectedIndex === idx}
                recommended={idx === result.recommendedIndex}
                playing={playingIndex === idx}
                onSelect={() => selectOption(idx)}
                onTogglePlay={() => {
                  selectOption(idx);
                  playPreview(idx);
                }}
              />
            ))}
          </div>

          {/* Métricas da opção selecionada — faixa de largura total (sempre legível) */}
          <div className="mt-3 rounded-xl border border-white/5 bg-white/5 p-3 @container">
            <div className="text-[11px] text-muted-foreground mb-2.5">
              Detalhes —{" "}
              <span className="text-white font-semibold notranslate" translate="no">
                {RELATION_LABEL[selectedOption.relation]} · {selectedOption.bpm} BPM
              </span>
            </div>
            <div className="grid grid-cols-2 @[20rem]:grid-cols-4 gap-x-4 gap-y-3 text-[11px]">
              <Metric
                label="Regularidade"
                value={`${Math.round(selectedOption.metrics.regularity * 100)}%`}
              />
              <Metric
                label="Erro médio"
                value={`±${Math.round(selectedOption.metrics.meanErrorMs)} ms`}
              />
              <Metric
                label="Estabilidade"
                value={`${Math.round(selectedOption.metrics.stability * 100)}%`}
              />
              <Metric
                label="Batidas"
                value={String(selectedOption.metrics.beatCount)}
              />
            </div>
          </div>

          {/* Ajuste fino */}
          <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-muted-foreground mb-3 text-center">
              Ajuste fino
            </div>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => nudgeBpm(-1)}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-secondary hover:bg-secondary/70 border border-white/10 text-white transition-all"
                aria-label="Menos 1 BPM"
              >
                <Minus className="w-4 h-4" />
              </button>
              <input
                type="number"
                inputMode="numeric"
                min={MIN_BPM}
                max={MAX_BPM}
                value={finalBpm || ""}
                onChange={(e) => handleManualBpm(e.target.value)}
                className="w-24 text-center font-display text-2xl font-bold bg-background/60 border border-white/15 rounded-xl py-2 text-white outline-none focus:border-primary/60 notranslate"
                translate="no"
              />
              <button
                onClick={() => nudgeBpm(1)}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-secondary hover:bg-secondary/70 border border-white/10 text-white transition-all"
                aria-label="Mais 1 BPM"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Ouvir o trecho com o BPM do ajuste fino */}
            <button
              onClick={playFinePreview}
              disabled={!bufferRef.current || !(clampBpm(finalBpm) > 0)}
              className={cn(
                "mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed",
                playingIndex === FINE_PLAY_KEY
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary hover:bg-secondary/70 text-white border border-white/10",
              )}
            >
              {playingIndex === FINE_PLAY_KEY ? (
                <>
                  <Pause className="w-4 h-4 shrink-0" /> Parar
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 shrink-0" /> Ouvir com metrônomo
                </>
              )}
            </button>
          </div>

          {/* Compasso sugerido */}
          <div className="mt-4 text-center text-sm">
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

          {/* Confirmar / aplicar */}
          <button
            onClick={confirmBpm}
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
                Aplicado ao metrônomo
              </>
            ) : (
              <>
                <Check className="w-5 h-5" />
                Este está certo — usar {clampBpm(finalBpm)} BPM
              </>
            )}
          </button>
        </div>
      )}

      {/* ── Marcar Pulso ──────────────────────────────────────────────────────── */}
      <div className="mt-5">
        {!tapMode ? (
          <button
            onClick={openTapMode}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl font-semibold text-white bg-secondary/60 hover:bg-secondary border border-white/10 transition-all"
          >
            <Hand className="w-5 h-5 text-primary" />
            Marcar Pulso (correção manual)
          </button>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Hand className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-white">Marcar Pulso</span>
              </div>
              <button
                onClick={() => setTapMode(false)}
                className="text-xs text-muted-foreground hover:text-white transition-colors"
              >
                Fechar
              </button>
            </div>

            <p className="text-[12px] text-muted-foreground mb-3">
              Toque no botão acompanhando a música. Calculamos a média ignorando toques
              fora do padrão.
            </p>

            {/* Seletor de toques */}
            <div className="flex items-center justify-center gap-2 mb-4">
              {TAP_TARGETS.map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setTapTarget(t);
                    resetTaps();
                  }}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-sm font-semibold border transition-all notranslate",
                    tapTarget === t
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-white/5 text-muted-foreground border-white/10 hover:border-white/25",
                  )}
                  translate="no"
                >
                  {t} toques
                </button>
              ))}
            </div>

            {/* Botão de toque */}
            <button
              onClick={handleTap}
              className="w-full select-none flex flex-col items-center justify-center gap-1 py-8 rounded-2xl font-bold bg-primary/15 hover:bg-primary/25 border-2 border-primary/30 text-white transition-all active:scale-[0.98]"
            >
              <span className="text-sm text-primary/80 uppercase tracking-widest">
                Toque no tempo
              </span>
              <span className="font-display text-2xl notranslate" translate="no">
                {Math.min(tapCount, tapTarget)} / {tapTarget}
              </span>
            </button>

            {/* Resultado do tap */}
            {tapResult != null && (
              <div className="mt-4 text-center">
                <div className="text-xs uppercase tracking-widest text-primary/70 font-semibold">
                  BPM sugerido
                </div>
                <div className="font-display text-5xl font-bold text-white my-1 notranslate" translate="no">
                  {tapResult.bpm}
                </div>
                <div className="text-xs text-muted-foreground mb-3">
                  Estabilidade do toque:{" "}
                  <span
                    className={cn(
                      "font-semibold",
                      tapStabilityPct >= 80
                        ? "text-green-300"
                        : tapStabilityPct >= 55
                          ? "text-yellow-300"
                          : "text-orange-300",
                    )}
                  >
                    {tapStabilityLabel}
                  </span>{" "}
                  ({tapStabilityPct}%)
                </div>
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={applyTapBpm}
                    disabled={tapApplied}
                    className={cn(
                      "flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold transition-all",
                      tapApplied
                        ? "bg-green-500/20 text-green-300 border border-green-500/30"
                        : "bg-primary text-primary-foreground hover:bg-orange-400 shadow-lg shadow-primary/20",
                    )}
                  >
                    {tapApplied ? (
                      <>
                        <Check className="w-4 h-4" /> Aplicado
                      </>
                    ) : (
                      <>Usar {tapResult.bpm} BPM</>
                    )}
                  </button>
                  <button
                    onClick={resetTaps}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-2xl font-semibold text-muted-foreground hover:text-white bg-secondary/50 hover:bg-secondary border border-white/5 transition-all"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Refazer
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Cartão de opção (metade / principal / dobro) ──────────────────────────────
interface OptionCardProps {
  option: BpmOption;
  selected: boolean;
  recommended: boolean;
  playing: boolean;
  onSelect: () => void;
  onTogglePlay: () => void;
}

function OptionCard({
  option,
  selected,
  recommended,
  playing,
  onSelect,
  onTogglePlay,
}: OptionCardProps) {
  const confPct = Math.round(option.confidence * 100);

  return (
    <div
      onClick={onSelect}
      className={cn(
        "cursor-pointer rounded-2xl border p-3 transition-all flex flex-col min-w-0 overflow-hidden",
        selected
          ? "border-primary bg-primary/10 shadow-lg shadow-primary/10"
          : "border-white/10 bg-white/5 hover:border-white/25",
      )}
    >
      {/* Cabeçalho: nome + selo */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span
          className={cn(
            "text-[10px] font-semibold uppercase tracking-wide",
            selected ? "text-primary" : "text-muted-foreground",
          )}
        >
          {RELATION_LABEL[option.relation]}
        </span>
        {recommended && (
          <span className="shrink-0 text-[8px] font-bold uppercase tracking-wide text-primary bg-primary/15 border border-primary/25 rounded-full px-1.5 py-0.5">
            Sugerido
          </span>
        )}
      </div>

      <div
        className="font-display text-3xl font-bold text-white mt-1 leading-none notranslate"
        translate="no"
      >
        {option.bpm}
      </div>
      <div className="text-[10px] text-muted-foreground mt-1">
        Confiança{" "}
        <span
          className={cn(
            "font-semibold notranslate",
            confPct >= 80
              ? "text-green-300"
              : confPct >= 55
                ? "text-yellow-300"
                : "text-orange-300",
          )}
          translate="no"
        >
          {confPct}%
        </span>
      </div>

      {/* Ouvir com metrônomo */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onTogglePlay();
        }}
        className={cn(
          "mt-3 w-full flex items-center justify-center gap-1.5 px-1.5 py-2 rounded-xl text-[12px] font-semibold transition-all",
          playing
            ? "bg-primary text-primary-foreground"
            : "bg-secondary hover:bg-secondary/70 text-white border border-white/10",
        )}
      >
        {playing ? (
          <>
            <Pause className="w-3.5 h-3.5 shrink-0" /> Parar
          </>
        ) : (
          <>
            <Play className="w-3.5 h-3.5 shrink-0" /> Ouvir
          </>
        )}
      </button>
    </div>
  );
}

// Métrica compacta: rótulo em cima, valor embaixo (evita colisão em cartões estreitos)
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-muted-foreground leading-tight break-words">{label}</div>
      <div className="text-white/90 font-semibold leading-tight mt-0.5 notranslate" translate="no">
        {value}
      </div>
    </div>
  );
}
