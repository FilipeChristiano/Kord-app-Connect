import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Play,
  Pause,
  RotateCcw,
  Hand,
  Music2,
  Sparkles,
  Gauge,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import BpmDetector from "@/components/bpm-detector";

type TimeSignature = "2/4" | "3/4" | "4/4" | "6/8";
type Subdivision = "none" | "eighth" | "sixteenth";
type AccentLevel = "strong" | "medium" | "weak" | "muted";

const ACCENT_ORDER: AccentLevel[] = ["strong", "medium", "weak", "muted"];

const ACCENT_CONFIG: Record<AccentLevel, { label: string; volume: number; freq: number; peak: number; duration: number }> = {
  strong: { label: "Forte", volume: 1.0, freq: 1500, peak: 0.7, duration: 0.06 },
  medium: { label: "Médio", volume: 0.7, freq: 1050, peak: 0.49, duration: 0.05 },
  weak: { label: "Fraco", volume: 0.4, freq: 850, peak: 0.28, duration: 0.045 },
  muted: { label: "Mudo", volume: 0, freq: 0, peak: 0, duration: 0 },
};

interface Preset {
  id: string;
  name: string;
  bpm: number;
  range: string;
  timeSignature: TimeSignature;
  subdivision: Subdivision;
  accents: AccentLevel[];
  description: string;
  group: string;
}

// Atalhos para montar padrões de acentuação
const S: AccentLevel = "strong";
const M: AccentLevel = "medium";
const W: AccentLevel = "weak";

const PRESETS: Preset[] = [
  // Worship & Gospel
  { id: "adoracao-profunda", name: "Adoração Profunda", bpm: 68, range: "60–72", timeSignature: "4/4", subdivision: "eighth", accents: [S, W, M, W], description: "Momentos íntimos e contemplativos", group: "Worship & Gospel" },
  { id: "worship-moderno", name: "Worship Moderno", bpm: 74, range: "72–80", timeSignature: "4/4", subdivision: "eighth", accents: [S, W, M, W], description: "Pop worship contemporâneo", group: "Worship & Gospel" },
  { id: "worship-6-8", name: "Worship 6/8", bpm: 58, range: "55–68", timeSignature: "6/8", subdivision: "eighth", accents: [S, W, W, M, W, W], description: "Compasso composto, fluido", group: "Worship & Gospel" },
  { id: "balada-gospel", name: "Balada Gospel", bpm: 82, range: "76–90", timeSignature: "4/4", subdivision: "none", accents: [S, W, M, W], description: "Baladas clássicas do gospel", group: "Worship & Gospel" },
  { id: "pentecostal-moderado", name: "Pentecostal Moderado", bpm: 96, range: "90–105", timeSignature: "4/4", subdivision: "eighth", accents: [S, W, M, W], description: "Levada pentecostal padrão", group: "Worship & Gospel" },
  { id: "pentecostal-rapido", name: "Pentecostal Rápido", bpm: 126, range: "120–140", timeSignature: "4/4", subdivision: "sixteenth", accents: [S, W, M, W], description: "Avivamento e celebração", group: "Worship & Gospel" },
  { id: "valsa", name: "Valsa", bpm: 90, range: "80–110", timeSignature: "3/4", subdivision: "none", accents: [S, W, W], description: "Hinos antigos e valsas", group: "Worship & Gospel" },
  // Ritmos Brasileiros
  { id: "forro-pe-de-serra", name: "Forró Pé de Serra", bpm: 120, range: "110–135", timeSignature: "4/4", subdivision: "eighth", accents: [S, W, M, W], description: "Forró tradicional nordestino", group: "Ritmos Brasileiros" },
  { id: "xote", name: "Xote", bpm: 90, range: "80–100", timeSignature: "4/4", subdivision: "eighth", accents: [S, W, M, W], description: "Forró lento e dançante", group: "Ritmos Brasileiros" },
  { id: "baiao", name: "Baião", bpm: 120, range: "110–140", timeSignature: "2/4", subdivision: "eighth", accents: [S, M], description: "Ritmo nordestino marcado", group: "Ritmos Brasileiros" },
  { id: "frevo", name: "Frevo", bpm: 150, range: "140–180", timeSignature: "2/4", subdivision: "sixteenth", accents: [S, W], description: "Energia pernambucana acelerada", group: "Ritmos Brasileiros" },
  { id: "samba", name: "Samba", bpm: 100, range: "90–120", timeSignature: "2/4", subdivision: "sixteenth", accents: [S, W], description: "Suingue brasileiro", group: "Ritmos Brasileiros" },
  { id: "pagode", name: "Pagode", bpm: 92, range: "85–105", timeSignature: "4/4", subdivision: "eighth", accents: [S, W, M, W], description: "Samba de roda descontraído", group: "Ritmos Brasileiros" },
  { id: "bossa-nova", name: "Bossa Nova", bpm: 130, range: "120–145", timeSignature: "4/4", subdivision: "eighth", accents: [S, W, M, W], description: "Suingue suave e sofisticado", group: "Ritmos Brasileiros" },
  // Momentos do Culto
  { id: "oracao", name: "Oração", bpm: 60, range: "55–68", timeSignature: "4/4", subdivision: "eighth", accents: [S, W, M, W], description: "Fundo suave para orar", group: "Momentos do Culto" },
  { id: "ministracao", name: "Ministração", bpm: 66, range: "60–72", timeSignature: "4/4", subdivision: "eighth", accents: [S, W, M, W], description: "Base para ministração da Palavra", group: "Momentos do Culto" },
  { id: "espontaneo-worship", name: "Espontâneo Worship", bpm: 58, range: "55–68", timeSignature: "6/8", subdivision: "eighth", accents: [S, W, W, M, W, W], description: "Espontâneos com fluidez em 6/8", group: "Momentos do Culto" },
  { id: "fundo-de-pregacao", name: "Fundo de Pregação", bpm: 62, range: "55–70", timeSignature: "4/4", subdivision: "none", accents: [S, W, W, W], description: "Cama discreta para pregação", group: "Momentos do Culto" },
  { id: "encerramento", name: "Encerramento", bpm: 70, range: "65–78", timeSignature: "4/4", subdivision: "eighth", accents: [S, W, M, W], description: "Momento final do louvor", group: "Momentos do Culto" },
];

const PRESET_GROUPS = ["Worship & Gospel", "Ritmos Brasileiros", "Momentos do Culto"];

const ACCENT_STORAGE_KEY = "harmonic_metro_accents_v1";

function defaultAccents(ts: TimeSignature): AccentLevel[] {
  // Padrão: apenas o Tempo 1 forte, o restante fraco
  const beats = getBeatsPerBar(ts);
  return Array.from({ length: beats }, (_, i) => (i === 0 ? "strong" : "weak"));
}

function sanitizeAccents(value: unknown, ts: TimeSignature): AccentLevel[] {
  const expected = getBeatsPerBar(ts);
  if (
    Array.isArray(value) &&
    value.length === expected &&
    value.every((v) => ACCENT_ORDER.includes(v as AccentLevel))
  ) {
    return value as AccentLevel[];
  }
  return defaultAccents(ts);
}

function loadSavedAccents(): Partial<Record<TimeSignature, AccentLevel[]>> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(ACCENT_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Partial<Record<TimeSignature, AccentLevel[]>>;
  } catch {
    /* ignore */
  }
  return {};
}

const SUBDIVISION_LABELS: Record<Subdivision, string> = {
  none: "Sem subdivisão",
  eighth: "Colcheias",
  sixteenth: "Semicolcheias",
};

const SUBDIVISION_GLYPHS: Record<Subdivision, string> = {
  none: "♩",
  eighth: "♫",
  sixteenth: "♬",
};

const TIME_SIGNATURES: TimeSignature[] = ["2/4", "3/4", "4/4", "6/8"];
const SUBDIVISIONS: Subdivision[] = ["none", "eighth", "sixteenth"];

// ── Geometria do seletor circular de BPM ──────────────────────────────────────
const DIAL_CENTER = 120; // centro do viewBox 240x240
const DIAL_RADIUS = 104; // raio da trilha
const GAUGE_START = 135; // ângulo inicial (graus) — canto inferior esquerdo
const GAUGE_SWEEP = 270; // varredura total (lacuna de 90° embaixo)

const dialPolar = (r: number, deg: number): [number, number] => {
  const a = (deg * Math.PI) / 180;
  return [DIAL_CENTER + r * Math.cos(a), DIAL_CENTER + r * Math.sin(a)];
};

const dialArc = (r: number, a0: number, a1: number): string => {
  const [x0, y0] = dialPolar(r, a0);
  const [x1, y1] = dialPolar(r, a1);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
};

const DEFAULT_BPM = 90;
const MIN_BPM = 40;
const MAX_BPM = 240;

function getBeatsPerBar(ts: TimeSignature): number {
  if (ts === "2/4") return 2;
  if (ts === "3/4") return 3;
  if (ts === "6/8") return 6;
  return 4;
}

function getSubdivisionMultiplier(sub: Subdivision, ts: TimeSignature): number {
  if (ts === "6/8") {
    // Em 6/8 cada "tempo" já é uma colcheia — então colcheia = 1x, semicolcheia = 2x.
    if (sub === "sixteenth") return 2;
    return 1;
  }
  if (sub === "sixteenth") return 4;
  if (sub === "eighth") return 2;
  return 1;
}

export default function Metronome() {
  const [bpm, setBpm] = useState(DEFAULT_BPM);
  const [bpmInput, setBpmInput] = useState(String(DEFAULT_BPM));
  const [timeSignature, setTimeSignature] = useState<TimeSignature>("4/4");
  const [subdivision, setSubdivision] = useState<Subdivision>("none");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(0);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [accentPattern, setAccentPattern] = useState<AccentLevel[]>(() => {
    const saved = loadSavedAccents();
    return sanitizeAccents(saved["4/4"], "4/4");
  });

  const beatsPerBar = getBeatsPerBar(timeSignature);

  // ── Refs para o scheduler (Web Audio) ──────────────────────────────────────
  const audioCtxRef = useRef<AudioContext | null>(null);
  const nextNoteTimeRef = useRef(0);
  const currentTickRef = useRef(0);
  const schedulerIdRef = useRef<number | null>(null);
  const bpmRef = useRef(bpm);
  const timeSignatureRef = useRef(timeSignature);
  const subdivisionRef = useRef(subdivision);
  const accentPatternRef = useRef<AccentLevel[]>([]);
  const beatQueueRef = useRef<{ tick: number; time: number }[]>([]);
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => { bpmRef.current = bpm; }, [bpm]);
  useEffect(() => { timeSignatureRef.current = timeSignature; }, [timeSignature]);
  useEffect(() => { subdivisionRef.current = subdivision; }, [subdivision]);
  useEffect(() => { accentPatternRef.current = accentPattern; }, [accentPattern]);

  // Salva o padrão de acentuação por compasso (persistência local)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = loadSavedAccents();
      saved[timeSignature] = accentPattern;
      window.localStorage.setItem(ACCENT_STORAGE_KEY, JSON.stringify(saved));
    } catch {
      /* ignore */
    }
  }, [accentPattern, timeSignature]);

  // ── Som do clique (oscilador sintetizado) ──────────────────────────────────
  const playClick = useCallback((time: number, kind: AccentLevel | "subdivision") => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    let freq = 600;
    let peak = 0.16;
    let duration = 0.025;

    if (kind === "subdivision") {
      freq = 600;
      peak = 0.16;
      duration = 0.025;
    } else {
      const cfg = ACCENT_CONFIG[kind];
      if (cfg.peak <= 0) return; // "Mudo" — não emite som
      freq = cfg.freq;
      peak = cfg.peak;
      duration = cfg.duration;
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, time);

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(peak, time + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(time);
    osc.stop(time + duration + 0.02);
  }, []);

  // ── Scheduler com lookahead (padrão Chris Wilson) ──────────────────────────
  const SCHEDULE_AHEAD = 0.1; // segundos
  const LOOKAHEAD_MS = 25;

  const scheduler = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    while (nextNoteTimeRef.current < ctx.currentTime + SCHEDULE_AHEAD) {
      const ts = timeSignatureRef.current;
      const sub = subdivisionRef.current;
      const mult = getSubdivisionMultiplier(sub, ts);
      const beats = getBeatsPerBar(ts);
      const totalTicks = beats * mult;
      const tick = currentTickRef.current;
      const beatIndex = Math.floor(tick / mult);
      const isOnBeat = tick % mult === 0;

      if (isOnBeat) {
        const pattern = accentPatternRef.current;
        const level = pattern[beatIndex] ?? "weak";
        playClick(nextNoteTimeRef.current, level);
        beatQueueRef.current.push({ tick: beatIndex, time: nextNoteTimeRef.current });
      } else {
        playClick(nextNoteTimeRef.current, "subdivision");
      }

      // Avança o tempo: 1 beat = 60/bpm; cada tick = (60/bpm) / mult
      const secondsPerTick = 60 / bpmRef.current / mult;
      nextNoteTimeRef.current += secondsPerTick;
      currentTickRef.current = (tick + 1) % totalTicks;
    }
  }, [playClick]);

  // ── Loop visual sincronizado com o áudio ───────────────────────────────────
  const visualLoop = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (ctx) {
      const now = ctx.currentTime;
      while (
        beatQueueRef.current.length > 0 &&
        beatQueueRef.current[0].time <= now
      ) {
        const beat = beatQueueRef.current.shift()!;
        setCurrentBeat(beat.tick);
      }
    }
    rafIdRef.current = requestAnimationFrame(visualLoop);
  }, []);

  // ── Start / Stop ───────────────────────────────────────────────────────────
  const stop = useCallback(() => {
    if (schedulerIdRef.current !== null) {
      window.clearInterval(schedulerIdRef.current);
      schedulerIdRef.current = null;
    }
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    beatQueueRef.current = [];
    currentTickRef.current = 0;
    setCurrentBeat(0);
    setIsPlaying(false);
    isRunningRef.current = false;
  }, []);

  const isRunningRef = useRef(false);

  const start = useCallback(async () => {
    if (isRunningRef.current) return;
    isRunningRef.current = true;

    // Defensive: limpa qualquer loop órfão antes de iniciar
    if (schedulerIdRef.current !== null) {
      window.clearInterval(schedulerIdRef.current);
      schedulerIdRef.current = null;
    }
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    if (!audioCtxRef.current) {
      const Ctor: typeof AudioContext =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtxRef.current = new Ctor();
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === "suspended") {
      await ctx.resume();
    }
    currentTickRef.current = 0;
    beatQueueRef.current = [];
    nextNoteTimeRef.current = ctx.currentTime + 0.05;
    setIsPlaying(true);
    schedulerIdRef.current = window.setInterval(scheduler, LOOKAHEAD_MS);
    rafIdRef.current = requestAnimationFrame(visualLoop);
  }, [scheduler, visualLoop]);

  const togglePlay = useCallback(() => {
    if (isPlaying) stop();
    else start();
  }, [isPlaying, start, stop]);

  useEffect(() => {
    return () => {
      if (schedulerIdRef.current !== null) window.clearInterval(schedulerIdRef.current);
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
      if (audioCtxRef.current) audioCtxRef.current.close().catch(() => {});
    };
  }, []);

  // Atalho: tecla espaço dá play/pause
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay]);

  // ── BPM helpers ────────────────────────────────────────────────────────────
  const setBpmClamped = useCallback((value: number) => {
    const next = Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(value)));
    setBpm(next);
    setBpmInput(String(next));
  }, []);

  // ── Seletor circular (arrastar para mudar BPM) ──────────────────────────────
  const dialRef = useRef<SVGSVGElement | null>(null);
  const [isDraggingBpm, setIsDraggingBpm] = useState(false);

  // Seções colapsáveis da coluna lateral
  const [stylesOpen, setStylesOpen] = useState(false);
  const [detectOpen, setDetectOpen] = useState(false);

  const bpmFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const svg = dialRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const deg = (Math.atan2(clientY - cy, clientX - cx) * 180) / Math.PI;
      const a = (deg + 360) % 360;
      const rel = (a - GAUGE_START + 360) % 360; // 0..360
      let t: number;
      if (rel > GAUGE_SWEEP) {
        // ponteiro caiu na lacuna inferior: prende na ponta mais próxima
        t = rel - GAUGE_SWEEP < (360 - GAUGE_SWEEP) / 2 ? 1 : 0;
      } else {
        t = rel / GAUGE_SWEEP;
      }
      setBpmClamped(MIN_BPM + t * (MAX_BPM - MIN_BPM));
    },
    [setBpmClamped],
  );

  const handleDialPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    setIsDraggingBpm(true);
    bpmFromPointer(e.clientX, e.clientY);
  };
  const handleDialPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingBpm) return;
    bpmFromPointer(e.clientX, e.clientY);
  };
  const handleDialPointerUp = (e: React.PointerEvent) => {
    setIsDraggingBpm(false);
    try {
      (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const bpmFraction = (bpm - MIN_BPM) / (MAX_BPM - MIN_BPM);
  const [dialHandleX, dialHandleY] = dialPolar(
    DIAL_RADIUS,
    GAUGE_START + bpmFraction * GAUGE_SWEEP,
  );

  const handleBpmInputBlur = () => {
    const parsed = parseInt(bpmInput, 10);
    if (Number.isFinite(parsed)) setBpmClamped(parsed);
    else setBpmInput(String(bpm));
  };

  const resetBpm = () => {
    setBpmClamped(DEFAULT_BPM);
    setActivePresetId(null);
    setAccentPattern(defaultAccents(timeSignature));
  };

  // ── Tap Tempo ──────────────────────────────────────────────────────────────
  const tapsRef = useRef<number[]>([]);
  const handleTap = () => {
    const now = performance.now();
    const taps = tapsRef.current;
    // Reset se passou mais de 2s
    if (taps.length && now - taps[taps.length - 1] > 2000) {
      tapsRef.current = [];
    }
    tapsRef.current.push(now);
    if (tapsRef.current.length > 6) tapsRef.current.shift();
    if (tapsRef.current.length >= 2) {
      const arr = tapsRef.current;
      const intervals: number[] = [];
      for (let i = 1; i < arr.length; i++) intervals.push(arr[i] - arr[i - 1]);
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const computed = 60000 / avg;
      setBpmClamped(computed);
    }
  };

  // ── Presets ────────────────────────────────────────────────────────────────
  const applyPreset = (preset: Preset) => {
    setActivePresetId(preset.id);
    setBpm(preset.bpm);
    setBpmInput(String(preset.bpm));
    setTimeSignature(preset.timeSignature);
    setSubdivision(preset.subdivision);
    setAccentPattern(sanitizeAccents(preset.accents, preset.timeSignature));
    currentTickRef.current = 0;
    setCurrentBeat(0);
  };

  // Se mudar o compasso, carrega o padrão de acentuação salvo (ou o padrão comum)
  const handleTimeSignatureChange = (ts: TimeSignature) => {
    if (ts === timeSignature) return;
    setTimeSignature(ts);
    const saved = loadSavedAccents();
    setAccentPattern(sanitizeAccents(saved[ts], ts));
    currentTickRef.current = 0;
    setCurrentBeat(0);
  };

  // ── Editor de acentuação ─────────────────────────────────────────────────────
  const cycleAccent = (index: number) => {
    setAccentPattern((prev) => {
      const next = [...prev];
      const currentIdx = ACCENT_ORDER.indexOf(prev[index] ?? "weak");
      next[index] = ACCENT_ORDER[(currentIdx + 1) % ACCENT_ORDER.length];
      return next;
    });
  };

  const handleSubdivisionChange = (sub: Subdivision) => {
    setSubdivision(sub);
    currentTickRef.current = 0;
  };

  // Aplica o BPM (e compasso, se detectado) vindo do detector de BPM
  const handleDetectedBpm = (detectedBpm: number, ts: "3/4" | "4/4" | null) => {
    setActivePresetId(null);
    setBpmClamped(detectedBpm);
    if (ts && ts !== timeSignature) {
      setTimeSignature(ts);
      const saved = loadSavedAccents();
      setAccentPattern(sanitizeAccents(saved[ts], ts));
      currentTickRef.current = 0;
      setCurrentBeat(0);
    }
  };

  const activePreset = useMemo(
    () => PRESETS.find((p) => p.id === activePresetId) ?? null,
    [activePresetId],
  );

  // "ajustado" é derivado: verdadeiro quando o estado atual diverge do estilo ativo
  const presetAdjusted = useMemo(() => {
    if (!activePreset) return false;
    if (activePreset.bpm !== bpm) return true;
    if (activePreset.timeSignature !== timeSignature) return true;
    if (activePreset.subdivision !== subdivision) return true;
    if (JSON.stringify(activePreset.accents) !== JSON.stringify(accentPattern)) return true;
    return false;
  }, [activePreset, bpm, timeSignature, subdivision, accentPattern]);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
      {/* Header */}
      <div className="mb-8 text-center lg:text-left">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold mb-4 uppercase tracking-wider">
          <Music2 className="w-3.5 h-3.5" /> Ferramenta de Estudo
        </div>
        <h1 className="font-display text-4xl md:text-5xl font-bold text-white mb-3">
          Metrônomo Inteligente
        </h1>
        <p className="text-muted-foreground max-w-2xl lg:mx-0 mx-auto">
          Pratique no tempo certo com presets pensados para worship, gospel e estudo de teclado.
        </p>
      </div>

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6">
        {/* ── Painel principal ──────────────────────────────────────────────── */}
        <div className="glass-card rounded-3xl p-6 sm:p-10 border border-white/10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />

          {/* Preset ativo */}
          {activePreset && (
            <div className="mb-6 flex flex-col items-center gap-2 text-center">
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <span className="text-xs uppercase tracking-widest text-primary/70 font-semibold">Estilo ativo</span>
                <span className="text-sm font-bold text-white">{activePreset.name}</span>
                {presetAdjusted && (
                  <span className="text-[10px] uppercase tracking-wider bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded-full border border-orange-500/30">
                    ajustado
                  </span>
                )}
              </div>
              <div className="flex items-center justify-center gap-2 flex-wrap text-[11px] text-muted-foreground">
                <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 notranslate" translate="no">{activePreset.timeSignature}</span>
                <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10">{SUBDIVISION_LABELS[activePreset.subdivision]}</span>
                <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 notranslate" translate="no">{activePreset.range} BPM</span>
              </div>
            </div>
          )}

          {/* Pulso visual + BPM */}
          <div className="relative flex flex-col items-center justify-center py-6">
            <div className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center">
              {/* Círculos pulsantes */}
              <motion.div
                key={`pulse-${currentBeat}-${isPlaying}`}
                initial={{ scale: 0.78, opacity: 0.6 }}
                animate={isPlaying ? { scale: 1.05, opacity: 0 } : { scale: 0.78, opacity: 0 }}
                transition={{ duration: Math.min(0.6, 60 / bpm * 0.8) }}
                className={cn(
                  "absolute inset-8 rounded-full border-2",
                  currentBeat === 0 ? "border-primary" : "border-primary/40",
                )}
              />
              <div className={cn(
                "absolute inset-10 rounded-full transition-colors duration-100",
                isPlaying && currentBeat === 0 ? "bg-primary/15" : isPlaying ? "bg-white/5" : "bg-transparent",
              )} />

              {/* Seletor circular (arrastável) */}
              <svg
                ref={dialRef}
                viewBox="0 0 240 240"
                className="absolute inset-0 w-full h-full"
                style={{ overflow: "visible", touchAction: "none" }}
              >
                {/* Trilha de fundo */}
                <path
                  d={dialArc(DIAL_RADIUS, GAUGE_START, GAUGE_START + GAUGE_SWEEP)}
                  fill="none"
                  stroke="hsl(0 0% 100% / 0.08)"
                  strokeWidth={6}
                  strokeLinecap="round"
                />
                {/* Progresso (laranja) */}
                {bpmFraction > 0.001 && (
                  <path
                    d={dialArc(DIAL_RADIUS, GAUGE_START, GAUGE_START + bpmFraction * GAUGE_SWEEP)}
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth={6}
                    strokeLinecap="round"
                  />
                )}
                {/* Área de toque invisível sobre a trilha */}
                <path
                  d={dialArc(DIAL_RADIUS, GAUGE_START, GAUGE_START + GAUGE_SWEEP)}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={30}
                  strokeLinecap="round"
                  style={{ cursor: "grab", pointerEvents: "stroke" }}
                  onPointerDown={handleDialPointerDown}
                  onPointerMove={handleDialPointerMove}
                  onPointerUp={handleDialPointerUp}
                  onPointerCancel={handleDialPointerUp}
                />
                {/* Marcador */}
                <g
                  style={{ cursor: isDraggingBpm ? "grabbing" : "grab", pointerEvents: "all" }}
                  onPointerDown={handleDialPointerDown}
                  onPointerMove={handleDialPointerMove}
                  onPointerUp={handleDialPointerUp}
                  onPointerCancel={handleDialPointerUp}
                >
                  <circle cx={dialHandleX} cy={dialHandleY} r={16} fill="hsl(var(--primary) / 0.18)" />
                  <circle
                    cx={dialHandleX}
                    cy={dialHandleY}
                    r={9}
                    fill="hsl(var(--primary))"
                    stroke="hsl(var(--background))"
                    strokeWidth={3}
                    className={cn("transition-transform", isDraggingBpm && "scale-110")}
                    style={{ transformOrigin: `${dialHandleX}px ${dialHandleY}px` } as React.CSSProperties}
                  />
                </g>
              </svg>

              {/* Núcleo com BPM */}
              <div className="relative z-10 text-center pointer-events-none">
                <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">BPM</div>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={bpmInput}
                  onChange={(e) => setBpmInput(e.target.value.replace(/[^0-9]/g, ""))}
                  onBlur={handleBpmInputBlur}
                  onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
                  className={`font-display font-bold text-white bg-transparent text-center w-44 leading-none outline-none focus:text-primary transition-colors notranslate pointer-events-auto ${
                    bpmInput.length >= 3 ? "text-5xl sm:text-6xl" : "text-6xl sm:text-7xl"
                  }`}
                  translate="no"
                  aria-label="BPM"
                />
                <div className="text-xs text-muted-foreground mt-1 notranslate" translate="no">{MIN_BPM} – {MAX_BPM}</div>
              </div>
            </div>

            {/* Editor de acentuação (bolinhas clicáveis) */}
            <div className="mt-8 w-full max-w-md">
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
                  Acentuação
                </span>
                <span className="text-sm font-mono text-muted-foreground notranslate" translate="no">
                  {isPlaying ? currentBeat + 1 : 1} / {beatsPerBar}
                </span>
              </div>

              <div className="flex items-end justify-center gap-2 flex-wrap">
                {accentPattern.map((level, i) => {
                  const cfg = ACCENT_CONFIG[level];
                  const isFlashing = isPlaying && currentBeat === i;
                  return (
                    <button
                      key={i}
                      onClick={() => cycleAccent(i)}
                      className="group flex flex-col items-center gap-1.5 focus:outline-none"
                      aria-label={`Tempo ${i + 1}: ${cfg.label}. Toque para mudar a acentuação.`}
                    >
                      <span
                        className={cn(
                          "rounded-full border transition-all duration-100",
                          level === "strong" && "w-5 h-5 bg-primary border-primary",
                          level === "medium" && "w-[18px] h-[18px] bg-amber-400 border-amber-400",
                          level === "weak" && "w-4 h-4 bg-white/25 border-white/30",
                          level === "muted" && "w-3.5 h-3.5 bg-transparent border-white/15",
                          isFlashing && level === "strong" && "scale-125 shadow-md shadow-primary/50 ring-1 ring-primary/40",
                          isFlashing && level === "medium" && "scale-125 shadow-md shadow-amber-400/50 ring-1 ring-amber-300/40",
                          isFlashing && level === "weak" && "scale-110 shadow-sm shadow-white/30",
                          isFlashing && level === "muted" && "scale-110 border-white/40",
                          "group-hover:brightness-110 group-active:scale-95",
                        )}
                      />
                      <span className="text-[10px] font-mono text-muted-foreground/60 notranslate" translate="no">
                        {i + 1}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Legenda dos estados */}
              <div className="flex items-center justify-center gap-3 sm:gap-4 flex-wrap mt-5 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-primary" /> Forte
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-amber-400" /> Médio
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-white/25" /> Fraco
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full border border-white/20 bg-transparent" /> Mudo
                </span>
              </div>
              <p className="text-center text-[11px] text-muted-foreground/60 mt-2">
                Toque nas bolinhas para definir a acentuação de cada tempo.
              </p>
            </div>
          </div>

          {/* Play / Tap / Reset */}
          <div className="flex items-stretch justify-center gap-2 sm:gap-3 mt-8">
            <button
              onClick={togglePlay}
              className={cn(
                "flex flex-1 sm:flex-none min-w-0 items-center justify-center gap-1.5 sm:gap-3 px-3 sm:px-8 py-3.5 sm:py-4 rounded-2xl font-bold text-sm sm:text-lg transition-all duration-300 shadow-lg",
                isPlaying
                  ? "bg-white text-background hover:bg-white/90 shadow-white/20"
                  : "bg-primary text-primary-foreground hover:bg-orange-400 shadow-primary/30 hover:shadow-primary/50 hover:-translate-y-0.5",
              )}
              aria-label={isPlaying ? "Pausar" : "Tocar"}
            >
              {isPlaying ? <Pause className="w-5 h-5 sm:w-6 sm:h-6 fill-current" /> : <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-current" />}
              {isPlaying ? "Pausar" : "Tocar"}
            </button>
            <button
              onClick={handleTap}
              className="flex flex-1 sm:flex-none min-w-0 items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-3.5 sm:py-4 rounded-2xl font-semibold text-sm sm:text-base text-white bg-secondary hover:bg-secondary/80 border border-white/10 transition-all"
              aria-label="Tap Tempo"
            >
              <Hand className="w-5 h-5" />
              Tap
            </button>
            <button
              onClick={resetBpm}
              className="flex flex-1 sm:flex-none min-w-0 items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-3.5 sm:py-4 rounded-2xl font-semibold text-sm sm:text-base text-muted-foreground hover:text-white bg-secondary/50 hover:bg-secondary border border-white/5 hover:border-white/10 transition-all"
              aria-label="Reset"
            >
              <RotateCcw className="w-5 h-5" />
              Reset
            </button>
          </div>

          {/* Time Signature + Subdivisão */}
          <div className="grid sm:grid-cols-2 gap-6 mt-6">
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">Compasso</div>
              <div className="flex gap-2">
                {TIME_SIGNATURES.map((ts) => (
                  <button
                    key={ts}
                    onClick={() => handleTimeSignatureChange(ts)}
                    aria-pressed={timeSignature === ts}
                    className={cn(
                      "flex-1 py-3 rounded-xl font-bold transition-all border notranslate",
                      timeSignature === ts
                        ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
                        : "bg-secondary/50 text-muted-foreground border-white/5 hover:border-white/20 hover:text-white",
                    )}
                    translate="no"
                  >
                    {ts}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">Subdivisão</div>
              <div className="flex gap-2">
                {SUBDIVISIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSubdivisionChange(s)}
                    aria-pressed={subdivision === s}
                    aria-label={SUBDIVISION_LABELS[s]}
                    title={SUBDIVISION_LABELS[s]}
                    className={cn(
                      "flex-1 py-3 rounded-xl text-xl leading-none font-bold transition-all border notranslate",
                      subdivision === s
                        ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
                        : "bg-secondary/50 text-muted-foreground border-white/5 hover:border-white/20 hover:text-white",
                    )}
                    translate="no"
                  >
                    {SUBDIVISION_GLYPHS[s]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground/70 text-center mt-6">
            Dica: pressione <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white/80 font-mono text-[10px]">espaço</kbd> para tocar/pausar.
          </p>
        </div>

        {/* ── Coluna lateral ─────────────────────────────────────────────── */}
        <div className="space-y-6">
        {/* Detectar BPM (abre gravar/subir áudio ao clicar) */}
        {!detectOpen ? (
          <div className="glass-card rounded-3xl p-6 border border-white/10">
            <button
              type="button"
              onClick={() => setDetectOpen(true)}
              className="w-full flex items-center gap-3 text-left group"
            >
              <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                <Gauge className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-display text-xl font-bold text-white">Detectar BPM</div>
                <div className="text-xs text-muted-foreground">
                  Grave ou suba um áudio para descobrir o tempo
                </div>
              </div>
              <ChevronDown className="w-5 h-5 text-muted-foreground -rotate-90 transition-transform group-hover:translate-x-0.5 shrink-0" />
            </button>
          </div>
        ) : (
          <BpmDetector onApply={handleDetectedBpm} />
        )}
        {/* Estilos (minimizável) */}
        <div className="glass-card rounded-3xl p-6 border border-white/10">
          <button
            type="button"
            onClick={() => setStylesOpen((v) => !v)}
            aria-expanded={stylesOpen}
            className="w-full flex items-center gap-2 text-left"
          >
            <Sparkles className="w-5 h-5 text-primary shrink-0" />
            <span className="font-display text-xl font-bold text-white flex-1">Estilos</span>
            <ChevronDown
              className={cn(
                "w-5 h-5 text-muted-foreground transition-transform",
                stylesOpen && "rotate-180",
              )}
            />
          </button>
          {stylesOpen && (
          <>
          <p className="text-xs text-muted-foreground mt-3 mb-5">
            Escolha um estilo e o BPM, compasso e subdivisão se ajustam automaticamente.
          </p>
          <div className="space-y-5 lg:max-h-[420px] lg:overflow-y-auto lg:pr-1 metro-scroll">
            {PRESET_GROUPS.map((group) => (
              <div key={group}>
                <div className="text-[11px] uppercase tracking-widest text-primary/70 font-semibold mb-2 px-1">
                  {group}
                </div>
                <div className="space-y-2">
                  {PRESETS.filter((p) => p.group === group).map((preset) => {
                    const isActive = activePresetId === preset.id;
                    return (
                      <button
                        key={preset.id}
                        onClick={() => applyPreset(preset)}
                        aria-pressed={isActive}
                        className={cn(
                          "w-full text-left p-4 rounded-xl border transition-all duration-200 group",
                          isActive
                            ? "bg-primary/15 border-primary/50 shadow-md shadow-primary/10"
                            : "bg-secondary/30 border-white/5 hover:bg-secondary/50 hover:border-white/15",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className={cn(
                              "font-bold mb-0.5 transition-colors",
                              isActive ? "text-white" : "text-white/90 group-hover:text-white",
                            )}>
                              {preset.name}
                            </div>
                            <div className="text-xs text-muted-foreground line-clamp-1">{preset.description}</div>
                            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                              <span className="text-[10px] text-muted-foreground/90 px-1.5 py-0.5 rounded bg-white/5 border border-white/10 notranslate" translate="no">
                                {preset.timeSignature}
                              </span>
                              <span className="text-[10px] text-muted-foreground/90 px-1.5 py-0.5 rounded bg-white/5 border border-white/10">
                                {SUBDIVISION_LABELS[preset.subdivision]}
                              </span>
                              <span className="text-[10px] text-muted-foreground/90 px-1.5 py-0.5 rounded bg-white/5 border border-white/10 notranslate" translate="no">
                                {preset.range}
                              </span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className={cn(
                              "font-display font-bold text-lg notranslate",
                              isActive ? "text-primary" : "text-white/80",
                            )} translate="no">
                              {preset.bpm}
                            </div>
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                              bpm
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          </>
          )}
        </div>
        </div>
      </div>

      <style>{`
        .metro-scroll::-webkit-scrollbar { width: 6px; }
        .metro-scroll::-webkit-scrollbar-track { background: transparent; }
        .metro-scroll::-webkit-scrollbar-thumb {
          background: hsl(0 0% 100% / 0.1);
          border-radius: 9999px;
        }
        .metro-scroll::-webkit-scrollbar-thumb:hover {
          background: hsl(var(--primary) / 0.4);
        }
        .metro-scroll { scrollbar-width: thin; scrollbar-color: hsl(0 0% 100% / 0.15) transparent; }
      `}</style>
    </div>
  );
}
