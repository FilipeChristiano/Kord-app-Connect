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

// Acorde com janela de tempo (segundos) e confiança — base para alinhar a cifra
// sobre a letra transcrita.
export interface TimedChord {
  symbol: string;
  start: number;
  end: number;
  confidence: number; // 0..1 (produto escalar normalizado com o modelo de tríade)
}

export interface AudioAnalysisResult {
  key: DetectedKey;
  bpm: BpmAnalysis;
  chords: string[];
  chordTimeline: TimedChord[];
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
async function computeChromaFrames(
  mono: Float32Array,
  sampleRate: number,
): Promise<{ chroma: Float32Array[]; bass: Float32Array[]; energy: Float32Array }> {
  const half = FRAME >> 1;
  const hann = new Float32Array(FRAME);
  for (let i = 0; i < FRAME; i++) {
    hann[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FRAME - 1));
  }

  // Mapa bin → classe de altura. Dois registros:
  //  - harmônico (binPc): faixa musical ampla, usado para tom e acordes.
  //  - grave (bassPc): faixa baixa, usado para descobrir a nota do baixo e
  //    identificar acordes com baixo invertido (ex.: D/F#).
  const binPc = new Int8Array(half).fill(-1);
  const bassPc = new Int8Array(half).fill(-1);
  const fMin = 65; // ~C2
  const fMax = 2000;
  const fBassMin = 40; // ~E1
  const fBassMax = 200; // ~G3
  for (let b = 1; b < half; b++) {
    const f = (b * sampleRate) / FRAME;
    if (f < fBassMin || f > fMax) continue;
    const midi = 69 + 12 * Math.log2(f / 440);
    const pc = (((Math.round(midi) % 12) + 12) % 12) as number;
    if (f >= fMin && f <= fMax) binPc[b] = pc;
    if (f >= fBassMin && f <= fBassMax) bassPc[b] = pc;
  }

  const numFrames = Math.max(0, Math.floor((mono.length - FRAME) / HOP));
  const frames: Float32Array[] = [];
  const bassFrames: Float32Array[] = [];
  const energy = new Float32Array(numFrames);
  const re = new Float32Array(FRAME);
  const im = new Float32Array(FRAME);

  for (let fi = 0; fi < numFrames; fi++) {
    // Cede a thread a cada bloco de quadros para a UI (spinner, toques)
    // continuar respondendo no mobile durante a análise.
    if (fi > 0 && fi % 200 === 0) await tick();
    const start = fi * HOP;
    im.fill(0);
    for (let i = 0; i < FRAME; i++) re[i] = mono[start + i] * hann[i];

    fft(re, im);

    const chroma = new Float32Array(12);
    const bass = new Float32Array(12);
    for (let b = 1; b < half; b++) {
      const pcH = binPc[b];
      const pcB = bassPc[b];
      if (pcH < 0 && pcB < 0) continue;
      const mag = Math.sqrt(re[b] * re[b] + im[b] * im[b]);
      if (pcH >= 0) chroma[pcH] += mag;
      if (pcB >= 0) bass[pcB] += mag;
    }
    // Guarda a energia absoluta (antes de qualquer normalização) para distinguir
    // trechos com som de silêncio/ruído. Mantém o cromagrama "cru": a
    // normalização é feita por trecho na detecção de acordes e o tom usa
    // correlação de Pearson (invariante a escala).
    let e = 0;
    for (let i = 0; i < 12; i++) e += chroma[i];
    energy[fi] = e;
    frames.push(chroma);
    bassFrames.push(bass);
  }
  return { chroma: frames, bass: bassFrames, energy };
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

// Campo harmônico do tom: acordes que "pertencem" à música. Usado para dar um
// leve bônus na detecção, reduzindo chutes fora do tom (ex.: numa música em Sol,
// preferir G, Am, Bm, C, D, Em). Para tom menor, inclui o V maior (harmônico).
function diatonicChordSet(key: DetectedKey): Set<string> {
  const set = new Set<string>();
  const t = key.tonic;
  const add = (root: number, isMinor: boolean) =>
    set.add(`${((root % 12) + 12) % 12}:${isMinor ? 1 : 0}`);
  if (!key.isMinor) {
    add(t, false); // I
    add(t + 2, true); // ii
    add(t + 4, true); // iii
    add(t + 5, false); // IV
    add(t + 7, false); // V
    add(t + 9, true); // vi
  } else {
    add(t, true); // i
    add(t + 3, false); // III
    add(t + 5, true); // iv
    add(t + 7, true); // v (menor natural)
    add(t + 7, false); // V (menor harmônico — muito comum)
    add(t + 8, false); // VI
    add(t + 10, false); // VII
  }
  return set;
}

function detectChords(
  chroma: Float32Array[],
  bass: Float32Array[],
  energy: Float32Array,
  sampleRate: number,
  bpm: number,
  key: DetectedKey,
): { chords: string[]; timeline: TimedChord[] } {
  if (chroma.length === 0) return { chords: [], timeline: [] };

  const names = FLAT_KEYS.has(key.symbol) ? FLAT : SHARP;
  const templates = buildChordTemplates();
  const diatonic = diatonicChordSet(key);
  const KEY_BONUS = 1.12; // peso extra para acordes do campo harmônico
  const SEVENTH_REL = 0.9; // energia mínima da 7ª vs. média da tríade
  const SEVENTH_BG = 1.6; // a 7ª precisa se destacar do "fundo" (notas fora da tríade)
  const BASS_DOMINANCE = 1.3; // o quanto o baixo precisa se destacar
  const frameRate = sampleRate / HOP; // quadros por segundo
  const secPerFrame = HOP / sampleRate;
  const secPerBeat = bpm > 0 ? 60 / bpm : 0.5;
  const secPerSeg = Math.max(0.5, secPerBeat * 2); // ~2 tempos por trecho
  const segFrames = Math.max(2, Math.round(secPerSeg * frameRate));
  const invSqrt3 = 1 / Math.sqrt(3);

  // 1) Agrega os quadros em trechos (~2 tempos), guardando a janela de quadros.
  const segs: {
    chroma: Float32Array;
    bass: Float32Array;
    energy: number;
    startFrame: number;
    endFrame: number;
  }[] = [];
  for (let s = 0; s < chroma.length; s += segFrames) {
    const end = Math.min(chroma.length, s + segFrames);
    const acc = new Float32Array(12);
    const bacc = new Float32Array(12);
    let e = 0;
    for (let f = s; f < end; f++) {
      const frame = chroma[f];
      const bframe = bass[f];
      for (let i = 0; i < 12; i++) {
        acc[i] += frame[i];
        bacc[i] += bframe[i];
      }
      e += energy[f];
    }
    segs.push({ chroma: acc, bass: bacc, energy: e, startFrame: s, endFrame: end });
  }
  if (segs.length === 0) return { chords: [], timeline: [] };

  // 2) Limiar de silêncio relativo à mediana das energias (descarta trechos
  //    de silêncio/ruído sem depender de um corte absoluto).
  const sortedE = segs.map((x) => x.energy).sort((a, b) => a - b);
  const medianE = sortedE[Math.floor(sortedE.length / 2)] || 0;
  const minE = medianE * 0.12;

  // 3) Para cada trecho com som, escolhe a melhor tríade (maior/menor) com bônus
  //    de campo harmônico, depois enriquece com 7ª e baixo invertido quando há
  //    evidência clara no áudio.
  const raw: TimedChord[] = [];
  for (const seg of segs) {
    if (seg.energy < minE) continue; // silêncio / quase silêncio
    let norm = 0;
    for (let i = 0; i < 12; i++) norm += seg.chroma[i] * seg.chroma[i];
    norm = Math.sqrt(norm);
    if (norm < 1e-6) continue;

    // 3a) Melhor tríade. `biased` decide a escolha (com bônus do tom); `dot`
    //     guarda o score cru para a confiança exibida ("?").
    let bestBiased = -Infinity;
    let bestRoot = 0;
    let bestMinor = false;
    let bestDot = 0;
    for (const tpl of templates) {
      let dot = 0;
      for (const pc of tpl.pcs) dot += seg.chroma[pc];
      dot = (dot / norm) * invSqrt3; // produto escalar normalizado
      const isDia = diatonic.has(`${tpl.root}:${tpl.isMinor ? 1 : 0}`);
      const biased = isDia ? dot * KEY_BONUS : dot;
      if (biased > bestBiased) {
        bestBiased = biased;
        bestRoot = tpl.root;
        bestMinor = tpl.isMinor;
        bestDot = dot;
      }
    }

    const third = (bestRoot + (bestMinor ? 3 : 4)) % 12;
    const fifth = (bestRoot + 7) % 12;

    // 3b) Sétima: conservador. A nota da 7ª precisa (1) ter energia comparável à
    //     média da tríade E (2) se destacar do "fundo" (média das notas que não
    //     são da tríade), para não confundir com vazamento de voz/melodia.
    const triadMean = (seg.chroma[bestRoot] + seg.chroma[third] + seg.chroma[fifth]) / 3;
    let bgSum = 0;
    let bgCount = 0;
    for (let i = 0; i < 12; i++) {
      if (i === bestRoot || i === third || i === fifth) continue;
      bgSum += seg.chroma[i];
      bgCount++;
    }
    const bgMean = bgCount > 0 ? bgSum / bgCount : 0;
    let suffix = bestMinor ? "m" : "";
    if (triadMean > 0) {
      const b7 = seg.chroma[(bestRoot + 10) % 12]; // 7ª menor (dominante / m7)
      const M7 = seg.chroma[(bestRoot + 11) % 12]; // 7ª maior (7M)
      const standsOut = (v: number, rel: number) =>
        v >= triadMean * rel && v >= bgMean * SEVENTH_BG;
      if (bestMinor) {
        if (standsOut(b7, SEVENTH_REL)) suffix = "m7";
      } else if (b7 >= M7 && standsOut(b7, SEVENTH_REL)) {
        suffix = "7";
      } else if (standsOut(M7, SEVENTH_REL + 0.05)) {
        suffix = "7M";
      }
    }

    let label = names[bestRoot] + suffix;

    // 3c) Baixo invertido: se a nota grave dominante é a 3ª ou a 5ª (inversão
    //     real, ex.: D/F#), acrescenta "/baixo".
    let bMax = -1;
    let bIdx = -1;
    let bSecond = -1;
    for (let i = 0; i < 12; i++) {
      const v = seg.bass[i];
      if (v > bMax) {
        bSecond = bMax;
        bMax = v;
        bIdx = i;
      } else if (v > bSecond) {
        bSecond = v;
      }
    }
    if (
      bIdx >= 0 &&
      bIdx !== bestRoot &&
      (bIdx === third || bIdx === fifth) &&
      bMax >= Math.max(bSecond, 1e-9) * BASS_DOMINANCE
    ) {
      label += "/" + names[bIdx];
    }

    raw.push({
      symbol: label,
      start: seg.startFrame * secPerFrame,
      end: seg.endFrame * secPerFrame,
      confidence: Math.max(0, Math.min(1, bestDot)),
    });
  }

  // 4) Junta trechos consecutivos iguais, estendendo a janela de tempo.
  const timeline: TimedChord[] = [];
  for (const c of raw) {
    const last = timeline[timeline.length - 1];
    if (last && last.symbol === c.symbol) {
      last.end = c.end;
      last.confidence = Math.max(last.confidence, c.confidence);
    } else {
      if (timeline.length >= 64) break;
      timeline.push({ ...c });
    }
  }

  return { chords: timeline.map((t) => t.symbol), timeline };
}

// ── Pipeline completo ─────────────────────────────────────────────────────────
export async function analyzeAudioBuffer(
  buffer: AudioBuffer,
  onProgress?: (step: AnalysisStep) => void,
): Promise<AudioAnalysisResult> {
  onProgress?.("tom");
  await tick();
  const mono = await renderMono(buffer, ANALYSIS_RATE);
  const { chroma, bass, energy } = await computeChromaFrames(mono, ANALYSIS_RATE);
  const key = detectKey(averageChroma(chroma));

  onProgress?.("bpm");
  await tick();
  const bpm = await analyzeBpm(buffer);

  onProgress?.("acordes");
  await tick();
  const { chords, timeline } = detectChords(chroma, bass, energy, ANALYSIS_RATE, bpm.bpm, key);

  onProgress?.("finalizando");
  await tick();

  return { key, bpm, chords, chordTimeline: timeline, duration: buffer.duration };
}

export function formatDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}
