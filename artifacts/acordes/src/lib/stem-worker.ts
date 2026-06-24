// ─────────────────────────────────────────────────────────────────────────────
// Web Worker do estúdio de áudio.
//
// O efeito "voz em destaque" (STFT) é o mais pesado. Rodá-lo aqui, fora da thread
// principal, evita travar/congelar a interface no aparelho do usuário e deixa o
// processamento mais rápido (sem precisar ceder a CPU para a UI a cada quadro).
//
// A decodificação do áudio (Web Audio) acontece na thread principal; aqui só
// recebemos as amostras já decodificadas (canais L/R) e devolvemos o resultado.
// ─────────────────────────────────────────────────────────────────────────────

import { emphasizeVocalsCore, type Channels } from "./audio-dsp";

interface RequestMessage {
  id: number;
  L: Float32Array;
  R: Float32Array;
  n: number;
  sampleRate: number;
}

type ResponseMessage =
  | { id: number; type: "progress"; value: number }
  | { id: number; type: "done"; samples: Float32Array; sampleRate: number }
  | { id: number; type: "error"; message: string };

self.onmessage = (e: MessageEvent<RequestMessage>) => {
  const { id, L, R, n, sampleRate } = e.data;
  try {
    const ch: Channels = { L, R, n, sampleRate };
    const result = emphasizeVocalsCore(ch, (value) => {
      const msg: ResponseMessage = { id, type: "progress", value };
      (self as unknown as Worker).postMessage(msg);
    });
    const done: ResponseMessage = {
      id,
      type: "done",
      samples: result.samples,
      sampleRate: result.sampleRate,
    };
    (self as unknown as Worker).postMessage(done, [result.samples.buffer]);
  } catch (err) {
    const msg: ResponseMessage = {
      id,
      type: "error",
      message: err instanceof Error ? err.message : "erro",
    };
    (self as unknown as Worker).postMessage(msg);
  }
};
