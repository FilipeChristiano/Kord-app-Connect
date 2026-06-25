// ─────────────────────────────────────────────────────────────────────────────
// Web Worker do estúdio de áudio.
//
// A separação por centro (STFT) é pesada. Rodá-la aqui, fora da thread principal,
// evita travar/congelar a interface no aparelho do usuário e deixa o processamento
// mais rápido (sem precisar ceder a CPU para a UI a cada quadro).
//
// A decodificação do áudio (Web Audio) acontece na thread principal; aqui só
// recebemos as amostras já decodificadas (canais L/R) e devolvemos o resultado.
// Suporta os dois modos: "vocals" (voz em destaque, mono) e "instrumental"
// ("sem voz", estéreo).
// ─────────────────────────────────────────────────────────────────────────────

import { separateCore, type Channels, type SeparationMode } from "./audio-dsp";

interface RequestMessage {
  id: number;
  mode: SeparationMode;
  L: Float32Array;
  R: Float32Array;
  n: number;
  sampleRate: number;
}

type ResponseMessage =
  | { id: number; type: "progress"; value: number }
  | {
      id: number;
      type: "done";
      samples: Float32Array;
      samplesR?: Float32Array;
      sampleRate: number;
    }
  | { id: number; type: "error"; message: string };

self.onmessage = (e: MessageEvent<RequestMessage>) => {
  const { id, mode, L, R, n, sampleRate } = e.data;
  try {
    const ch: Channels = { L, R, n, sampleRate };
    const result = separateCore(ch, mode, (value) => {
      const msg: ResponseMessage = { id, type: "progress", value };
      (self as unknown as Worker).postMessage(msg);
    });
    const transfer: Transferable[] = [result.samples.buffer];
    if (result.samplesR) transfer.push(result.samplesR.buffer);
    const done: ResponseMessage = {
      id,
      type: "done",
      samples: result.samples,
      samplesR: result.samplesR,
      sampleRate: result.sampleRate,
    };
    (self as unknown as Worker).postMessage(done, transfer);
  } catch (err) {
    const msg: ResponseMessage = {
      id,
      type: "error",
      message: err instanceof Error ? err.message : "erro",
    };
    (self as unknown as Worker).postMessage(msg);
  }
};
