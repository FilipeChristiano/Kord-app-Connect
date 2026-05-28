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

/**
 * Detecta o BPM aproximado de um AudioBuffer usando uma envelope de onsets
 * (fluxo de energia) seguida de autocorrelação. É uma estimativa — funciona
 * melhor em trechos com batida bem marcada.
 */
export function analyzeBpm(buffer: AudioBuffer): BpmAnalysis {
  const sampleRate = buffer.sampleRate;
  const length = buffer.length;
  if (length < sampleRate) {
    // Áudio muito curto para análise confiável
    return { bpm: 0, confidence: 0, alternatives: [], timeSignature: null };
  }

  // ── Downmix para mono ──────────────────────────────────────────────────────
  const channels = buffer.numberOfChannels;
  const mono = new Float32Array(length);
  for (let c = 0; c < channels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < length; i++) mono[i] += data[i] / channels;
  }

  // ── Envelope de onsets (fluxo de energia positivo) ─────────────────────────
  const frame = 1024;
  const hop = 512;
  const numFrames = Math.floor((length - frame) / hop);
  if (numFrames < 8) {
    return { bpm: 0, confidence: 0, alternatives: [], timeSignature: null };
  }

  const env = new Float32Array(numFrames);
  let prevEnergy = 0;
  for (let f = 0; f < numFrames; f++) {
    const start = f * hop;
    let energy = 0;
    for (let i = 0; i < frame; i++) {
      const s = mono[start + i];
      energy += s * s;
    }
    energy = Math.sqrt(energy / frame);
    env[f] = Math.max(0, energy - prevEnergy);
    prevEnergy = energy;
  }

  // Remove a média (foco nas variações = onsets)
  let mean = 0;
  for (let i = 0; i < numFrames; i++) mean += env[i];
  mean /= numFrames;
  for (let i = 0; i < numFrames; i++) env[i] = Math.max(0, env[i] - mean);

  const envRate = sampleRate / hop; // quadros por segundo

  // ── Autocorrelação dentro da faixa de BPM ──────────────────────────────────
  const minBpm = 60;
  const maxBpm = 180;
  const minLag = Math.max(1, Math.floor((envRate * 60) / maxBpm));
  const maxLag = Math.min(numFrames - 1, Math.ceil((envRate * 60) / minBpm));

  const acf = new Float32Array(maxLag + 1);
  let bestLag = minLag;
  let bestVal = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    const limit = numFrames - lag;
    for (let i = 0; i < limit; i++) sum += env[i] * env[i + lag];
    sum /= limit; // normaliza pelo número de termos
    acf[lag] = sum;
    if (sum > bestVal) {
      bestVal = sum;
      bestLag = lag;
    }
  }

  if (bestVal <= 0) {
    return { bpm: 0, confidence: 0, alternatives: [], timeSignature: null };
  }

  // Refina o pico por interpolação parabólica
  let refinedLag = bestLag;
  if (bestLag > minLag && bestLag < maxLag) {
    const a = acf[bestLag - 1];
    const b = acf[bestLag];
    const c = acf[bestLag + 1];
    const denom = a - 2 * b + c;
    if (denom !== 0) {
      const delta = (0.5 * (a - c)) / denom;
      if (delta > -1 && delta < 1) refinedLag = bestLag + delta;
    }
  }

  let bpm = clampBpm((60 * envRate) / refinedLag);

  // ── Confiança: pico relativo à média da autocorrelação ─────────────────────
  let acfMean = 0;
  let count = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    acfMean += acf[lag];
    count++;
  }
  acfMean /= count || 1;
  let confidence = acfMean > 0 ? (bestVal / acfMean - 1) / 3 : 0;
  confidence = Math.max(0, Math.min(1, confidence));

  // Alternativas de oitava (metade / detectado / dobro), limitadas à faixa do metrônomo
  const half = clampBpm(bpm / 2);
  const dbl = clampBpm(bpm * 2);
  const alternatives = Array.from(new Set([half, bpm, dbl]));

  const timeSignature = guessMeter(env, bestLag, confidence);

  return { bpm, confidence, alternatives, timeSignature };
}

function acfAt(env: Float32Array, lag: number): number {
  if (lag <= 0 || lag >= env.length) return 0;
  let sum = 0;
  const limit = env.length - lag;
  if (limit <= 0) return 0;
  for (let i = 0; i < limit; i++) sum += env[i] * env[i + lag];
  return sum / limit;
}

/**
 * Tenta sugerir o compasso comparando a força da acentuação a cada 3 ou 4
 * tempos. Retorna null quando a diferença é pequena demais para confiar.
 */
function guessMeter(
  env: Float32Array,
  beatLag: number,
  beatConfidence: number,
): DetectedTimeSignature | null {
  if (beatConfidence < 0.15) return null;

  const s2 = acfAt(env, beatLag * 2);
  const s3 = acfAt(env, beatLag * 3);
  const s4 = acfAt(env, beatLag * 4);
  if (s3 <= 0 && s4 <= 0) return null;

  // 4/4 quando o agrupamento de 4 (ou 2) domina; 3/4 quando o de 3 domina.
  const four = Math.max(s4, s2 * 0.9);
  const three = s3;

  if (four >= three * 1.12) return "4/4";
  if (three >= four * 1.12) return "3/4";
  return null;
}
