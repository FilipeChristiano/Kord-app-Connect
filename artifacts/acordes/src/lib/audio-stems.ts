// ─────────────────────────────────────────────────────────────────────────────
// Estúdio de áudio — separação simples de voz/instrumental NO NAVEGADOR.
//
// Roda 100% local (Web Audio), sem custo e sem plataforma externa. É um EFEITO,
// não uma separação de estúdio com IA:
//   • "Sem voz" (instrumental/karaokê): cancela o que está no CENTRO da mixagem
//     (geralmente a voz) subtraindo os canais (L−R). Para tocar ao vivo/instantâneo
//     usamos nós nativos do Web Audio (ver audio-live.ts); aqui ficou só a versão
//     offline usada para gerar o arquivo de download.
//   • "Voz em destaque": realça o centro com uma máscara no domínio da frequência
//     (STFT). É o efeito mais pesado, então roda num Web Worker (fora da thread
//     principal) para não travar o aparelho.
//
// Para download, geramos um WAV PCM16.
// ─────────────────────────────────────────────────────────────────────────────

import { decodeAudioFile } from "./audio-analysis";
import {
  emphasizeVocalsCore,
  makeInstrumentalCore,
  type Channels,
  type DspResult,
} from "./audio-dsp";

export type StemResult = DspResult;

// Erro específico: o cancelamento de centro precisa de uma faixa ESTÉREO. Em um
// áudio mono (ex.: uma gravação de microfone) não há o que cancelar.
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

// ── Sem voz (instrumental), versão offline para download ─────────────────────
export function makeInstrumental(buffer: AudioBuffer): StemResult {
  if (buffer.numberOfChannels < 2) throw new MonoSourceError();
  return makeInstrumentalCore(channelsOf(buffer));
}

// ── Voz em destaque (offline, na própria thread) ─────────────────────────────
// Mantida como fallback caso o Worker não esteja disponível.
export function emphasizeVocals(
  buffer: AudioBuffer,
  onProgress?: (p: number) => void,
): StemResult {
  return emphasizeVocalsCore(channelsOf(buffer), onProgress);
}

// ── Voz em destaque FORA da thread principal (Web Worker) ────────────────────
// Decodifica na thread principal (Web Audio exige) e envia só as amostras para o
// Worker processar. Assim a interface não congela e o processamento é mais rápido.
export function emphasizeVocalsViaWorker(
  buffer: AudioBuffer,
  onProgress?: (p: number) => void,
): { promise: Promise<StemResult>; cancel: () => void } {
  if (buffer.numberOfChannels < 2) {
    return {
      promise: Promise.reject(new MonoSourceError()),
      cancel: () => {},
    };
  }

  // Sem suporte a Worker: cai para o processamento na própria thread.
  if (typeof Worker === "undefined") {
    return {
      promise: Promise.resolve(emphasizeVocals(buffer, onProgress)),
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
        | { id: number; type: "done"; samples: Float32Array; sampleRate: number }
        | { id: number; type: "error"; message: string };
      if (data.id !== id) return;
      if (data.type === "progress") {
        onProgress?.(data.value);
      } else if (data.type === "done") {
        resolve({ samples: data.samples, sampleRate: data.sampleRate });
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
      { id, L, R, n: ch.n, sampleRate: ch.sampleRate },
      [L.buffer, R.buffer],
    );
  });

  return { promise, cancel: () => worker.terminate() };
}

// ── WAV PCM16 (mono) para download/preview ───────────────────────────────────
export function encodeWav(stem: StemResult): Blob {
  const { samples, sampleRate } = stem;
  const numSamples = samples.length;
  const blockAlign = 2; // mono * 16 bits
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    let s = samples[i];
    if (s > 1) s = 1;
    else if (s < -1) s = -1;
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return new Blob([buffer], { type: "audio/wav" });
}
