// ─────────────────────────────────────────────────────────────────────────────
// Estúdio de áudio — separação de voz/instrumental NO NAVEGADOR.
//
// Roda 100% local (Web Audio), sem custo e sem plataforma externa. É um EFEITO,
// não uma separação de estúdio com IA, mas usa uma máscara suave no domínio da
// frequência (ver audio-dsp.ts) que separa o CENTRO da mixagem (geralmente a voz)
// do que está panoramizado (instrumentos):
//   • "Sem voz" (instrumental): tira a voz central de cada canal, mantendo o
//     ESTÉREO e os instrumentos. Para tocar ao vivo/instantâneo usamos nós nativos
//     do Web Audio (ver audio-live.ts); aqui fica a versão offline de alta
//     qualidade usada para gerar o arquivo de download.
//   • "Voz em destaque": realça o centro com a mesma máscara (saída mono).
// Ambos os modos são pesados, então rodam num Web Worker (fora da thread
// principal) para não travar o aparelho.
//
// Para download, geramos um WAV PCM16 (estéreo no instrumental, mono na voz).
// ─────────────────────────────────────────────────────────────────────────────

import { decodeAudioFile } from "./audio-analysis";
import {
  emphasizeVocalsCore,
  makeInstrumentalCore,
  separateCore,
  type Channels,
  type DspResult,
  type SeparationMode,
} from "./audio-dsp";

export type StemResult = DspResult;

// Erro específico: a separação por centro precisa de uma faixa ESTÉREO. Em um
// áudio mono (ex.: uma gravação de microfone) não há centro a separar.
export class MonoSourceError extends Error {
  constructor() {
    super("mono");
    this.name = "MonoSourceError";
  }
}

export async function fileToAudioBuffer(file: File): Promise<AudioBuffer> {
  const data = await file.arrayBuffer();
  return decodeAudioFile(data);
}

function channelsOf(buffer: AudioBuffer): Channels {
  const L = buffer.getChannelData(0);
  const R = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : L;
  return { L, R, n: Math.min(L.length, R.length), sampleRate: buffer.sampleRate };
}

// Detecta áudio "estéreo falso" (dois canais praticamente idênticos): aí não há
// imagem estéreo para separar o centro, então tratamos como mono.
function isEffectivelyMono(buffer: AudioBuffer): boolean {
  if (buffer.numberOfChannels < 2) return true;
  const L = buffer.getChannelData(0);
  const R = buffer.getChannelData(1);
  const n = Math.min(L.length, R.length);
  if (n === 0) return true;
  const step = Math.max(1, Math.floor(n / 20000)); // amostragem esparsa
  let diff = 0;
  let energy = 0;
  for (let i = 0; i < n; i += step) {
    const d = L[i] - R[i];
    diff += d * d;
    energy += L[i] * L[i] + R[i] * R[i];
  }
  if (energy <= 1e-9) return true;
  // Diferença L−R com menos de ~0,1% da energia → canais quase idênticos.
  return diff / energy < 1e-3;
}

// ── Sem voz (instrumental), versão RÁPIDA offline (fallback) ─────────────────
export function makeInstrumental(buffer: AudioBuffer): StemResult {
  if (isEffectivelyMono(buffer)) throw new MonoSourceError();
  return makeInstrumentalCore(channelsOf(buffer));
}

// ── Voz em destaque (offline, na própria thread) — fallback sem Worker ───────
export function emphasizeVocals(
  buffer: AudioBuffer,
  onProgress?: (p: number) => void,
): StemResult {
  return emphasizeVocalsCore(channelsOf(buffer), onProgress);
}

// ── Separação FORA da thread principal (Web Worker) ──────────────────────────
// Decodifica na thread principal (Web Audio exige) e envia só as amostras para o
// Worker processar. Assim a interface não congela e o processamento é mais rápido.
export function separateViaWorker(
  buffer: AudioBuffer,
  mode: SeparationMode,
  onProgress?: (p: number) => void,
): { promise: Promise<StemResult>; cancel: () => void } {
  if (isEffectivelyMono(buffer)) {
    return { promise: Promise.reject(new MonoSourceError()), cancel: () => {} };
  }

  // Sem suporte a Worker: cai para o processamento na própria thread.
  if (typeof Worker === "undefined") {
    return {
      promise: Promise.resolve(separateCore(channelsOf(buffer), mode, onProgress)),
      cancel: () => {},
    };
  }

  const ch = channelsOf(buffer);
  // Copia os canais para ArrayBuffers transferíveis (getChannelData devolve uma
  // view do AudioBuffer, que não pode ser transferida com segurança).
  const L = new Float32Array(ch.L.subarray(0, ch.n));
  const R = new Float32Array(ch.R.subarray(0, ch.n));

  const worker = new Worker(new URL("./stem-worker.ts", import.meta.url), {
    type: "module",
  });
  const id = Math.floor(Math.random() * 1e9);

  const promise = new Promise<StemResult>((resolve, reject) => {
    worker.onmessage = (e: MessageEvent) => {
      const data = e.data as
        | { id: number; type: "progress"; value: number }
        | {
            id: number;
            type: "done";
            samples: Float32Array;
            samplesR?: Float32Array;
            sampleRate: number;
          }
        | { id: number; type: "error"; message: string };
      if (data.id !== id) return;
      if (data.type === "progress") {
        onProgress?.(data.value);
      } else if (data.type === "done") {
        resolve({
          samples: data.samples,
          samplesR: data.samplesR,
          sampleRate: data.sampleRate,
        });
        worker.terminate();
      } else {
        reject(new Error(data.message));
        worker.terminate();
      }
    };
    worker.onerror = (e) => {
      reject(new Error(e.message || "worker_error"));
      worker.terminate();
    };
    worker.postMessage(
      { id, mode, L, R, n: ch.n, sampleRate: ch.sampleRate },
      [L.buffer, R.buffer],
    );
  });

  return { promise, cancel: () => worker.terminate() };
}

// ── Voz em destaque FORA da thread principal (Web Worker) ────────────────────
export function emphasizeVocalsViaWorker(
  buffer: AudioBuffer,
  onProgress?: (p: number) => void,
): { promise: Promise<StemResult>; cancel: () => void } {
  return separateViaWorker(buffer, "vocals", onProgress);
}

// ── Sem voz (instrumental) de ALTA QUALIDADE, FORA da thread principal ───────
export function makeInstrumentalViaWorker(
  buffer: AudioBuffer,
  onProgress?: (p: number) => void,
): { promise: Promise<StemResult>; cancel: () => void } {
  return separateViaWorker(buffer, "instrumental", onProgress);
}

// ── WAV PCM16 (mono ou estéreo) para download/preview ────────────────────────
export function encodeWav(stem: StemResult): Blob {
  const { samples, samplesR, sampleRate } = stem;
  const stereo = !!samplesR;
  const numChannels = stereo ? 2 : 1;
  const numSamples = samples.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  const clampSample = (s: number) => {
    if (s > 1) s = 1;
    else if (s < -1) s = -1;
    return s < 0 ? s * 0x8000 : s * 0x7fff;
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    view.setInt16(offset, clampSample(samples[i]), true);
    offset += 2;
    if (stereo) {
      view.setInt16(offset, clampSample(samplesR![i]), true);
      offset += 2;
    }
  }
  return new Blob([buffer], { type: "audio/wav" });
}
