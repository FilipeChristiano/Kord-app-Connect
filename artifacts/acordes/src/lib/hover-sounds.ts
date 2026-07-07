/**
 * Sons curtos e discretos para o hover dos cards da Home.
 * Acordes/Sofisticador: samples de piano real (via lib/piano.ts).
 * Pad: sample real do módulo (pad-C.mp3). Metrônomo: o mesmo clique
 * sintetizado do módulo (playClick).
 * Se o navegador ainda não liberou o áudio (sem interação), falha em silêncio.
 */

import { playClick } from "@/lib/use-metronome";
import { getAudio, pianoNote, warmPiano } from "@/lib/piano";

let lastPlay = 0;

function throttled(): boolean {
  const now = performance.now();
  if (now - lastPlay < 350) return true;
  lastPlay = now;
  return false;
}

const WARM_FILES = ["C3", "Ds3", "Fs3", "A3", "C4", "Ds4", "Ds5"];

/** Cmaj9 dedilhado no piano real, com release longo. */
export function playAcordesHover() {
  const a = getAudio();
  if (!a || throttled()) return;
  warmPiano(a.ctx, WARM_FILES);
  const chord = [48, 52, 55, 59, 62]; // C3 E3 G3 B3 D4
  chord.forEach((m, i) => pianoNote(a, m, i * 0.045, 2.6, 0.85));
}

/** C simples → C9 no piano real: a "transformação" em duas etapas. */
export function playSofisticadorHover() {
  const a = getAudio();
  if (!a || throttled()) return;
  warmPiano(a.ctx, WARM_FILES);
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
  const a = getAudio();
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
  const a = getAudio();
  if (!a || throttled()) return;
  const t0 = a.ctx.currentTime + 0.02;
  const beat = 60 / 72;
  playClick(a.ctx, a.master, t0, "strong");
  playClick(a.ctx, a.master, t0 + beat, "weak");
}
