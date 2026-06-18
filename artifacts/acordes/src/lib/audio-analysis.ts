import { analyzeBpm, type BpmAnalysis } from "@/lib/bpm-detector";

// ─────────────────────────────────────────────────────────────────────────────
// Análise musical de áudio no navegador (client-side).
//
// Pipeline:
//  1. Decodifica o arquivo para um AudioBuffer (Web Audio API).
//  2. Renderiza um sinal mono reamostrado (leve) via OfflineAudioContext.
//  3. Calcula um cromagrama (energia por classe de altura) com STFT + FFT.
//  4. Detecta o tom (perfis de Krumhansl–Kessler nas 24 tonalidades).
//  5. Detecta os acordes principais por trecho (comparação com modelos).
//  6. Reaproveita o detector de BPM já existente para tempo e compasso.
//
// Tudo roda no cliente — não depende de servidor de processamento pesado.
// A precisão de acordes é uma ESTIMATIVA: a edição manual é esperada.
// ─────────────────────────────────────────────────────────────────────────────

export type AnalysisStep = "lendo" | "tom" | "bpm" | "acordes" | "finalizando";

export interface DetectedKey {
  symbol: string; // "G", "Em", "Bb"
  tonic: number; // 0..11 (0 = C)
  isMinor: boolean;
  confidence: number; // 0..1
  ptLabel: string; // "Sol Maior", "Mi menor"
}

export interface AudioAnalysisResult {
  key: DetectedKey;
  bpm: BpmAnalysis;
  chords: string[];
  duration: number; // segundos
}

const ANALYSIS_RATE = 11025; // suficiente p/ cromagrama até ~2 kHz, bem mais leve
const FRAME = 4096;
const HOP = 2048;

const SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const FLAT_KEYS = new Set([
  "F", "Bb", "Eb", "Ab", "Db", "Gb",
  "Dm", "Gm", "Cm", "Fm", "Bbm", "Ebm",
]);

const NOTE_PT: Record<string, string> = {
  C: "Dó", "C#": "Dó#", Db: "Réb", D: "Ré", "D#": "Ré#", Eb: "Mib",
  E: "Mi", F: "Fá", "F#": "Fá#", Gb: "Solb", G: "Sol", "G#": "Sol#",
  Ab: "Láb", A: "Lá", "A#": "Lá#", Bb: "Sib", B: "Si",
};

// Perfis de Krumhansl–Kessler
const KK_MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const KK_MINOR = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

const tick = () => new Promise((r) => setTimeout(r, 24));

// ── Decodificação ─────────────────────────────────────────────────────────────
export async function decodeAudioFile(data: ArrayBuffer): Promise<AudioBuffer> {
  const Ctor: typeof AudioContext =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctor();
  try {
    return await ctx.decodeAudioData(data.slice(0));
  } finally {
    ctx.close().catch(() => {});
  }
}

// ── Sinal mono reamostrado ────────────────────────────────────────────────────
async function renderMono(buffer: AudioBuffer, targetRate: number): Promise<Float32Array> {
  const length = Math.max(FRAME, Math.floor(buffer.duration * targetRate));
  const OAC: typeof OfflineAudioContext =
    window.OfflineAudioContext ||
    (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext })
      .webkitOfflineAudioContext;
  const ctx = new OAC(1, length, targetRate);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(ctx.destination);
  src.start();
  const rendered = await ctx.startRendering();
  return rendered.getChannelData(0).slice();
}

// ── FFT radix-2 (Cooley–Tukey), in-place ──────────────────────────────────────
function fft(re: Float32Array, im: Float32Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i]; re[i] = re[j]; re[j] = tr;
      const ti = im[i]; im[i] = im[j]; im[j] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    const half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < half; k++) {
        const ar = re[i + k];
        const ai = im[i + k];
        const br = re[i + k + half] * cr - im[i + k + half] * ci;
        const bi = re[i + k + half] * ci + im[i + k + half] * cr;
        re[i + k] = ar + br;
        im[i + k] = ai + bi;
        re[i + k + half] = ar - br;
        im[i + k + half] = ai - bi;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

// ── Cromagrama: vetor de 12 classes de altura por quadro ──────────────────────
function computeChromaFrames(mono: Float32Array, sampleRate: number): Float32Array[] {
  const half = FRAME >> 1;
  const hann = new Float32Array(FRAME);
  for (let i = 0; i < FRAME; i++) {
    hann[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FRAME - 1));
  }

  // Mapa bin → classe de altura (apenas faixa musical útil)
  const binPc = new Int8Array(half).fill(-1);
  const fMin = 65; // ~C2
  const fMax = 2000;
  for (let b = 1; b < half; b++) {
    const f = (b * sampleRate) / FRAME;
    if (f < fMin || f > fMax) continue;
    const midi = 69 + 12 * Math.log2(f / 440);
    binPc[b] = (((Math.round(midi) % 12) + 12) % 12) as number;
  }

  const numFrames = Math.floor((mono.length - FRAME) / HOP);
  const frames: Float32Array[] = [];
  const re = new Float32Array(FRAME);
  const im = new Float32Array(FRAME);

  for (let fi = 0; fi < numFrames; fi++) {
    const start = fi * HOP;
    im.fill(0);
    for (let i = 0; i < FRAME; i++) re[i] = mono[start + i] * hann[i];

    fft(re, im);

    const chroma = new Float32Array(12);
    for (let b = 1; b < half; b++) {
      const pc = binPc[b];
      if (pc < 0) continue;
      chroma[pc] += Math.sqrt(re[b] * re[b] + im[b] * im[b]);
    }
    let max = 0;
    for (let i = 0; i < 12; i++) if (chroma[i] > max) max = chroma[i];
    if (max > 0) for (let i = 0; i < 12; i++) chroma[i] /= max;
    frames.push(chroma);
  }
  return frames;
}

function averageChroma(frames: Float32Array[]): Float32Array {
  const avg = new Float32Array(12);
  if (frames.length === 0) return avg;
  for (const f of frames) for (let i = 0; i < 12; i++) avg[i] += f[i];
  for (let i = 0; i < 12; i++) avg[i] /= frames.length;
  return avg;
}

// Correlação de Pearson entre dois vetores de 12 posições
function pearson(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let ma = 0;
  let mb = 0;
  for (let i = 0; i < 12; i++) {
    ma += a[i];
    mb += b[i];
  }
  ma /= 12;
  mb /= 12;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < 12; i++) {
    const xa = a[i] - ma;
    const xb = b[i] - mb;
    num += xa * xb;
    da += xa * xa;
    db += xb * xb;
  }
  const den = Math.sqrt(da * db);
  return den > 0 ? num / den : 0;
}

// ── Detecção de tom ───────────────────────────────────────────────────────────
function detectKey(avg: Float32Array): DetectedKey {
  let best = { tonic: 0, isMinor: false, score: -Infinity };
  let second = -Infinity;

  for (let t = 0; t < 12; t++) {
    const major = new Float32Array(12);
    const minor = new Float32Array(12);
    for (let i = 0; i < 12; i++) {
      major[i] = KK_MAJOR[(i - t + 12) % 12];
      minor[i] = KK_MINOR[(i - t + 12) % 12];
    }
    const sMaj = pearson(avg, major);
    const sMin = pearson(avg, minor);
    for (const [score, isMinor] of [
      [sMaj, false],
      [sMin, true],
    ] as const) {
      if (score > best.score) {
        second = best.score;
        best = { tonic: t, isMinor, score };
      } else if (score > second) {
        second = score;
      }
    }
  }

  const confidence = Math.max(
    0,
    Math.min(1, second > -Infinity ? best.score - second : best.score),
  );
  const symbol = SHARP[best.tonic] + (best.isMinor ? "m" : "");
  const noteName = SHARP[best.tonic];
  const ptLabel = `${NOTE_PT[noteName]} ${best.isMinor ? "menor" : "Maior"}`;

  return { symbol, tonic: best.tonic, isMinor: best.isMinor, confidence, ptLabel };
}

// ── Detecção de acordes ───────────────────────────────────────────────────────
// Modelos: tríade maior {0,4,7} e menor {0,3,7} para cada uma das 12 raízes.
function buildChordTemplates(): { pcs: number[]; isMinor: boolean; root: number }[] {
  const list: { pcs: number[]; isMinor: boolean; root: number }[] = [];
  for (let r = 0; r < 12; r++) {
    list.push({ root: r, isMinor: false, pcs: [r % 12, (r + 4) % 12, (r + 7) % 12] });
    list.push({ root: r, isMinor: true, pcs: [r % 12, (r + 3) % 12, (r + 7) % 12] });
  }
  return list;
}

function detectChords(
  frames: Float32Array[],
  sampleRate: number,
  bpm: number,
  key: DetectedKey,
): string[] {
  if (frames.length === 0) return [];

  const names = FLAT_KEYS.has(key.symbol) ? FLAT : SHARP;
  const templates = buildChordTemplates();
  const frameRate = sampleRate / HOP; // quadros por segundo
  const secPerBeat = bpm > 0 ? 60 / bpm : 0.5;
  const secPerSeg = Math.max(0.5, secPerBeat * 2); // ~2 tempos por trecho
  const segFrames = Math.max(2, Math.round(secPerSeg * frameRate));

  const invSqrt3 = 1 / Math.sqrt(3);
  const raw: { label: string; score: number }[] = [];

  for (let s = 0; s + 1 < frames.length; s += segFrames) {
    const end = Math.min(frames.length, s + segFrames);
    const seg = new Float32Array(12);
    for (let f = s; f < end; f++) for (let i = 0; i < 12; i++) seg[i] += frames[f][i];

    // energia / norma do trecho
    let norm = 0;
    for (let i = 0; i < 12; i++) norm += seg[i] * seg[i];
    norm = Math.sqrt(norm);
    if (norm < 1e-4) continue; // silêncio
    for (let i = 0; i < 12; i++) seg[i] /= norm;

    let bestScore = -Infinity;
    let bestLabel = "";
    for (const tpl of templates) {
      let dot = 0;
      for (const pc of tpl.pcs) dot += seg[pc];
      dot *= invSqrt3; // produto escalar com modelo unitário
      if (dot > bestScore) {
        bestScore = dot;
        bestLabel = names[tpl.root] + (tpl.isMinor ? "m" : "");
      }
    }
    raw.push({ label: bestLabel, score: bestScore });
  }

  // Junta trechos consecutivos iguais e descarta estimativas muito fracas
  const out: string[] = [];
  for (const c of raw) {
    if (c.score < 0.45) continue;
    if (out.length === 0 || out[out.length - 1] !== c.label) out.push(c.label);
    if (out.length >= 64) break;
  }
  return out;
}

// ── Pipeline completo ─────────────────────────────────────────────────────────
export async function analyzeAudioBuffer(
  buffer: AudioBuffer,
  onProgress?: (step: AnalysisStep) => void,
): Promise<AudioAnalysisResult> {
  onProgress?.("tom");
  await tick();
  const mono = await renderMono(buffer, ANALYSIS_RATE);
  const frames = computeChromaFrames(mono, ANALYSIS_RATE);
  const key = detectKey(averageChroma(frames));

  onProgress?.("bpm");
  await tick();
  const bpm = await analyzeBpm(buffer);

  onProgress?.("acordes");
  await tick();
  const chords = detectChords(frames, ANALYSIS_RATE, bpm.bpm, key);

  onProgress?.("finalizando");
  await tick();

  return { key, bpm, chords, duration: buffer.duration };
}

export function formatDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}
