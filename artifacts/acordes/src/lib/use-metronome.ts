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
  /**
   * Fase da grade: posição (s) da batida 0 no tempo da música. As batidas caem
   * em `beatOffsetSec + n·(60/bpm)`. Sem isso, o clique fica deslocado por um
   * erro constante (a batida 1 quase nunca cai em t=0; há introdução antes).
   */
  beatOffsetSec: number;
  /**
   * Compensação de latência (s) entre o áudio em streaming (elemento <audio>) e
   * o relógio do Web Audio que toca o clique. Os dois caminhos de saída têm
   * latências um pouco diferentes, então o clique tende a soar levemente à
   * FRENTE da música. Um valor POSITIVO atrasa o clique para colá-lo na música.
   * É uma calibração por dispositivo (a latência varia entre aparelhos).
   */
  syncOffsetSec: number;
  /**
   * Lista de INSTANTES (s, no tempo da música) de cada batida detectada por
   * rastreamento profissional (beat tracking) no servidor. Quando presente, o
   * clique cai EXATAMENTE em cada batida real da música — em vez de uma grade
   * rígida (bpm + fase) estimada. É o que mantém o clique colado mesmo com
   * pequenas variações de andamento. Deve estar ordenada. Sem ela (ou com menos
   * de 2 batidas), o motor volta para a grade baseada no BPM.
   */
  beatTimes?: number[];
  /** Volume do clique (0..1). */
  volume: number;
}

export interface UseSyncedMetronome {
  currentBeat: number;
  start: () => Promise<void>;
  stop: () => void;
}

// Quanto agendamos à frente, no relógio do AudioContext. Uma janela larga deixa
// o metrônomo imune a travadas da thread principal (ex.: arrastar um fader):
// mesmo que o agendador atrase, as batidas já foram marcadas no relógio de áudio.
const SYNCED_SCHEDULE_AHEAD = 0.25; // segundos
// Acima deste desvio entre a posição real da música e a prevista pela âncora,
// reancoramos suavemente (mantendo a contagem) para colar de volta no tempo.
const DRIFT_CORRECTION = 0.045; // segundos
// Acima deste salto, tratamos como seek/pausa: reancoramos e recontamos do zero.
const SEEK_JUMP = 0.4; // segundos

export function useSyncedMetronome(config: SyncedMetronomeConfig): UseSyncedMetronome {
  const [currentBeat, setCurrentBeat] = useState(0);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const schedulerIdRef = useRef<number | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const beatQueueRef = useRef<{ beat: number; time: number }[]>([]);
  const runningRef = useRef(false);

  // Âncora: mapeamento estável entre a posição da música (s) e o relógio do
  // AudioContext (s). Todas as batidas derivam DAÍ — não da posição "ao vivo"
  // (que tem jitter) lida a cada tique. Só reancoramos quando há desvio real.
  const anchorSongRef = useRef(0);
  const anchorCtxRef = useRef(0);
  const nextBeatRef = useRef(0); // índice absoluto da próxima batida a agendar
  const secPerBeatRef = useRef(0);
  const beatOffsetRef = useRef(0); // fase corrente da grade (s)
  const syncOffsetRef = useRef(0); // compensação de latência corrente (s)
  // Lista de batidas corrente (modo "mapa de batidas"). null = grade por BPM.
  const beatTimesRef = useRef<number[] | null>(null);
  // Após reancorar (mudança de BPM/fase/calibração ou seek), as batidas já
  // agendadas na janela de lookahead continuam tocando (não dá p/ cancelá-las
  // sem estalo). Seguramos o agendamento das NOVAS batidas até este instante do
  // relógio para não sobrepor cliques (evita "duplo"/flam ao calibrar ao vivo).
  const holdUntilRef = useRef(0);

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

  // (Re)ancora o mapeamento música↔AudioContext na posição informada. A próxima
  // batida respeita a fase: as batidas caem em `offset + n·secPerBeat`.
  const anchorAt = useCallback(
    (songPos: number, ctxNow: number, secPerBeat: number, offset: number, beatTimes?: number[] | null) => {
      anchorSongRef.current = songPos;
      anchorCtxRef.current = ctxNow;
      if (beatTimes && beatTimes.length >= 2) {
        // Modo mapa de batidas: próxima batida = primeira cujo instante é >= à
        // posição atual da música (busca binária na lista ordenada).
        let lo = 0;
        let hi = beatTimes.length;
        while (lo < hi) {
          const mid = (lo + hi) >> 1;
          if (beatTimes[mid] < songPos) lo = mid + 1;
          else hi = mid;
        }
        nextBeatRef.current = lo;
      } else {
        nextBeatRef.current = Math.ceil((songPos - offset) / secPerBeat - 1e-6);
      }
    },
    [],
  );

  const scheduler = useCallback(() => {
    const ctx = audioCtxRef.current;
    const master = masterGainRef.current;
    if (!ctx || !master) return;

    const { getPosition, bpm, beatsPerBar, beatOffsetSec, syncOffsetSec, beatTimes } = cfgRef.current;
    // Modo "mapa de batidas": clicamos nos instantes reais detectados (estilo
    // profissional). Sem lista válida, voltamos para a grade baseada no BPM.
    const map = Array.isArray(beatTimes) && beatTimes.length >= 2 ? beatTimes : null;
    if (!map && (!bpm || bpm <= 0)) return;

    const secPerBeat = bpm > 0 ? 60 / bpm : 0;
    const offset = Number.isFinite(beatOffsetSec) ? beatOffsetSec : 0;
    const syncOffset = Number.isFinite(syncOffsetSec) ? syncOffsetSec : 0;
    const beats = Math.max(1, beatsPerBar);
    const ctxNow = ctx.currentTime;
    const actualSong = getPosition();

    // A música ainda não começou de fato (buffering pós-play): a posição fica
    // colada em ~0 por alguns instantes. Se agendássemos agora, sairia um clique
    // prematuro seguido de um vão até a música entrar ("primeiro clique + espaço").
    // Mantemos a âncora colada no zero e só começamos a agendar quando a posição
    // realmente avança — aí a contagem entra já alinhada.
    if (actualSong <= 0.01) {
      secPerBeatRef.current = secPerBeat;
      beatOffsetRef.current = offset;
      syncOffsetRef.current = syncOffset;
      beatTimesRef.current = map;
      anchorAt(actualSong, ctxNow, secPerBeat, offset, map);
      beatQueueRef.current = [];
      return;
    }

    // Se a FONTE da grade mudou (lista de batidas, BPM, fase ou calibração), a
    // contagem perde o sentido (ou as batidas já agendadas ficariam fora): reancora.
    const beatTimesChanged = map !== beatTimesRef.current;
    const gridChanged = secPerBeat !== secPerBeatRef.current || offset !== beatOffsetRef.current;
    if (beatTimesChanged || syncOffset !== syncOffsetRef.current || (!map && gridChanged)) {
      secPerBeatRef.current = secPerBeat;
      beatOffsetRef.current = offset;
      syncOffsetRef.current = syncOffset;
      beatTimesRef.current = map;
      anchorAt(actualSong, ctxNow, secPerBeat, offset, map);
      beatQueueRef.current = [];
      holdUntilRef.current = ctxNow + SYNCED_SCHEDULE_AHEAD;
    } else {
      // Posição prevista pela âncora vs. posição real da música.
      const predicted = anchorSongRef.current + (ctxNow - anchorCtxRef.current);
      const diff = actualSong - predicted;
      if (Math.abs(diff) > SEEK_JUMP) {
        // Salto grande (seek/pausa-retomada): recontagem a partir da nova posição.
        anchorAt(actualSong, ctxNow, secPerBeat, offset, map);
        beatQueueRef.current = [];
        holdUntilRef.current = ctxNow + SYNCED_SCHEDULE_AHEAD;
      } else if (Math.abs(diff) > DRIFT_CORRECTION) {
        // Desvio pequeno: recola o mapeamento à posição real, mantendo a contagem.
        anchorSongRef.current = actualSong;
        anchorCtxRef.current = ctxNow;
      }
    }

    // Agenda todas as batidas que caem dentro da janela de lookahead, derivando
    // o instante no relógio do AudioContext a partir da âncora (estável).
    const windowEndCtx = ctxNow + SYNCED_SCHEDULE_AHEAD;
    // Trava de segurança contra loop infinito se o BPM for absurdamente alto.
    let guard = 0;
    for (;;) {
      if (guard++ > 512) break;
      const n = nextBeatRef.current;
      let songTime: number;
      if (map) {
        if (n >= map.length) break; // acabaram as batidas detectadas
        songTime = map[n];
      } else {
        songTime = offset + n * secPerBeat;
      }
      // `syncOffset` (positivo) atrasa o clique para compensar a latência do
      // áudio em streaming e colá-lo exatamente na música.
      const ctxTime = anchorCtxRef.current + (songTime - anchorSongRef.current) + syncOffset;
      if (ctxTime < ctxNow - 0.005 || ctxTime < holdUntilRef.current) {
        // Batida já passou (atraso/seek à frente) OU está dentro da janela
        // "segurada" pós-reancoragem (já coberta pelos cliques antigos): pula
        // sem tocar para não sobrepor.
        nextBeatRef.current = n + 1;
        continue;
      }
      if (ctxTime > windowEndCtx) break;
      const beatInBar = ((n % beats) + beats) % beats;
      // Mixer: todas as batidas iguais, sem acentuação forte no tempo 1.
      playClick(ctx, master, ctxTime, "weak");
      beatQueueRef.current.push({ beat: beatInBar, time: ctxTime });
      nextBeatRef.current = n + 1;
    }
  }, [anchorAt]);

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

    const bpm = cfgRef.current.bpm;
    const secPerBeat = bpm > 0 ? 60 / bpm : 0;
    const offset = Number.isFinite(cfgRef.current.beatOffsetSec) ? cfgRef.current.beatOffsetSec : 0;
    const syncOffset = Number.isFinite(cfgRef.current.syncOffsetSec) ? cfgRef.current.syncOffsetSec : 0;
    const map =
      Array.isArray(cfgRef.current.beatTimes) && cfgRef.current.beatTimes.length >= 2
        ? cfgRef.current.beatTimes
        : null;
    secPerBeatRef.current = secPerBeat;
    beatOffsetRef.current = offset;
    syncOffsetRef.current = syncOffset;
    beatTimesRef.current = map;
    beatQueueRef.current = [];
    if (map || secPerBeat > 0) {
      anchorAt(cfgRef.current.getPosition(), ctx.currentTime, secPerBeat, offset, map);
    }

    runningRef.current = true;
    schedulerIdRef.current = window.setInterval(scheduler, LOOKAHEAD_MS);
    rafIdRef.current = requestAnimationFrame(visualLoop);
  }, [anchorAt, scheduler, visualLoop]);

  useEffect(() => {
    return () => {
      if (schedulerIdRef.current !== null) window.clearInterval(schedulerIdRef.current);
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
      if (audioCtxRef.current) audioCtxRef.current.close().catch(() => {});
    };
  }, []);

  return { currentBeat, start, stop };
}
