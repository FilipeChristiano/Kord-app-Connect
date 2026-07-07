/**
 * Motor de piano real compartilhado (samples Salamander Grand em public/piano/).
 * Notas gravadas a cada terça menor; as demais saem por pitch-shift (≤1 tom).
 * Usado pelos sons de hover da Home e pelo playback de acordes do dicionário.
 * Se o navegador ainda não liberou o áudio (sem interação), falha em silêncio.
 */

import { placeNotes } from "@/lib/notes";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

export interface AudioHandle {
  ctx: AudioContext;
  master: GainNode;
}

export function getAudio(): AudioHandle | null {
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
  { midi: 78, file: "Fs5" },
  { midi: 81, file: "A5" },
  { midi: 84, file: "C6" },
];

const pianoBuffers = new Map<string, Promise<AudioBuffer | null>>();

export function loadPianoBuffer(c: AudioContext, file: string): Promise<AudioBuffer | null> {
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
 * Toca uma nota de piano real. `when` é relativo ao instante da chamada
 * (ancorado antes do carregamento, para arpejos não desalinharem);
 * `dur` controla o release (fade natural nos últimos 0.6s).
 */
export function pianoNote(
  a: AudioHandle,
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

/** Pré-carrega samples (sem tocar nada). */
export function warmPiano(c: AudioContext, files: string[]) {
  files.forEach((f) => void loadPianoBuffer(c, f));
}

// ── Playback de acordes do dicionário ────────────────────────────────────────
// Converte o mesmo voicing exibido no diagrama (placeNotes) em MIDI:
// oitava 0 do diagrama = C3 (MIDI 48).
const DIAGRAM_BASE_MIDI = 48;

let lastChord = 0;

/**
 * Toca um voicing completo (ME + MD) no piano real, com um leve dedilhado
 * ascendente — exatamente as notas mostradas no diagrama.
 */
export function playChordVoicing(
  leftHand: string[],
  rightHand: string[],
  opts?: { leftBaseOctave?: number },
) {
  const a = getAudio();
  if (!a) return;
  const now = performance.now();
  if (now - lastChord < 250) return;
  lastChord = now;

  const lh = placeNotes(leftHand, opts?.leftBaseOctave ?? 0);
  const rh = placeNotes(rightHand, 1);
  const midis = [
    ...lh.map((n) => ({ midi: DIAGRAM_BASE_MIDI + n.octave * 12 + n.semitone, peak: 0.7 })),
    ...rh.map((n) => ({ midi: DIAGRAM_BASE_MIDI + n.octave * 12 + n.semitone, peak: 0.85 })),
  ].sort((x, y) => x.midi - y.midi);

  midis.forEach((n, i) => pianoNote(a, n.midi, i * 0.03, 2.8, n.peak));
}
