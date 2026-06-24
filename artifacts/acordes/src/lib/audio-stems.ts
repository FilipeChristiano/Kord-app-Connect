// ─────────────────────────────────────────────────────────────────────────────
// Estúdio de áudio — separação simples de voz/instrumental NO NAVEGADOR.
//
// Roda 100% local (Web Audio), sem servidor, sem custo e sem plataforma externa.
// É um EFEITO, não uma separação de estúdio com IA:
//   • "Sem voz" (instrumental/karaokê): cancela o que está no CENTRO da mixagem
//     (geralmente a voz) subtraindo os canais (L−R). Simples e eficaz, mas leva
//     junto parte do que também está no centro (grave/bumbo). Precisa de estéreo.
//   • "Voz em destaque": realça o centro com uma máscara no domínio da frequência
//     (STFT) que atenua as faixas dominadas pelos instrumentos panoramizados.
//
// Para download, geramos um WAV PCM16.
// ─────────────────────────────────────────────────────────────────────────────

import { decodeAudioFile } from "./audio-analysis";

export interface StemResult {
  sampleRate: number;
  samples: Float32Array; // mono
}

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

function channelsOf(buffer: AudioBuffer): { L: Float32Array; R: Float32Array; n: number } {
  const L = buffer.getChannelData(0);
  const R = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : L;
  return { L, R, n: Math.min(L.length, R.length) };
}

// Normaliza para um pico seguro (evita estouro/clipping no WAV).
function normalize(samples: Float32Array, target = 0.97): Float32Array {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const a = Math.abs(samples[i]);
    if (a > peak) peak = a;
  }
  if (peak > 0 && peak !== target) {
    const g = target / peak;
    for (let i = 0; i < samples.length; i++) samples[i] *= g;
  }
  return samples;
}

// ── Sem voz (instrumental) ────────────────────────────────────────────────────
// Cancelamento de centro: out = L − R. O conteúdo idêntico nos dois canais (voz
// ao centro) some; o que está panoramizado (instrumentos) permanece.
export function makeInstrumental(buffer: AudioBuffer): StemResult {
  if (buffer.numberOfChannels < 2) throw new MonoSourceError();
  const { L, R, n } = channelsOf(buffer);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = (L[i] - R[i]) * 0.5;
  return { sampleRate: buffer.sampleRate, samples: normalize(out) };
}

// ── FFT radix-2 iterativa (in-place) ─────────────────────────────────────────
function makeFft(size: number) {
  const levels = Math.log2(size);
  if (levels % 1 !== 0) throw new Error("FFT size must be power of 2");
  const rev = new Uint32Array(size);
  for (let i = 0; i < size; i++) {
    let x = i;
    let r = 0;
    for (let j = 0; j < levels; j++) {
      r = (r << 1) | (x & 1);
      x >>= 1;
    }
    rev[i] = r;
  }
  const cos = new Float32Array(size / 2);
  const sin = new Float32Array(size / 2);
  for (let i = 0; i < size / 2; i++) {
    cos[i] = Math.cos((-2 * Math.PI * i) / size);
    sin[i] = Math.sin((-2 * Math.PI * i) / size);
  }
  // inverse = true → conjuga twiddles e divide por N (feito fora).
  return function fft(re: Float32Array, im: Float32Array, inverse: boolean) {
    for (let i = 0; i < size; i++) {
      const j = rev[i];
      if (j > i) {
        let t = re[i]; re[i] = re[j]; re[j] = t;
        t = im[i]; im[i] = im[j]; im[j] = t;
      }
    }
    for (let half = 1; half < size; half <<= 1) {
      const step = size / (half << 1);
      for (let i = 0; i < size; i += half << 1) {
        for (let k = 0, idx = 0; k < half; k++, idx += step) {
          const c = cos[idx];
          const s = inverse ? -sin[idx] : sin[idx];
          const a = i + k;
          const b = a + half;
          const tre = re[b] * c - im[b] * s;
          const tim = re[b] * s + im[b] * c;
          re[b] = re[a] - tre;
          im[b] = im[a] - tim;
          re[a] += tre;
          im[a] += tim;
        }
      }
    }
  };
}

// ── Voz em destaque (máscara STFT no centro) ─────────────────────────────────
// Para cada quadro e faixa de frequência: mid = (L+R)/2 (tudo, centro forte),
// side = (L−R)/2 (só o panoramizado). Onde o lado domina, é instrumento → atenua;
// onde o centro domina, é voz → preserva. Reconstrução por overlap-add.
export async function emphasizeVocals(
  buffer: AudioBuffer,
  onProgress?: (p: number) => void,
): Promise<StemResult> {
  const FRAME = 4096;
  const HOP = 1024;
  const { L, R, n } = channelsOf(buffer);

  const win = new Float32Array(FRAME);
  for (let i = 0; i < FRAME; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / FRAME);

  const fft = makeFft(FRAME);
  const out = new Float32Array(n + FRAME);
  const norm = new Float32Array(n + FRAME);

  const mRe = new Float32Array(FRAME);
  const mIm = new Float32Array(FRAME);
  const sRe = new Float32Array(FRAME);
  const sIm = new Float32Array(FRAME);

  const frames = Math.max(1, Math.ceil((n - FRAME) / HOP) + 1);
  let frame = 0;
  for (let start = 0; start < n; start += HOP) {
    for (let i = 0; i < FRAME; i++) {
      const idx = start + i;
      const l = idx < n ? L[idx] : 0;
      const r = idx < n ? R[idx] : 0;
      const w = win[i];
      mRe[i] = (l + r) * 0.5 * w;
      sRe[i] = (l - r) * 0.5 * w;
      mIm[i] = 0;
      sIm[i] = 0;
    }
    fft(mRe, mIm, false);
    fft(sRe, sIm, false);

    for (let k = 0; k < FRAME; k++) {
      const magM = Math.hypot(mRe[k], mIm[k]);
      const magS = Math.hypot(sRe[k], sIm[k]);
      // 1 quando o centro domina (voz), → 0 quando o lado domina (instrumento).
      let mask = 1 - (1.6 * magS) / (magM + 1e-6);
      if (mask < 0) mask = 0;
      else if (mask > 1) mask = 1;
      mRe[k] *= mask;
      mIm[k] *= mask;
    }

    fft(mRe, mIm, true);
    const inv = 1 / FRAME;
    for (let i = 0; i < FRAME; i++) {
      const idx = start + i;
      const w = win[i];
      out[idx] += mRe[i] * inv * w;
      norm[idx] += w * w;
    }

    frame++;
    if (onProgress && frame % 32 === 0) {
      onProgress(Math.min(0.99, frame / frames));
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  const result = new Float32Array(n);
  for (let i = 0; i < n; i++) result[i] = norm[i] > 1e-6 ? out[i] / norm[i] : 0;
  onProgress?.(1);
  return { sampleRate: buffer.sampleRate, samples: normalize(result) };
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
