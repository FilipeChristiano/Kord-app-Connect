// ─────────────────────────────────────────────────────────────────────────────
// DSP puro (sem dependências de DOM/Web Audio) usado tanto na thread principal
// quanto no Web Worker do estúdio. Como não toca em `window`/AudioContext, pode
// rodar dentro de um Worker.
//
// Separação por "centro da mixagem" no domínio da frequência (STFT). Para cada
// quadro e faixa de frequência estimamos quanto daquele conteúdo está no CENTRO
// (voz, normalmente igual e em fase nos dois canais) usando duas pistas:
//   • equilíbrio L/R  → 1 quando o nível é igual nos dois lados (centro);
//   • fase            → 1 quando os dois canais estão em fase (correlacionados).
// O produto vira uma MÁSCARA SUAVE (0..1), limitada à faixa da voz, e suavizada
// entre faixas vizinhas para evitar "ruído musical". A partir dela:
//   • "voz em destaque" = máscara × centro          (mono);
//   • "sem voz"         = cada canal − máscara × centro (mantém o ESTÉREO e os
//                          instrumentos panoramizados; só tira a voz central).
// É um EFEITO no navegador, não uma separação com IA — mas bem mais limpo que o
// antigo L−R (que colapsava tudo em mono e distorcia os instrumentos centrais).
// ─────────────────────────────────────────────────────────────────────────────

export interface Channels {
  L: Float32Array;
  R: Float32Array;
  n: number;
  sampleRate: number;
}

export interface DspResult {
  sampleRate: number;
  samples: Float32Array; // canal mono (ou canal esquerdo, se houver `samplesR`)
  samplesR?: Float32Array; // presente apenas em saída ESTÉREO (ex.: "sem voz")
}

export type SeparationMode = "vocals" | "instrumental";

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

// Normaliza dois canais com o MESMO ganho (preserva a imagem estéreo).
function normalizeStereo(l: Float32Array, r: Float32Array, target = 0.97): void {
  let peak = 0;
  for (let i = 0; i < l.length; i++) {
    const a = Math.abs(l[i]);
    if (a > peak) peak = a;
  }
  for (let i = 0; i < r.length; i++) {
    const a = Math.abs(r[i]);
    if (a > peak) peak = a;
  }
  if (peak > 0 && peak !== target) {
    const g = target / peak;
    for (let i = 0; i < l.length; i++) l[i] *= g;
    for (let i = 0; i < r.length; i++) r[i] *= g;
  }
}

// ── Sem voz (instrumental) — versão RÁPIDA, time-domain (fallback) ────────────
// Cancelamento de centro: out = (L − R) / 2. Colapsa em mono; usada só quando o
// caminho de alta qualidade (STFT) não está disponível.
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

function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge0 === edge1) return x < edge0 ? 0 : 1;
  let t = (x - edge0) / (edge1 - edge0);
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  return t * t * (3 - 2 * t);
}

// Peso por frequência: 1 na faixa da voz, suavemente 0 fora dela. Mantém graves
// (baixo/bumbo) e brilhos agudos no instrumental, e evita rumor/chiado na voz.
function vocalBandWeight(freqHz: number): number {
  const low = smoothstep(80, 200, freqHz); // sobe ~80→200 Hz
  const high = 1 - smoothstep(9000, 15000, freqHz); // desce ~9k→15k Hz
  return low * high;
}

// ── Separação por centro (STFT, máscara suave) ───────────────────────────────
export function separateCore(
  ch: Channels,
  mode: SeparationMode,
  onProgress?: (p: number) => void,
): DspResult {
  const FRAME = 4096;
  const HOP = 1024;
  const { L, R, n, sampleRate } = ch;
  const stereoOut = mode === "instrumental";

  const win = new Float32Array(FRAME);
  for (let i = 0; i < FRAME; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / FRAME);

  // Peso da faixa de voz por bin (simétrico: bins k e FRAME−k são a mesma freq.).
  const binHz = sampleRate / FRAME;
  const bandW = new Float32Array(FRAME);
  for (let k = 0; k < FRAME; k++) {
    const f = Math.min(k, FRAME - k) * binHz;
    bandW[k] = vocalBandWeight(f);
  }

  const fft = makeFft(FRAME);

  const lRe = new Float32Array(FRAME);
  const lIm = new Float32Array(FRAME);
  const rRe = new Float32Array(FRAME);
  const rIm = new Float32Array(FRAME);
  const cw = new Float32Array(FRAME); // máscara bruta
  const cwS = new Float32Array(FRAME); // máscara suavizada entre bins

  const outL = new Float32Array(n + FRAME);
  const outR = stereoOut ? new Float32Array(n + FRAME) : null;
  const norm = new Float32Array(n + FRAME);

  // Quanto de "centro" tirar/realçar. >1 deixa a remoção da voz mais agressiva.
  const GAMMA = 1.25; // contraste da máscara (mais alto = menos vazamento)
  const STRENGTH = mode === "instrumental" ? 1.0 : 1.0;
  const EPS = 1e-9;

  const frames = Math.max(1, Math.ceil(n / HOP));
  let frame = 0;
  for (let start = 0; start < n; start += HOP) {
    for (let i = 0; i < FRAME; i++) {
      const idx = start + i;
      const w = win[i];
      const l = idx < n ? L[idx] : 0;
      const r = idx < n ? R[idx] : 0;
      lRe[i] = l * w;
      rRe[i] = r * w;
      lIm[i] = 0;
      rIm[i] = 0;
    }
    fft(lRe, lIm, false);
    fft(rRe, rIm, false);

    // Máscara de centro por bin.
    for (let k = 0; k < FRAME; k++) {
      const aL = Math.hypot(lRe[k], lIm[k]);
      const aR = Math.hypot(rRe[k], rIm[k]);
      const denom = aL + aR + EPS;
      // 1 quando os níveis são iguais (centro), 0 quando panoramizado p/ um lado.
      const panBalance = 1 - Math.abs(aL - aR) / denom;
      // cosseno da diferença de fase entre L e R: 1 = em fase, ≤0 = fora de fase.
      let phaseCos = (lRe[k] * rRe[k] + lIm[k] * rIm[k]) / (aL * aR + EPS);
      if (phaseCos < 0) phaseCos = 0;
      let c = panBalance * phaseCos;
      // Contraste: empurra valores intermediários, reduzindo vazamento.
      c = Math.pow(c, GAMMA);
      c *= bandW[k];
      if (c > 1) c = 1;
      cw[k] = c;
    }
    // Suaviza a máscara entre bins vizinhos (reduz "ruído musical").
    for (let k = 0; k < FRAME; k++) {
      const a = cw[k > 0 ? k - 1 : 0];
      const b = cw[k];
      const d = cw[k < FRAME - 1 ? k + 1 : FRAME - 1];
      cwS[k] = (a + 2 * b + d) * 0.25;
    }

    // Aplica a máscara.
    for (let k = 0; k < FRAME; k++) {
      const c = cwS[k] * STRENGTH;
      const midRe = (lRe[k] + rRe[k]) * 0.5;
      const midIm = (lIm[k] + rIm[k]) * 0.5;
      if (stereoOut) {
        lRe[k] -= c * midRe;
        lIm[k] -= c * midIm;
        rRe[k] -= c * midRe;
        rIm[k] -= c * midIm;
      } else {
        lRe[k] = c * midRe;
        lIm[k] = c * midIm;
      }
    }

    fft(lRe, lIm, true);
    if (stereoOut) fft(rRe, rIm, true);

    const inv = 1 / FRAME;
    for (let i = 0; i < FRAME; i++) {
      const idx = start + i;
      const w = win[i];
      outL[idx] += lRe[i] * inv * w;
      if (outR) outR[idx] += rRe[i] * inv * w;
      norm[idx] += w * w;
    }

    frame++;
    if (onProgress && frame % 16 === 0) onProgress(Math.min(0.99, frame / frames));
  }

  const resL = new Float32Array(n);
  for (let i = 0; i < n; i++) resL[i] = norm[i] > 1e-6 ? outL[i] / norm[i] : 0;
  onProgress?.(1);

  if (stereoOut && outR) {
    const resR = new Float32Array(n);
    for (let i = 0; i < n; i++) resR[i] = norm[i] > 1e-6 ? outR[i] / norm[i] : 0;
    normalizeStereo(resL, resR);
    return { sampleRate, samples: resL, samplesR: resR };
  }
  return { sampleRate, samples: normalize(resL) };
}

// Atalhos legíveis para cada modo.
export function emphasizeVocalsCore(
  ch: Channels,
  onProgress?: (p: number) => void,
): DspResult {
  return separateCore(ch, "vocals", onProgress);
}
