// Harness de depuração: roda o analyzeBpm (mesmo código do app) num arquivo de
// áudio via Node, com um shim mínimo de OfflineAudioContext (biquad RBJ — as
// mesmas fórmulas do Web Audio). Uso: npx tsx scripts/debug-bpm.ts <audio>
import { execFileSync } from "node:child_process";

const SR = Number(process.env.BPM_SR || 44100);

// ── Biquad RBJ (idêntico ao BiquadFilterNode do Web Audio) ───────────────────
function biquad(
  data: Float32Array,
  type: "highpass" | "lowpass",
  freq: number,
  Q: number,
  sampleRate: number,
): Float32Array {
  const w0 = (2 * Math.PI * freq) / sampleRate;
  const cosw0 = Math.cos(w0);
  // Web Audio: para lowpass/highpass o Q é dado em dB (Q_linear = 10^(Q/20))
  const qLin = Math.pow(10, Q / 20);
  const alpha = Math.sin(w0) / (2 * qLin);
  let b0: number, b1: number, b2: number, a0: number, a1: number, a2: number;
  if (type === "lowpass") {
    b0 = (1 - cosw0) / 2; b1 = 1 - cosw0; b2 = (1 - cosw0) / 2;
  } else {
    b0 = (1 + cosw0) / 2; b1 = -(1 + cosw0); b2 = (1 + cosw0) / 2;
  }
  a0 = 1 + alpha; a1 = -2 * cosw0; a2 = 1 - alpha;
  b0 /= a0; b1 /= a0; b2 /= a0; a1 /= a0; a2 /= a0;
  const out = new Float32Array(data.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < data.length; i++) {
    const x0 = data[i];
    const y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    out[i] = y0;
    x2 = x1; x1 = x0; y2 = y1; y1 = y0;
  }
  return out;
}

// ── Shim mínimo de OfflineAudioContext p/ o renderBand do detector ───────────
class FakeOAC {
  private filters: { type: "highpass" | "lowpass"; freq: number; Q: number }[] = [];
  private srcBuffer: FakeAudioBuffer | null = null;
  destination = {};
  constructor(_ch: number, public length: number, public sampleRate: number) {}
  createBufferSource() {
    const self = this;
    return {
      set buffer(b: FakeAudioBuffer) { self.srcBuffer = b; },
      connect() {}, start() {},
    };
  }
  createBiquadFilter() {
    // Cada filtro ganha o seu próprio slot na cadeia, na ordem de criação;
    // connect() apenas "sela" os valores configurados naquele filtro.
    const self = this;
    const slot = this.filters.length;
    this.filters.push(null as unknown as (typeof this.filters)[number]);
    const f = {
      type: "lowpass" as "highpass" | "lowpass",
      frequency: { value: 0 },
      Q: { value: 0 },
      connect() { self.filters[slot] = { type: f.type, freq: f.frequency.value, Q: f.Q.value }; },
    };
    return f;
  }
  async startRendering() {
    let data = this.srcBuffer!.getChannelData(0);
    // downmix se estéreo
    if (this.srcBuffer!.numberOfChannels > 1) {
      const l = this.srcBuffer!.getChannelData(0);
      const r = this.srcBuffer!.getChannelData(1);
      data = new Float32Array(l.length);
      for (let i = 0; i < l.length; i++) data[i] = (l[i] + r[i]) / 2;
    }
    for (const f of this.filters) if (f) data = biquad(data, f.type, f.freq, f.Q, this.sampleRate);
    return { getChannelData: () => data };
  }
}

class FakeAudioBuffer {
  constructor(private channels: Float32Array[], public sampleRate: number) {}
  get length() { return this.channels[0].length; }
  get duration() { return this.length / this.sampleRate; }
  get numberOfChannels() { return this.channels.length; }
  getChannelData(c: number) { return this.channels[c]; }
}

(globalThis as any).window = { OfflineAudioContext: FakeOAC };


async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("uso: tsx scripts/debug-bpm.ts <audio>");
  const raw = execFileSync("ffmpeg", ["-i", file, "-f", "f32le", "-ac", "1", "-ar", String(SR), "-v", "quiet", "-"], { maxBuffer: 1024 * 1024 * 512 });
  const mono = new Float32Array(raw.buffer, raw.byteOffset, Math.floor(raw.byteLength / 4));
  const buffer = new FakeAudioBuffer([mono], SR) as unknown as AudioBuffer;
  console.log(`arquivo: ${file} — ${(mono.length / SR).toFixed(1)}s`);
  const { analyzeBpm } = await import("../src/lib/bpm-detector");
  const a = await analyzeBpm(buffer);
  console.log("BPM principal:", a.bpm, "confiança:", a.confidence.toFixed(3));
  console.log("compasso:", a.timeSignature, "segmento:", a.segment);
  console.log("recomendada:", a.recommendedIndex);
  for (const o of a.options) {
    console.log(
      `  ${o.relation}: ${o.bpm} bpm  conf=${o.confidence.toFixed(3)} phase=${o.phaseSec.toFixed(3)}s reg=${o.metrics.regularity.toFixed(2)} err=${o.metrics.meanErrorMs.toFixed(0)}ms stab=${o.metrics.stability.toFixed(2)} beats=${o.metrics.beatCount}`,
    );
  }
  // Grade de cliques da opção principal (mesma conta do app: âncora no trecho)
  const main_ = a.options[1];
  const T = 60 / main_.bpm;
  const anchor = a.segment.start + main_.phaseSec;
  const offset = ((anchor % T) + T) % T;
  const beats: number[] = [];
  for (let t = offset; t < a.segment.end + 2 * T; t += T) {
    if (t >= a.segment.start - 0.01) beats.push(Number(t.toFixed(3)));
    if (beats.length >= 20) break;
  }
  console.log("grade principal (s):", beats.join(" "));
}

main().catch((e) => { console.error(e); process.exit(1); });
