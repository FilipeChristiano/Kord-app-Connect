/**
 * Sons curtos e discretos para o hover dos cards da Home.
 * Acordes/Sofisticador: samples de piano real (Salamander Grand, em
 * public/piano/) com pitch-shift para as notas intermediárias.
 * Pad: sample real do módulo (pad-C.mp3). Metrônomo: o mesmo clique
 * sintetizado do módulo (playClick).
 * Se o navegador ainda não liberou o áudio (sem interação), falha em silêncio.
 */

import { playClick } from "@/lib/use-metronome";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let lastPlay = 0;

function getCtx(): { ctx: AudioContext; master: GainNode } | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.14;
    master.connect(ctx.destination);
    const unlock = () => {
      void ctx?.resume().then(() => {
        if (ctx?.state === "running") {
          window.removeEventListener("pointerdown", unlock);
          window.removeEventListener("keydown", unlock);
        }
      }).catch(() => undefined);
    };
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock, { passive: true });
  }
  if (ctx.state === "suspended") {
    void ctx.resume().catch(() => undefined);
    if (ctx.state === "suspended") return null;
  }
  return master ? { ctx, master } : null;
}

function throttled(): boolean {
  const now = performance.now();
  if (now - lastPlay < 350) return true;
  lastPlay = now;
  return false;
}

// ── Piano real: samples Salamander Grand em public/piano/ ────────────────────
// Notas gravadas a cada terça menor; as demais saem por pitch-shift (≤1 tom).
const PIANO_SAMPLES: { midi: number; file: string }[] = [
  { midi: 48, file: "C3" },
  { midi: 51, file: "Ds3" },
  { midi: 54, file: "Fs3" },
  { midi: 57, file: "A3" },
  { midi: 60, file: "C4" },
  { midi: 63, file: "Ds4" },
  { midi: 66, file: "Fs4" },
  { midi: 69, file: "A4" },
  { midi: 72, file: "C5" },
  { midi: 75, file: "Ds5" },
];

const pianoBuffers = new Map<string, Promise<AudioBuffer | null>>();

function loadPianoBuffer(c: AudioContext, file: string): Promise<AudioBuffer | null> {
  let p = pianoBuffers.get(file);
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}piano/${file}.mp3`)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((data) => c.decodeAudioData(data))
      .catch(() => {
        pianoBuffers.delete(file); // permite nova tentativa depois
        return null;
      });
    pianoBuffers.set(file, p);
  }
  return p;
}

function nearestSample(midi: number) {
  return PIANO_SAMPLES.reduce((best, s) =>
    Math.abs(s.midi - midi) < Math.abs(best.midi - midi) ? s : best,
  );
}

/**
 * Toca uma nota de piano real. `when` é relativo ao instante do hover
 * (ancorado antes do carregamento, para o arpejo não desalinhar);
 * `dur` controla o release (fade natural).
 */
function pianoNote(
  a: { ctx: AudioContext; master: GainNode },
  midi: number,
  when: number,
  dur: number,
  peak: number,
) {
  const sample = nearestSample(midi);
  const base = a.ctx.currentTime + 0.03;
  void loadPianoBuffer(a.ctx, sample.file).then((buffer) => {
    if (!buffer || a.ctx.state !== "running") return;
    const c = a.ctx;
    const t = Math.max(c.currentTime + 0.005, base + when);
    const src = c.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = Math.pow(2, (midi - sample.midi) / 12);
    const g = c.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.setValueAtTime(peak, t + dur - 0.6);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    src.connect(g).connect(a.master);
    src.start(t, 0, dur + 0.1);
    src.onended = () => {
      src.disconnect();
      g.disconnect();
    };
  });
}

/** Pré-carrega os samples usados pelos dois acordes (chamado no 1º hover). */
function warmPiano(c: AudioContext) {
  ["C3", "Ds3", "Fs3", "A3", "C4", "Ds4", "Ds5"].forEach((f) => void loadPianoBuffer(c, f));
}

/** Cmaj9 dedilhado no piano real, com release longo. */
export function playAcordesHover() {
  const a = getCtx();
  if (!a || throttled()) return;
  warmPiano(a.ctx);
  const chord = [48, 52, 55, 59, 62]; // C3 E3 G3 B3 D4
  chord.forEach((m, i) => pianoNote(a, m, i * 0.045, 2.6, 0.85));
}

/** C simples → C9 no piano real: a "transformação" em duas etapas. */
export function playSofisticadorHover() {
  const a = getCtx();
  if (!a || throttled()) return;
  warmPiano(a.ctx);
  [48, 52, 55].forEach((m) => pianoNote(a, m, 0, 0.5, 0.6)); // tríade simples, curta
  [48, 52, 55, 58, 62].forEach((m, i) => pianoNote(a, m, 0.5 + i * 0.04, 2.8, 0.85)); // C9
  pianoNote(a, 74, 0.72, 2.2, 0.3); // brilho (D5)
}

// ── Pad: trecho do sample real do módulo (pad-C.mp3) ─────────────────────────
let padBufferPromise: Promise<AudioBuffer | null> | null = null;

function loadPadBuffer(c: AudioContext): Promise<AudioBuffer | null> {
  if (!padBufferPromise) {
    padBufferPromise = fetch(`${import.meta.env.BASE_URL}pads/pad-C.mp3`)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((data) => c.decodeAudioData(data))
      .catch(() => {
        padBufferPromise = null; // permite nova tentativa depois
        return null;
      });
  }
  return padBufferPromise;
}

/** Trecho do pad real do módulo, com fade de entrada e saída. */
export function playPadHover() {
  const a = getCtx();
  if (!a || throttled()) return;
  void loadPadBuffer(a.ctx).then((buffer) => {
    if (!buffer || a.ctx.state !== "running") return;
    const c = a.ctx;
    const t0 = c.currentTime + 0.02;
    const DUR = 2.4;
    const offset = Math.max(0, Math.min(1.5, buffer.duration - DUR - 0.5));
    const src = c.createBufferSource();
    src.buffer = buffer;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.9, t0 + 0.5);
    g.gain.setValueAtTime(0.9, t0 + DUR - 0.8);
    g.gain.linearRampToValueAtTime(0.0001, t0 + DUR);
    src.connect(g).connect(a.master);
    src.start(t0, offset, DUR + 0.1);
    src.onended = () => {
      src.disconnect();
      g.disconnect();
    };
  });
}

/** Dois cliques do metrônomo real (forte + fraco) a 72 BPM. */
export function playMetronomoHover() {
  const a = getCtx();
  if (!a || throttled()) return;
  const t0 = a.ctx.currentTime + 0.02;
  const beat = 60 / 72;
  playClick(a.ctx, a.master, t0, "strong");
  playClick(a.ctx, a.master, t0 + beat, "weak");
}
