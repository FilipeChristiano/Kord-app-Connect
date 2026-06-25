import { useCallback, useEffect, useRef, useState } from "react";

// ── Motor do metrônomo inteligente ────────────────────────────────────────────
// Núcleo compartilhado entre o Metrônomo e o Audio Lab: síntese do clique
// (oscilador) + agendador com lookahead (padrão Chris Wilson). Mantém o tempo
// preciso mesmo com a aba ocupada, agendando os próximos cliques à frente.

export type AccentLevel = "strong" | "medium" | "weak" | "muted";

export const ACCENT_CONFIG: Record<
  AccentLevel,
  { label: string; volume: number; freq: number; peak: number; duration: number }
> = {
  strong: { label: "Forte", volume: 1.0, freq: 1500, peak: 0.7, duration: 0.06 },
  medium: { label: "Médio", volume: 0.7, freq: 1050, peak: 0.49, duration: 0.05 },
  weak: { label: "Fraco", volume: 0.4, freq: 850, peak: 0.28, duration: 0.045 },
  muted: { label: "Mudo", volume: 0, freq: 0, peak: 0, duration: 0 },
};

const SCHEDULE_AHEAD = 0.1; // segundos
const LOOKAHEAD_MS = 25;

// ── Som do clique (oscilador sintetizado) ────────────────────────────────────
// Função compartilhada: agenda um clique no `time` (relógio do AudioContext),
// roteado por `destination` (permite um ganho mestre para controlar o volume).
function playClick(
  ctx: AudioContext,
  destination: AudioNode,
  time: number,
  kind: AccentLevel | "subdivision",
): void {
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
  gain.connect(destination);

  osc.start(time);
  osc.stop(time + duration + 0.02);
}

export interface MetronomeConfig {
  bpm: number;
  beatsPerBar: number;
  /** Ticks por tempo: 1 = sem subdivisão, 2 = colcheias, 4 = semicolcheias. */
  subdivisionMultiplier: number;
  /** Acentuação por tempo (índice 0 = tempo 1). */
  accents: AccentLevel[];
}

export interface UseMetronome {
  isPlaying: boolean;
  /** Tempo atual do compasso (0..beatsPerBar-1), sincronizado ao áudio. */
  currentBeat: number;
  start: () => Promise<void>;
  stop: () => void;
  toggle: () => void;
  /** Reinicia a contagem do compasso (sem parar), p/ trocas de compasso/preset. */
  resetBeat: () => void;
}

export function useMetronome(config: MetronomeConfig): UseMetronome {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(0);

  // ── Refs do agendador (Web Audio) ──────────────────────────────────────────
  const audioCtxRef = useRef<AudioContext | null>(null);
  const nextNoteTimeRef = useRef(0);
  const currentTickRef = useRef(0);
  const schedulerIdRef = useRef<number | null>(null);
  const beatQueueRef = useRef<{ tick: number; time: number }[]>([]);
  const rafIdRef = useRef<number | null>(null);
  const isRunningRef = useRef(false);

  // Configuração viva (lida dentro do agendador sem recriar o loop)
  const cfgRef = useRef(config);
  useEffect(() => {
    cfgRef.current = config;
  }, [config]);

  // ── Agendador com lookahead (padrão Chris Wilson) ──────────────────────────
  const scheduler = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    while (nextNoteTimeRef.current < ctx.currentTime + SCHEDULE_AHEAD) {
      const cfg = cfgRef.current;
      const mult = Math.max(1, cfg.subdivisionMultiplier);
      const beats = Math.max(1, cfg.beatsPerBar);
      const totalTicks = beats * mult;
      const tick = currentTickRef.current;
      const beatIndex = Math.floor(tick / mult);
      const isOnBeat = tick % mult === 0;

      if (isOnBeat) {
        const level = cfg.accents[beatIndex] ?? "weak";
        playClick(ctx, ctx.destination, nextNoteTimeRef.current, level);
        beatQueueRef.current.push({ tick: beatIndex, time: nextNoteTimeRef.current });
      } else {
        playClick(ctx, ctx.destination, nextNoteTimeRef.current, "subdivision");
      }

      // Avança o tempo: 1 tempo = 60/bpm; cada tick = (60/bpm) / mult
      const secondsPerTick = 60 / cfg.bpm / mult;
      nextNoteTimeRef.current += secondsPerTick;
      currentTickRef.current = (tick + 1) % totalTicks;
    }
  }, []);

  // ── Loop visual sincronizado com o áudio ───────────────────────────────────
  const visualLoop = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (ctx) {
      const now = ctx.currentTime;
      while (beatQueueRef.current.length > 0 && beatQueueRef.current[0].time <= now) {
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

  const toggle = useCallback(() => {
    if (isRunningRef.current) stop();
    else void start();
  }, [start, stop]);

  // Reinicia a contagem do compasso sem interromper a reprodução.
  const resetBeat = useCallback(() => {
    currentTickRef.current = 0;
    beatQueueRef.current = [];
    setCurrentBeat(0);
  }, []);

  // Limpeza ao desmontar
  useEffect(() => {
    return () => {
      if (schedulerIdRef.current !== null) window.clearInterval(schedulerIdRef.current);
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
      if (audioCtxRef.current) audioCtxRef.current.close().catch(() => {});
    };
  }, []);

  return { isPlaying, currentBeat, start, stop, toggle, resetBeat };
}

// ── Metrônomo sincronizado a uma fonte externa (ex.: faixa de áudio) ──────────
// Em vez de um transporte próprio, este motor agenda os cliques alinhados à
// posição de reprodução de outra faixa (o instrumental, na mesa de mistura).
// Assim o metrônomo fica "embutido" no áudio: toca junto, no tempo da música,
// com um ganho mestre próprio para controlar o volume do clique.

export interface SyncedMetronomeConfig {
  /** Posição atual da faixa-mestre, em segundos. */
  getPosition: () => number;
  bpm: number;
  beatsPerBar: number;
  /** Volume do clique (0..1). */
  volume: number;
}

export interface UseSyncedMetronome {
  currentBeat: number;
  start: () => Promise<void>;
  stop: () => void;
}

export function useSyncedMetronome(config: SyncedMetronomeConfig): UseSyncedMetronome {
  const [currentBeat, setCurrentBeat] = useState(0);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const schedulerIdRef = useRef<number | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const scheduledUntilRef = useRef(0);
  const beatQueueRef = useRef<{ beat: number; time: number }[]>([]);
  const runningRef = useRef(false);

  const cfgRef = useRef(config);
  useEffect(() => {
    cfgRef.current = config;
  }, [config]);

  // Volume do clique aplicado ao ganho mestre (transição suave, sem estalos).
  useEffect(() => {
    const g = masterGainRef.current;
    const ctx = audioCtxRef.current;
    if (g && ctx) g.gain.setTargetAtTime(Math.max(0, config.volume), ctx.currentTime, 0.01);
  }, [config.volume]);

  const scheduler = useCallback(() => {
    const ctx = audioCtxRef.current;
    const master = masterGainRef.current;
    if (!ctx || !master) return;

    const { getPosition, bpm, beatsPerBar } = cfgRef.current;
    if (!bpm || bpm <= 0) return;

    const secPerBeat = 60 / bpm;
    const beats = Math.max(1, beatsPerBar);
    const pos = getPosition();

    // Detecta saltos de posição (seek / troca de tempo) e re-sincroniza.
    if (pos < scheduledUntilRef.current - 0.5 || pos > scheduledUntilRef.current + 0.5) {
      scheduledUntilRef.current = pos;
    }

    const windowEnd = pos + SCHEDULE_AHEAD;
    const startTime = Math.max(scheduledUntilRef.current, pos);
    let n = Math.max(0, Math.ceil(startTime / secPerBeat - 1e-6));

    for (; n * secPerBeat < windowEnd; n++) {
      const beatSong = n * secPerBeat;
      const ctxTime = ctx.currentTime + (beatSong - pos);
      if (ctxTime < ctx.currentTime) continue;
      const beatInBar = ((n % beats) + beats) % beats;
      const level: AccentLevel = beatInBar === 0 ? "strong" : "weak";
      playClick(ctx, master, ctxTime, level);
      beatQueueRef.current.push({ beat: beatInBar, time: ctxTime });
    }

    scheduledUntilRef.current = windowEnd;
  }, []);

  const visualLoop = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (ctx) {
      const now = ctx.currentTime;
      while (beatQueueRef.current.length > 0 && beatQueueRef.current[0].time <= now) {
        const b = beatQueueRef.current.shift()!;
        setCurrentBeat(b.beat);
      }
    }
    rafIdRef.current = requestAnimationFrame(visualLoop);
  }, []);

  const stop = useCallback(() => {
    runningRef.current = false;
    if (schedulerIdRef.current !== null) {
      window.clearInterval(schedulerIdRef.current);
      schedulerIdRef.current = null;
    }
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    beatQueueRef.current = [];
    setCurrentBeat(0);
  }, []);

  const start = useCallback(async () => {
    if (runningRef.current) return;

    if (!audioCtxRef.current) {
      const Ctor: typeof AudioContext =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctor();
      const master = ctx.createGain();
      master.gain.setValueAtTime(Math.max(0, cfgRef.current.volume), ctx.currentTime);
      master.connect(ctx.destination);
      audioCtxRef.current = ctx;
      masterGainRef.current = master;
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === "suspended") await ctx.resume();

    runningRef.current = true;
    scheduledUntilRef.current = cfgRef.current.getPosition();
    beatQueueRef.current = [];
    schedulerIdRef.current = window.setInterval(scheduler, LOOKAHEAD_MS);
    rafIdRef.current = requestAnimationFrame(visualLoop);
  }, [scheduler, visualLoop]);

  useEffect(() => {
    return () => {
      if (schedulerIdRef.current !== null) window.clearInterval(schedulerIdRef.current);
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
      if (audioCtxRef.current) audioCtxRef.current.close().catch(() => {});
    };
  }, []);

  return { currentBeat, start, stop };
}
