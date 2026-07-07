/**
 * Sons curtos e discretos para o hover dos cards da Home.
 * Tudo sintetizado via Web Audio — sem arquivos de áudio.
 * Se o navegador ainda não liberou o áudio (sem interação), falha em silêncio.
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let lastPlay = 0;

function getCtx(): { ctx: AudioContext; master: GainNode } | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.14;
    master.connect(ctx.destination);
    const unlock = () => {
      void ctx?.resume().then(() => {
        if (ctx?.state === "running") {
          window.removeEventListener("pointerdown", unlock);
          window.removeEventListener("keydown", unlock);
        }
      }).catch(() => undefined);
    };
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock, { passive: true });
  }
  if (ctx.state === "suspended") {
    void ctx.resume().catch(() => undefined);
    if (ctx.state === "suspended") return null;
  }
  return master ? { ctx, master } : null;
}

function throttled(): boolean {
  const now = performance.now();
  if (now - lastPlay < 350) return true;
  lastPlay = now;
  return false;
}

const midiToFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

function note(
  c: AudioContext,
  out: AudioNode,
  midi: number,
  when: number,
  dur: number,
  peak: number,
  type: OscillatorType = "triangle",
  attack = 0.02,
) {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = midiToFreq(midi);
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(peak, when + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  osc.connect(g).connect(out);
  osc.start(when);
  osc.stop(when + dur + 0.05);
  osc.onended = () => {
    osc.disconnect();
    g.disconnect();
  };
}

/** Cmaj9 dedilhado — leve, como um piano elétrico. */
export function playAcordesHover() {
  const a = getCtx();
  if (!a || throttled()) return;
  const t0 = a.ctx.currentTime + 0.02;
  const chord = [48, 52, 55, 59, 62]; // C3 E3 G3 B3 D4
  chord.forEach((m, i) => {
    note(a.ctx, a.master, m, t0 + i * 0.035, 1.3, 0.22, "triangle", 0.015);
    note(a.ctx, a.master, m + 12, t0 + i * 0.035, 1.1, 0.05, "sine", 0.02);
  });
}

/** C simples → C9: a "transformação" em duas etapas. */
export function playSofisticadorHover() {
  const a = getCtx();
  if (!a || throttled()) return;
  const t0 = a.ctx.currentTime + 0.02;
  [48, 52, 55].forEach((m) => note(a.ctx, a.master, m, t0, 0.35, 0.16, "triangle"));
  const t1 = t0 + 0.42;
  [48, 52, 55, 58, 62].forEach((m, i) =>
    note(a.ctx, a.master, m, t1 + i * 0.03, 1.2, 0.2, "triangle", 0.015),
  );
  note(a.ctx, a.master, 74, t1 + 0.15, 0.9, 0.04, "sine", 0.05); // brilho
}

/** Swell suave de pad (quinta aberta com filtro). */
export function playPadHover() {
  const a = getCtx();
  if (!a || throttled()) return;
  const t0 = a.ctx.currentTime + 0.02;
  const filter = a.ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(500, t0);
  filter.frequency.linearRampToValueAtTime(1400, t0 + 0.8);
  filter.frequency.linearRampToValueAtTime(600, t0 + 1.8);
  const g = a.ctx.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(0.12, t0 + 0.5);
  g.gain.linearRampToValueAtTime(0.0001, t0 + 1.9);
  filter.connect(g).connect(a.master);
  const oscs = [36, 43, 48, 55, 60].map((m) => {
    const osc = a.ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = midiToFreq(m);
    osc.detune.value = (Math.random() - 0.5) * 8;
    osc.connect(filter);
    osc.start(t0);
    osc.stop(t0 + 2);
    return osc;
  });
  oscs[0].onended = () => {
    oscs.forEach((o) => o.disconnect());
    filter.disconnect();
    g.disconnect();
  };
}

/** Dois cliques de metrônomo (forte + fraco) a 72 BPM. */
export function playMetronomoHover() {
  const a = getCtx();
  if (!a || throttled()) return;
  const t0 = a.ctx.currentTime + 0.02;
  const beat = 60 / 72;
  const click = (when: number, freq: number, peak: number) => {
    const osc = a.ctx.createOscillator();
    const g = a.ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(peak, when + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.07);
    osc.connect(g).connect(a.master);
    osc.start(when);
    osc.stop(when + 0.1);
    osc.onended = () => {
      osc.disconnect();
      g.disconnect();
    };
  };
  click(t0, 1500, 0.5);
  click(t0 + beat, 850, 0.35);
}
