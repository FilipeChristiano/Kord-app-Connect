export type DetectedTimeSignature = "3/4" | "4/4";

export interface AnalyzedSegment {
  start: number; // segundos
  end: number; // segundos
}

export type BpmRelation = "metade" | "principal" | "dobro";

export interface BpmMetrics {
  regularity: number; // 0..1 — fração de batidas com onset alinhado
  meanErrorMs: number; // erro médio entre a batida da grade e o onset (ms)
  stability: number; // 0..1 — quão constante é o pulso
  beatCount: number; // batidas casadas no trecho
}

export interface BpmOption {
  bpm: number;
  relation: BpmRelation;
  confidence: number; // 0..1 — baseada nas métricas de alinhamento
  phaseSec: number; // posição da 1ª batida no trecho (s), p/ sincronizar o clique
  metrics: BpmMetrics;
}

export interface BpmAnalysis {
  bpm: number; // BPM principal (detectado)
  confidence: number; // 0..1 — confiança do consenso
  options: BpmOption[]; // exatamente [metade, principal, dobro]
  recommendedIndex: number; // índice da opção recomendada em `options`
  timeSignature: DetectedTimeSignature | null;
  segment: AnalyzedSegment | null; // trecho usado na análise
}

const MIN_BPM_OUT = 40;
const MAX_BPM_OUT = 240;
const SEARCH_MIN = 50;
const SEARCH_MAX = 210;

const clampBpm = (v: number) => Math.max(MIN_BPM_OUT, Math.min(MAX_BPM_OUT, Math.round(v)));
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const EMPTY: BpmAnalysis = {
  bpm: 0,
  confidence: 0,
  options: [],
  recommendedIndex: 1,
  timeSignature: null,
  segment: null,
};

const FRAME = 1024;
const HOP = 256;

/**
 * Detecta o BPM de um AudioBuffer com um pipeline em várias etapas:
 *
 *  1. Filtra o áudio em bandas (graves 50–300 Hz e médios 1–4 kHz) para dar
 *     peso a bumbo/baixo e caixa/ataque, reduzindo pads, vozes e reverbs.
 *  2. Monta uma envelope de onsets (fluxo de energia) combinando as bandas.
 *  3. Seleciona automaticamente o trecho mais rítmico (~10 s), ignorando
 *     silêncio e introduções livres.
 *  4. Estima o andamento por dois métodos (autocorrelação com pente de
 *     harmônicos + tempograma por DFT) e combina por consenso.
 *  5. Calcula candidatos, confiança e compasso provável.
 */
export async function analyzeBpm(buffer: AudioBuffer): Promise<BpmAnalysis> {
  const sampleRate = buffer.sampleRate;
  if (buffer.length < sampleRate) return EMPTY; // curto demais

  // ── 1. Bandas de frequência ────────────────────────────────────────────────
  let lowBand: Float32Array;
  let midBand: Float32Array | null;
  try {
    [lowBand, midBand] = await Promise.all([
      renderBand(buffer, 50, 300),
      renderBand(buffer, 1000, 4000),
    ]);
  } catch {
    lowBand = downmix(buffer);
    midBand = null;
  }

  // ── 2. Envelope de onsets combinada ─────────────────────────────────────────
  const envLow = fluxEnvelope(lowBand, FRAME, HOP);
  const envMid = midBand ? fluxEnvelope(midBand, FRAME, HOP) : new Float32Array(envLow.length);
  const n = Math.min(envLow.length, envMid.length);
  if (n < 32) return EMPTY;

  // Peso maior para graves (bumbo/baixo), secundário para médios (caixa/ataque)
  const rawEnv = new Float32Array(n);
  for (let i = 0; i < n; i++) rawEnv[i] = envLow[i] + 0.5 * envMid[i];

  const envRate = sampleRate / HOP; // quadros por segundo

  // ── 3. Seleção do melhor trecho rítmico ─────────────────────────────────────
  const seg = selectSegment(rawEnv, envRate);
  const segEnv = rawEnv.subarray(seg.startFrame, seg.endFrame);

  // ── 4 + 5. Detecção, candidatos, confiança e compasso ───────────────────────
  const det = detectTempo(segEnv, envRate);
  if (!det) return EMPTY;

  // ── 6. Validação por oitava: métricas por opção (metade / principal / dobro) ─
  const onsets = pickOnsets(det.env);
  const options = buildOptions(det.env, envRate, det.bpm, onsets);

  return {
    bpm: det.bpm,
    confidence: det.confidence,
    options,
    recommendedIndex: pickRecommended(options),
    timeSignature: det.timeSignature,
    segment: { start: seg.startFrame / envRate, end: seg.endFrame / envRate },
  };
}

// ── Bandas via OfflineAudioContext ────────────────────────────────────────────
async function renderBand(
  buffer: AudioBuffer,
  highpass: number,
  lowpass: number,
): Promise<Float32Array> {
  const OAC: typeof OfflineAudioContext =
    window.OfflineAudioContext ||
    (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext })
      .webkitOfflineAudioContext;
  const ctx = new OAC(1, buffer.length, buffer.sampleRate);
  const src = ctx.createBufferSource();
  src.buffer = buffer;

  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = highpass;
  hp.Q.value = 0.7;

  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = lowpass;
  lp.Q.value = 0.7;

  src.connect(hp);
  hp.connect(lp);
  lp.connect(ctx.destination);
  src.start();

  const rendered = await ctx.startRendering();
  return rendered.getChannelData(0);
}

function downmix(buffer: AudioBuffer): Float32Array {
  const length = buffer.length;
  const channels = buffer.numberOfChannels;
  const mono = new Float32Array(length);
  for (let c = 0; c < channels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < length; i++) mono[i] += data[i] / channels;
  }
  return mono;
}

// ── Envelope de fluxo de energia ──────────────────────────────────────────────
function fluxEnvelope(data: Float32Array, frame: number, hop: number): Float32Array {
  const numFrames = Math.floor((data.length - frame) / hop);
  if (numFrames < 1) return new Float32Array(0);
  const env = new Float32Array(numFrames);
  let prev = 0;
  for (let f = 0; f < numFrames; f++) {
    const start = f * hop;
    let energy = 0;
    for (let i = 0; i < frame; i++) {
      const s = data[start + i];
      energy += s * s;
    }
    energy = Math.log1p(Math.sqrt(energy / frame) * 1000);
    env[f] = Math.max(0, energy - prev);
    prev = energy;
  }
  return env;
}

// ── Seleção de trecho ─────────────────────────────────────────────────────────
function selectSegment(
  env: Float32Array,
  envRate: number,
): { startFrame: number; endFrame: number } {
  const total = env.length;
  const winLen = Math.round(10 * envRate);
  // Áudio curto: usa tudo
  if (total <= Math.round(12 * envRate)) {
    return { startFrame: 0, endFrame: total };
  }

  const step = Math.max(1, Math.round(1 * envRate));
  let bestStart = 0;
  let bestScore = -1;

  for (let s = 0; s + winLen <= total; s += step) {
    let energy = 0;
    for (let i = 0; i < winLen; i++) energy += env[s + i];
    if (energy <= 0) continue;
    const periodicity = quickPeriodicity(env, s, winLen, envRate);
    const score = periodicity * Math.sqrt(energy);
    if (score > bestScore) {
      bestScore = score;
      bestStart = s;
    }
  }

  return { startFrame: bestStart, endFrame: bestStart + winLen };
}

// Pico de autocorrelação normalizada (0..1) dentro de uma janela — leve.
function quickPeriodicity(
  env: Float32Array,
  start: number,
  len: number,
  envRate: number,
): number {
  const minLag = Math.max(2, Math.floor((envRate * 60) / SEARCH_MAX));
  const maxLag = Math.min(len - 2, Math.ceil((envRate * 60) / SEARCH_MIN));
  if (maxLag <= minLag) return 0;

  // média da janela
  let mean = 0;
  for (let i = 0; i < len; i++) mean += env[start + i];
  mean /= len;

  let zeroLag = 0;
  for (let i = 0; i < len; i++) {
    const d = env[start + i] - mean;
    zeroLag += d * d;
  }
  if (zeroLag <= 0) return 0;

  let best = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    const limit = len - lag;
    for (let i = 0; i < limit; i++) {
      sum += (env[start + i] - mean) * (env[start + i + lag] - mean);
    }
    const norm = sum / zeroLag;
    if (norm > best) best = norm;
  }
  return Math.max(0, best);
}

// ── Detecção de andamento (multi-método + consenso) ───────────────────────────
interface TempoResult {
  bpm: number;
  confidence: number;
  timeSignature: DetectedTimeSignature | null;
  env: Float32Array; // envelope processada do trecho (p/ onsets e métricas)
}

function detectTempo(envSlice: Float32Array, envRate: number): TempoResult | null {
  const numFrames = envSlice.length;
  if (numFrames < 32) return null;

  // Cópia com remoção de média + retificação (realça onsets)
  const env = Float32Array.from(envSlice);
  let mean = 0;
  for (let i = 0; i < numFrames; i++) mean += env[i];
  mean /= numFrames;
  for (let i = 0; i < numFrames; i++) env[i] = Math.max(0, env[i] - mean);

  // Energia acumulada p/ normalização da autocorrelação (estilo Pearson)
  const prefixSq = new Float64Array(numFrames + 1);
  for (let i = 0; i < numFrames; i++) prefixSq[i + 1] = prefixSq[i] + env[i] * env[i];
  if (prefixSq[numFrames] <= 0) return null;

  const minLag = Math.max(2, Math.floor((envRate * 60) / SEARCH_MAX));
  const maxLag = Math.min(numFrames - 2, Math.ceil((envRate * 60) / SEARCH_MIN));
  if (maxLag <= minLag) return null;
  const harmMaxLag = Math.min(numFrames - 2, maxLag * 4);

  // Autocorrelação normalizada por lag (inteiros)
  const r = new Float32Array(harmMaxLag + 1);
  for (let lag = minLag; lag <= harmMaxLag; lag++) {
    let sum = 0;
    const limit = numFrames - lag;
    for (let i = 0; i < limit; i++) sum += env[i] * env[i + lag];
    const energyA = prefixSq[numFrames - lag] - prefixSq[0];
    const energyB = prefixSq[numFrames] - prefixSq[lag];
    const denom = Math.sqrt(energyA * energyB);
    r[lag] = denom > 0 ? sum / denom : 0;
  }
  const rInterp = (lag: number) => {
    if (lag < minLag || lag > harmMaxLag) return 0;
    const i = Math.floor(lag);
    const frac = lag - i;
    const a = r[i];
    const b = i + 1 <= harmMaxLag ? r[i + 1] : r[i];
    return a + (b - a) * frac;
  };

  // Preferência suave por andamentos centrais (reduz erros de oitava)
  const tempoPref = (b: number) => Math.exp(-0.5 * (Math.log2(b / 120) / 0.9) ** 2);
  const combWeights = [1, 0.5, 0.34, 0.25];

  // Grade de BPM (passo 1) — calcula ACF (pente) e tempograma (DFT)
  const bpmMin = SEARCH_MIN;
  const bpmMax = SEARCH_MAX;
  const gridLen = bpmMax - bpmMin + 1;
  const bpms = new Float32Array(gridLen);
  const acf = new Float32Array(gridLen);
  const tg = new Float32Array(gridLen);

  for (let gi = 0; gi < gridLen; gi++) {
    const bpm = bpmMin + gi;
    bpms[gi] = bpm;
    const lag = (envRate * 60) / bpm;
    // Autocorrelação com pente de harmônicos
    let comb = 0;
    for (let k = 0; k < combWeights.length; k++) comb += combWeights[k] * rInterp(lag * (k + 1));
    acf[gi] = Math.max(0, comb);
    // Tempograma: magnitude da DFT da envelope na frequência do andamento
    tg[gi] = dftMag(env, bpm / 60, envRate);
  }

  normalizeInPlace(acf);
  normalizeInPlace(tg);

  // Consenso
  const combined = new Float32Array(gridLen);
  for (let gi = 0; gi < gridLen; gi++) {
    combined[gi] = (0.6 * acf[gi] + 0.4 * tg[gi]) * tempoPref(bpms[gi]);
  }

  // Pico principal
  let bestIdx = 0;
  for (let gi = 1; gi < gridLen; gi++) if (combined[gi] > combined[bestIdx]) bestIdx = gi;

  // Refino parabólico (em BPM)
  let bpm = bpms[bestIdx];
  if (bestIdx > 0 && bestIdx < gridLen - 1) {
    const a = combined[bestIdx - 1];
    const b = combined[bestIdx];
    const c = combined[bestIdx + 1];
    const denom = a - 2 * b + c;
    if (denom !== 0) {
      const delta = (0.5 * (a - c)) / denom;
      if (delta > -1 && delta < 1) bpm = bpms[bestIdx] + delta;
    }
  }
  bpm = clampBpm(bpm);

  // ── Estatísticas da curva de consenso (para a proeminência) ─────────────────
  let cMean = 0;
  for (let gi = 0; gi < gridLen; gi++) cMean += combined[gi];
  cMean /= gridLen;
  let cVar = 0;
  for (let gi = 0; gi < gridLen; gi++) {
    const d = combined[gi] - cMean;
    cVar += d * d;
  }
  const cStd = Math.sqrt(cVar / gridLen);
  const gridIdxFor = (b: number) =>
    Math.max(0, Math.min(gridLen - 1, Math.round(b - bpmMin)));

  // Confiança calculada para um BPM específico (depende do lag desse BPM)
  const confidenceFor = (b: number): { confidence: number; finalLag: number } => {
    const lag = (envRate * 60) / b;
    const acfPeak = Math.max(0, rInterp(lag));
    const z = cStd > 0 ? (combined[gridIdxFor(b)] - cMean) / cStd : 0;
    const peakScaled = clamp01(acfPeak / 0.4);
    const prominence = z > 0 ? z / (z + 4) : 0;
    const clarity = clamp01(
      (acfPeak + Math.max(0, rInterp(lag * 2)) + Math.max(0, rInterp(lag * 3))) / 1.6,
    );
    return {
      confidence: clamp01(0.45 * peakScaled + 0.3 * prominence + 0.45 * clarity),
      finalLag: lag,
    };
  };

  let { confidence, finalLag } = confidenceFor(bpm);

  // ── Candidatos (até 5) ──────────────────────────────────────────────────────
  const candidates = buildCandidates(combined, bpms, bpm);

  // ── Heurística musical p/ baixa confiança ───────────────────────────────────
  if (confidence < 0.7) {
    const corrected = applyMusicalHeuristic(bpm, candidates, combined, bpms);
    if (corrected !== bpm) {
      bpm = corrected;
      // recoloca o BPM corrigido como principal na lista
      const idx = candidates.indexOf(corrected);
      if (idx > 0) {
        candidates.splice(idx, 1);
        candidates.unshift(corrected);
      } else if (idx < 0) {
        candidates.unshift(corrected);
        if (candidates.length > 5) candidates.pop();
      }
      // Recalcula lag e confiança para o BPM corrigido (mantém tudo consistente)
      ({ confidence, finalLag } = confidenceFor(bpm));
    }
  }

  const timeSignature = guessMeter(rInterp, finalLag, confidence);

  return { bpm, confidence, timeSignature, env };
}

// ── Onsets + validação por oitava (métricas por opção) ────────────────────────

// Picos da envelope processada (candidatos a batidas).
function pickOnsets(env: Float32Array): { idx: number; strength: number }[] {
  const n = env.length;
  if (n < 3) return [];
  let mean = 0;
  for (let i = 0; i < n; i++) mean += env[i];
  mean /= n;
  let varr = 0;
  for (let i = 0; i < n; i++) {
    const d = env[i] - mean;
    varr += d * d;
  }
  const std = Math.sqrt(varr / n);
  const thr = mean + 0.5 * std;
  const peaks: { idx: number; strength: number }[] = [];
  for (let i = 1; i < n - 1; i++) {
    if (env[i] > thr && env[i] >= env[i - 1] && env[i] > env[i + 1]) {
      peaks.push({ idx: i, strength: env[i] });
    }
  }
  return peaks;
}

// Avalia o quanto uma grade de batidas em `bpm` se encaixa nos onsets do trecho.
function evaluateCandidate(
  onsets: { idx: number; strength: number }[],
  envRate: number,
  bpm: number,
  totalFrames: number,
): { metrics: BpmMetrics; confidence: number; phaseFrames: number } {
  const empty = {
    metrics: { regularity: 0, meanErrorMs: 0, stability: 0, beatCount: 0 },
    confidence: 0,
    phaseFrames: 0,
  };
  const T = (envRate * 60) / bpm; // quadros por batida
  if (!(T >= 2) || onsets.length < 2 || totalFrames < T * 2) return empty;
  const tol = T / 2;
  const idxs = onsets.map((o) => o.idx);

  // Índice do onset mais próximo de `pos` (busca binária)
  const nearest = (pos: number): number => {
    const hi = idxs.length - 1;
    if (pos <= idxs[0]) return 0;
    if (pos >= idxs[hi]) return hi;
    let lo = 0;
    let h = hi;
    while (lo < h) {
      const mid = (lo + h) >> 1;
      if (idxs[mid] < pos) lo = mid + 1;
      else h = mid;
    }
    if (lo > 0 && pos - idxs[lo - 1] <= idxs[lo] - pos) return lo - 1;
    return lo;
  };

  // Busca da melhor fase (offset) que maximiza a força casada
  const step = Math.max(1, Math.round(T / 24));
  let bestPhase = 0;
  let bestScore = -1;
  for (let p = 0; p < T; p += step) {
    let score = 0;
    for (let g = p; g <= totalFrames - 1; g += T) {
      const oi = nearest(g);
      if (Math.abs(idxs[oi] - g) <= tol) score += onsets[oi].strength;
    }
    if (score > bestScore) {
      bestScore = score;
      bestPhase = p;
    }
  }

  // Métricas na melhor fase
  let matched = 0;
  let total = 0;
  let devSum = 0;
  const devs: number[] = [];
  for (let g = bestPhase; g <= totalFrames - 1; g += T) {
    total++;
    const oi = nearest(g);
    const dev = Math.abs(idxs[oi] - g);
    if (dev <= tol) {
      matched++;
      devSum += dev;
      devs.push(dev);
    }
  }
  if (total === 0) return empty;

  const regularity = matched / total;
  const meanDev = matched > 0 ? devSum / matched : tol;
  const meanErrorMs = (meanDev * 1000) / envRate;
  let sdDev = 0;
  if (devs.length > 1) {
    let v = 0;
    for (const d of devs) v += (d - meanDev) ** 2;
    sdDev = Math.sqrt(v / devs.length);
  }
  const stability = clamp01(1 - sdDev / (T * 0.5));
  const errNorm = clamp01(meanErrorMs / ((60000 / bpm) * 0.25));
  const confidence = clamp01(0.5 * regularity + 0.3 * stability + 0.2 * (1 - errNorm));

  return {
    metrics: { regularity, meanErrorMs, stability, beatCount: matched },
    confidence,
    phaseFrames: bestPhase,
  };
}

// Monta exatamente 3 opções: metade, principal (detectado) e dobro.
function buildOptions(
  env: Float32Array,
  envRate: number,
  detectedBpm: number,
  onsets: { idx: number; strength: number }[],
): BpmOption[] {
  const total = env.length;
  const defs: { bpm: number; relation: BpmRelation }[] = [
    { bpm: clampBpm(detectedBpm / 2), relation: "metade" },
    { bpm: clampBpm(detectedBpm), relation: "principal" },
    { bpm: clampBpm(detectedBpm * 2), relation: "dobro" },
  ];
  return defs.map(({ bpm, relation }) => {
    const ev = evaluateCandidate(onsets, envRate, bpm, total);
    return {
      bpm,
      relation,
      confidence: ev.confidence,
      phaseSec: ev.phaseFrames / envRate,
      metrics: ev.metrics,
    };
  });
}

// Escolhe a opção recomendada combinando as métricas de cada opção com uma
// preferência por andamentos centrais (evita o viés de oitava — grades lentas
// "casam" mais onsets). Mantém leve preferência pelo BPM principal (consenso).
function pickRecommended(options: BpmOption[]): number {
  const pref = (b: number) => Math.exp(-0.5 * (Math.log2(b / 120) / 0.9) ** 2);
  let best = 1;
  let bestScore = -1;
  for (let i = 0; i < options.length; i++) {
    const o = options[i];
    if (!(o.bpm > 0)) continue;
    const base = o.confidence * pref(o.bpm);
    const adj = i === 1 ? base * 1.08 : base; // desempate a favor do principal
    if (adj > bestScore) {
      bestScore = adj;
      best = i;
    }
  }
  return best;
}

// DFT (uma raia) — magnitude da envelope na frequência dada (Hz)
function dftMag(env: Float32Array, freqHz: number, envRate: number): number {
  const w = (2 * Math.PI * freqHz) / envRate;
  let re = 0;
  let im = 0;
  for (let n = 0; n < env.length; n++) {
    const a = w * n;
    re += env[n] * Math.cos(a);
    im -= env[n] * Math.sin(a);
  }
  return Math.hypot(re, im) / env.length;
}

function normalizeInPlace(arr: Float32Array): void {
  let max = 0;
  for (let i = 0; i < arr.length; i++) if (arr[i] > max) max = arr[i];
  if (max > 0) for (let i = 0; i < arr.length; i++) arr[i] /= max;
}

// Monta lista de candidatos: principal + picos fortes + metade/dobro (até 5)
function buildCandidates(
  combined: Float32Array,
  bpms: Float32Array,
  principal: number,
): number[] {
  const peaks: { bpm: number; score: number }[] = [];
  for (let gi = 1; gi < combined.length - 1; gi++) {
    if (combined[gi] > combined[gi - 1] && combined[gi] >= combined[gi + 1]) {
      peaks.push({ bpm: Math.round(bpms[gi]), score: combined[gi] });
    }
  }
  peaks.sort((a, b) => b.score - a.score);

  const list: number[] = [principal];
  const near = (v: number) => list.some((x) => Math.abs(x - v) <= 2);

  for (const p of peaks) {
    if (list.length >= 5) break;
    if (!near(p.bpm)) list.push(p.bpm);
  }

  // Garante metade e dobro
  const half = clampBpm(principal / 2);
  const dbl = clampBpm(principal * 2);
  for (const extra of [half, dbl]) {
    if (list.length >= 5) break;
    if (!near(extra)) list.push(extra);
  }

  return list.slice(0, 5);
}

// Ajuste leve: em baixa confiança, prefere um candidato dentro de faixas comuns
function applyMusicalHeuristic(
  bpm: number,
  candidates: number[],
  combined: Float32Array,
  bpms: Float32Array,
): number {
  const COMMON_MIN = 70;
  const COMMON_MAX = 150; // faixa mais provável da maioria das músicas
  if (bpm >= COMMON_MIN && bpm <= COMMON_MAX) return bpm;

  // Procura uma versão (metade/dobro/candidato) dentro da faixa comum com bom score
  const scoreOf = (b: number) => {
    let bestIdx = 0;
    let bestD = Infinity;
    for (let gi = 0; gi < bpms.length; gi++) {
      const d = Math.abs(bpms[gi] - b);
      if (d < bestD) {
        bestD = d;
        bestIdx = gi;
      }
    }
    return combined[bestIdx];
  };

  const options = new Set<number>([
    ...candidates,
    clampBpm(bpm * 2),
    clampBpm(bpm / 2),
  ]);
  let best = bpm;
  let bestScore = scoreOf(bpm) * 1.15; // exige que a alternativa seja claramente melhor
  for (const opt of options) {
    if (opt >= COMMON_MIN && opt <= COMMON_MAX) {
      const s = scoreOf(opt);
      if (s > bestScore) {
        bestScore = s;
        best = opt;
      }
    }
  }
  return best;
}

// ── Grade de batidas global (BPM preciso + fase) ──────────────────────────────

export interface BeatGrid {
  bpm: number; // BPM preciso (não arredondado) — usado pelo metrônomo
  bpmRounded: number; // BPM arredondado — apenas para exibição
  beatOffsetSec: number; // posição da batida 0 no tempo da música (s), 0 ≤ offset < duração da batida
  timeSignature: DetectedTimeSignature | null;
  confidence: number; // 0..1
}

/**
 * Calcula uma grade de batidas para a MÚSICA INTEIRA: um BPM preciso (sem
 * arredondar) e a fase (posição da 1ª batida). Isso é o que mantém o clique
 * "colado" na música do começo ao fim:
 *
 *  - A fase elimina o erro constante (a batida 1 quase nunca cai em t=0; há
 *    introdução/levada antes).
 *  - O BPM preciso (em vez de inteiro) evita o arrasto que se acumula ao longo
 *    de vários minutos quando o andamento é arredondado.
 *
 * A busca casa uma grade (BPM × fase) aos onsets de toda a faixa, premiando o
 * encaixe apertado — então o melhor BPM é aquele cujo pulso continua alinhado
 * até o fim, não só nos primeiros segundos.
 *
 * `bpmHint`/`tsHint` (quando conhecidos) fixam a oitava do andamento e o
 * compasso; a busca refina em ±1,2% em torno da dica.
 */
export async function computeBeatGrid(
  buffer: AudioBuffer,
  bpmHint?: number | null,
  tsHint?: DetectedTimeSignature | null,
): Promise<BeatGrid | null> {
  const sampleRate = buffer.sampleRate;
  if (buffer.length < sampleRate) return null;

  // 1. Bandas + envelope de onsets — sobre o áudio INTEIRO (não só um trecho)
  let lowBand: Float32Array;
  let midBand: Float32Array | null;
  try {
    [lowBand, midBand] = await Promise.all([
      renderBand(buffer, 50, 300),
      renderBand(buffer, 1000, 4000),
    ]);
  } catch {
    lowBand = downmix(buffer);
    midBand = null;
  }
  const envLow = fluxEnvelope(lowBand, FRAME, HOP);
  const envMid = midBand ? fluxEnvelope(midBand, FRAME, HOP) : new Float32Array(envLow.length);
  const n = Math.min(envLow.length, envMid.length);
  if (n < 32) return null;
  const rawEnv = new Float32Array(n);
  for (let i = 0; i < n; i++) rawEnv[i] = envLow[i] + 0.5 * envMid[i];
  const envRate = sampleRate / HOP;

  // 2. BPM base e compasso: usa as dicas quando válidas; senão detecta.
  let baseBpm = typeof bpmHint === "number" && bpmHint > 0 ? bpmHint : 0;
  let ts: DetectedTimeSignature | null = tsHint ?? null;
  if (baseBpm <= 0 || ts === null) {
    const seg = selectSegment(rawEnv, envRate);
    const det = detectTempo(rawEnv.subarray(seg.startFrame, seg.endFrame), envRate);
    if (det) {
      if (baseBpm <= 0) baseBpm = det.bpm;
      if (ts === null) ts = det.timeSignature;
    }
  }
  if (baseBpm <= 0) return null;

  // 3. Onsets sobre a faixa inteira (envelope com média removida + retificada).
  const env = Float32Array.from(rawEnv);
  let mean = 0;
  for (let i = 0; i < n; i++) mean += env[i];
  mean /= n;
  for (let i = 0; i < n; i++) env[i] = Math.max(0, env[i] - mean);
  const onsets = pickOnsets(env);

  if (onsets.length < 4) {
    // Sem onsets confiáveis: grade só com o BPM informado, fase neutra.
    return {
      bpm: baseBpm,
      bpmRounded: clampBpm(baseBpm),
      beatOffsetSec: 0,
      timeSignature: ts,
      confidence: 0.2,
    };
  }

  const idxs = onsets.map((o) => o.idx);
  const strengths = onsets.map((o) => o.strength);
  const hi = idxs.length - 1;
  const nearest = (pos: number): number => {
    if (pos <= idxs[0]) return 0;
    if (pos >= idxs[hi]) return hi;
    let lo = 0;
    let h = hi;
    while (lo < h) {
      const mid = (lo + h) >> 1;
      if (idxs[mid] < pos) lo = mid + 1;
      else h = mid;
    }
    if (lo > 0 && pos - idxs[lo - 1] <= idxs[lo] - pos) return lo - 1;
    return lo;
  };

  const totalFrames = n;

  // Pontuação de uma grade num dado BPM: melhor fase casando os onsets de toda
  // a faixa, ponderada pela proximidade (encaixe apertado vale mais). Como o
  // erro de um BPM errado cresce ao longo da música, o BPM certo é o que mantém
  // a pontuação alta até o fim.
  const PHASE_STEPS = 48;
  const scoreForBpm = (bpm: number): { score: number; phaseFrames: number } => {
    const T = (envRate * 60) / bpm; // quadros por batida
    if (!(T >= 2) || totalFrames < T * 2) return { score: -1, phaseFrames: 0 };
    const tol = T * 0.18;
    let bestPhase = 0;
    let bestScore = -1;
    for (let s = 0; s < PHASE_STEPS; s++) {
      const p = (s * T) / PHASE_STEPS;
      let sc = 0;
      for (let g = p; g <= totalFrames - 1; g += T) {
        const oi = nearest(g);
        const d = Math.abs(idxs[oi] - g);
        if (d <= tol) sc += strengths[oi] * (1 - d / tol);
      }
      if (sc > bestScore) {
        bestScore = sc;
        bestPhase = p;
      }
    }
    return { score: bestScore, phaseFrames: bestPhase };
  };

  // 4. Busca fina do BPM em ±1,2% em torno da base (preserva a oitava).
  let best = { bpm: baseBpm, score: -1, phaseFrames: 0 };
  const span = baseBpm * 0.012;
  const stepBpm = 0.05;
  for (let b = baseBpm - span; b <= baseBpm + span + 1e-9; b += stepBpm) {
    if (b <= 0) continue;
    const { score, phaseFrames } = scoreForBpm(b);
    if (score > best.score) best = { bpm: b, score, phaseFrames };
  }

  const spb = 60 / best.bpm;
  let offsetSec = best.phaseFrames / envRate;
  offsetSec = ((offsetSec % spb) + spb) % spb; // 0 ≤ offset < duração da batida

  return {
    bpm: best.bpm,
    bpmRounded: clampBpm(best.bpm),
    beatOffsetSec: offsetSec,
    timeSignature: ts,
    confidence: best.score > 0 ? 0.6 : 0.2,
  };
}

/**
 * Sugere o compasso comparando a força da acentuação a cada 3 ou 4 tempos.
 * Retorna null quando a diferença é pequena demais para confiar.
 */
function guessMeter(
  rInterp: (lag: number) => number,
  beatLag: number,
  beatConfidence: number,
): DetectedTimeSignature | null {
  if (beatConfidence < 0.2) return null;

  const s2 = rInterp(beatLag * 2);
  const s3 = rInterp(beatLag * 3);
  const s4 = rInterp(beatLag * 4);
  if (s3 <= 0 && s4 <= 0) return null;

  const four = Math.max(s4, s2 * 0.9);
  const three = s3;

  if (four >= three * 1.12) return "4/4";
  if (three >= four * 1.12) return "3/4";
  return null;
}
