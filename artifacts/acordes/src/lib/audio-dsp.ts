// ─────────────────────────────────────────────────────────────────────────────
// DSP puro (sem dependências de DOM/Web Audio) usado tanto na thread principal
// quanto no Web Worker do estúdio. Mantém os mesmos cálculos de antes:
//   • "Sem voz": cancelamento de centro (L−R).
//   • "Voz em destaque": máscara STFT que realça o centro da mixagem.
// Como não toca em `window`/AudioContext, pode rodar dentro de um Worker.
// ─────────────────────────────────────────────────────────────────────────────

export interface Channels {
  L: Float32Array;
  R: Float32Array;
  n: number;
  sampleRate: number;
}

export interface DspResult {
  sampleRate: number;
  samples: Float32Array; // mono
}

// Normaliza para um pico seguro (evita estouro/clipping no WAV).
export function normalize(samples: Float32Array, target = 0.97): Float32Array {
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
// Cancelamento de centro: out = (L − R) / 2. O conteúdo idêntico nos dois canais
// (voz ao centro) some; o que está panoramizado (instrumentos) permanece.
export function makeInstrumentalCore(ch: Channels): DspResult {
  const { L, R, n, sampleRate } = ch;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = (L[i] - R[i]) * 0.5;
  return { sampleRate, samples: normalize(out) };
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
export function emphasizeVocalsCore(
  ch: Channels,
  onProgress?: (p: number) => void,
): DspResult {
  const FRAME = 4096;
  const HOP = 1024;
  const { L, R, n, sampleRate } = ch;

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
    // Sem throttling por setTimeout: rodando num Worker, a thread principal não
    // congela, então processamos continuamente (bem mais rápido) e só
    // reportamos progresso de vez em quando.
    if (onProgress && frame % 16 === 0) onProgress(Math.min(0.99, frame / frames));
  }

  const result = new Float32Array(n);
  for (let i = 0; i < n; i++) result[i] = norm[i] > 1e-6 ? out[i] / norm[i] : 0;
  onProgress?.(1);
  return { sampleRate, samples: normalize(result) };
}
