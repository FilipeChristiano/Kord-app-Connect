/**
 * Sons curtos e discretos para o hover dos cards da Home.
 * Acordes/Sofisticador: síntese Web Audio. Pad: sample real do módulo
 * (pad-C.mp3). Metrônomo: o mesmo clique sintetizado do módulo (playClick).
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

const midiToFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

function note(
  c: AudioContext,
  out: AudioNode,
  midi: number,
  when: number,
  dur: number,
  peak: number,
  type: OscillatorType = "triangle",
  attack = 0.02,
) {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = midiToFreq(midi);
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(peak, when + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  osc.connect(g).connect(out);
  osc.start(when);
  osc.stop(when + dur + 0.05);
  osc.onended = () => {
    osc.disconnect();
    g.disconnect();
  };
}

/** Cmaj9 dedilhado — leve, como um piano elétrico. */
export function playAcordesHover() {
  const a = getCtx();
  if (!a || throttled()) return;
  const t0 = a.ctx.currentTime + 0.02;
  const chord = [48, 52, 55, 59, 62]; // C3 E3 G3 B3 D4
  chord.forEach((m, i) => {
    note(a.ctx, a.master, m, t0 + i * 0.035, 1.3, 0.22, "triangle", 0.015);
    note(a.ctx, a.master, m + 12, t0 + i * 0.035, 1.1, 0.05, "sine", 0.02);
  });
}

/** C simples → C9: a "transformação" em duas etapas. */
export function playSofisticadorHover() {
  const a = getCtx();
  if (!a || throttled()) return;
  const t0 = a.ctx.currentTime + 0.02;
  [48, 52, 55].forEach((m) => note(a.ctx, a.master, m, t0, 0.35, 0.16, "triangle"));
  const t1 = t0 + 0.42;
  [48, 52, 55, 58, 62].forEach((m, i) =>
    note(a.ctx, a.master, m, t1 + i * 0.03, 1.2, 0.2, "triangle", 0.015),
  );
  note(a.ctx, a.master, 74, t1 + 0.15, 0.9, 0.04, "sine", 0.05); // brilho
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
