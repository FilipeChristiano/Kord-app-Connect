export type DetectedTimeSignature = "3/4" | "4/4";

export interface BpmAnalysis {
  bpm: number;
  confidence: number; // 0..1
  alternatives: number[]; // [metade, detectado, dobro]
  timeSignature: DetectedTimeSignature | null;
}

const MIN_BPM_OUT = 40;
const MAX_BPM_OUT = 240;
const clampBpm = (v: number) => Math.max(MIN_BPM_OUT, Math.min(MAX_BPM_OUT, Math.round(v)));
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const EMPTY: BpmAnalysis = { bpm: 0, confidence: 0, alternatives: [], timeSignature: null };

/**
 * Detecta o BPM aproximado de um AudioBuffer usando uma envelope de onsets
 * (fluxo de energia com compressão logarítmica) seguida de autocorrelação
 * normalizada com reforço por harmônicos. A confiança reflete o quão claro e
 * periódico é o pulso encontrado.
 */
export function analyzeBpm(buffer: AudioBuffer): BpmAnalysis {
  const sampleRate = buffer.sampleRate;
  const length = buffer.length;
  if (length < sampleRate) return EMPTY; // curto demais

  // ── Downmix para mono ──────────────────────────────────────────────────────
  const channels = buffer.numberOfChannels;
  const mono = new Float32Array(length);
  for (let c = 0; c < channels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < length; i++) mono[i] += data[i] / channels;
  }

  // ── Envelope de onsets ─────────────────────────────────────────────────────
  // Fluxo de energia positivo. A compressão logarítmica equilibra batidas
  // fortes e fracas, ajudando a detectar o pulso em áudios bem produzidos.
  const frame = 1024;
  const hop = 256; // resolução fina (~5,8 ms a 44,1 kHz) para BPM altos
  const numFrames = Math.floor((length - frame) / hop);
  if (numFrames < 16) return EMPTY;

  const env = new Float32Array(numFrames);
  let prevEnergy = 0;
  for (let f = 0; f < numFrames; f++) {
    const start = f * hop;
    let energy = 0;
    for (let i = 0; i < frame; i++) {
      const s = mono[start + i];
      energy += s * s;
    }
    energy = Math.log1p(Math.sqrt(energy / frame) * 1000);
    env[f] = Math.max(0, energy - prevEnergy);
    prevEnergy = energy;
  }

  // Remove a média (foco nas variações = onsets)
  let mean = 0;
  for (let i = 0; i < numFrames; i++) mean += env[i];
  mean /= numFrames;
  for (let i = 0; i < numFrames; i++) env[i] = Math.max(0, env[i] - mean);

  // Energia acumulada para normalizar a autocorrelação por lag (estilo Pearson)
  const prefixSq = new Float64Array(numFrames + 1);
  for (let i = 0; i < numFrames; i++) prefixSq[i + 1] = prefixSq[i] + env[i] * env[i];
  if (prefixSq[numFrames] <= 0) return EMPTY;

  const envRate = sampleRate / hop; // quadros por segundo

  // ── Autocorrelação normalizada ─────────────────────────────────────────────
  const minBpm = 55;
  const maxBpm = 210;
  const minLag = Math.max(2, Math.floor((envRate * 60) / maxBpm));
  const maxLag = Math.min(numFrames - 2, Math.ceil((envRate * 60) / minBpm));
  if (maxLag <= minLag) return EMPTY;

  // Calcula r() até 4x maxLag para conseguir somar harmônicos (pente)
  const harmMaxLag = Math.min(numFrames - 2, maxLag * 4);
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
  const rAt = (lag: number) =>
    lag >= minLag && lag <= harmMaxLag ? r[lag] : 0;

  // Preferência suave por andamentos centrais (reduz erros de oitava)
  const tempoPref = (b: number) => {
    const x = Math.log2(b / 120);
    return Math.exp(-0.5 * (x / 0.9) ** 2);
  };

  // ── Seleção do melhor lag por pente de harmônicos ──────────────────────────
  // Soma r() no lag e em seus múltiplos: realça o pulso fundamental e evita
  // escolher metade do andamento.
  const combWeights = [1, 0.5, 0.34, 0.25];
  let bestLag = minLag;
  let bestScore = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let comb = 0;
    for (let k = 0; k < combWeights.length; k++) {
      comb += combWeights[k] * rAt(lag * (k + 1));
    }
    const bpmCand = (60 * envRate) / lag;
    const score = comb * tempoPref(bpmCand);
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }
  if (rAt(bestLag) <= 0) return EMPTY;

  // Refina o pico por interpolação parabólica sobre r()
  let refinedLag = bestLag;
  if (bestLag > minLag && bestLag < maxLag) {
    const a = r[bestLag - 1];
    const b = r[bestLag];
    const c = r[bestLag + 1];
    const denom = a - 2 * b + c;
    if (denom !== 0) {
      const delta = (0.5 * (a - c)) / denom;
      if (delta > -1 && delta < 1) refinedLag = bestLag + delta;
    }
  }

  const bpm = clampBpm((60 * envRate) / refinedLag);

  // ── Confiança ──────────────────────────────────────────────────────────────
  // Combina três sinais: altura do pico, proeminência sobre o ruído da ACF e
  // clareza dos harmônicos (quão bem 2x/3x do pulso também correlacionam).
  const peak = rAt(bestLag);

  let m = 0;
  let count = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    m += r[lag];
    count++;
  }
  m /= count || 1;
  let variance = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    const d = r[lag] - m;
    variance += d * d;
  }
  variance /= count || 1;
  const std = Math.sqrt(variance);
  const z = std > 0 ? (peak - m) / std : 0;

  const peakScaled = clamp01(peak / 0.45);
  const prominence = z > 0 ? z / (z + 4) : 0;
  const clarity = clamp01(
    (peak + Math.max(0, rAt(bestLag * 2)) + Math.max(0, rAt(bestLag * 3))) / 1.6,
  );
  const confidence = clamp01(0.4 * peakScaled + 0.35 * prominence + 0.4 * clarity);

  // Alternativas de oitava (metade / detectado / dobro)
  const half = clampBpm(bpm / 2);
  const dbl = clampBpm(bpm * 2);
  const alternatives = Array.from(new Set([half, bpm, dbl]));

  const timeSignature = guessMeter(rAt, bestLag, confidence);

  return { bpm, confidence, alternatives, timeSignature };
}

/**
 * Tenta sugerir o compasso comparando a força da acentuação a cada 3 ou 4
 * tempos. Retorna null quando a diferença é pequena demais para confiar.
 */
function guessMeter(
  rAt: (lag: number) => number,
  beatLag: number,
  beatConfidence: number,
): DetectedTimeSignature | null {
  if (beatConfidence < 0.2) return null;

  const s2 = rAt(beatLag * 2);
  const s3 = rAt(beatLag * 3);
  const s4 = rAt(beatLag * 4);
  if (s3 <= 0 && s4 <= 0) return null;

  // 4/4 quando o agrupamento de 4 (ou 2) domina; 3/4 quando o de 3 domina.
  const four = Math.max(s4, s2 * 0.9);
  const three = s3;

  if (four >= three * 1.12) return "4/4";
  if (three >= four * 1.12) return "3/4";
  return null;
}
