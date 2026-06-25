// ─────────────────────────────────────────────────────────────────────────────
// Reprodução AO VIVO do "sem voz" (instrumental) com nós nativos do Web Audio.
//
// Em vez de processar o arquivo inteiro antes de tocar (lento e pesado), tocamos
// o áudio em streaming e aplicamos o cancelamento de centro em tempo real.
//
// O antigo efeito fazia simplesmente (L−R): isso colapsava TUDO em mono e cancelava
// também o que está no centro mas não é voz (baixo, bumbo, caixa) — daí os
// instrumentos "distorcerem". Agora dividimos o som em duas faixas (crossover):
//
//   • Graves (abaixo de ~180 Hz): passam INTACTOS e em ESTÉREO (baixo/bumbo).
//   • Médios/agudos: aplicamos o cancelamento de centro só aqui, onde mora a voz.
//
// Para o modo "original" tocar EXATAMENTE como o som puro (sem coloração dos
// filtros), mantemos dois caminhos paralelos e fazemos um crossfade entre eles:
//
//   <audio> → MediaElementSource ─┬─ dryGain ─────────────────────────┐
//                                 └─ ChannelSplitter → crossover/      │→ saída
//                                    cancelamento → merger → wetGain ──┘
//
//   • original     → dryGain=1, wetGain=0 (som puro, sem efeito).
//   • instrumental → dryGain=0, wetGain=1 (efeito "sem voz").
//
// O efeito liga/desliga instantaneamente (sem reprocessar), com uma rampa curta
// para não dar "clique". Custo de CPU mínimo. Precisa de áudio ESTÉREO.
// ─────────────────────────────────────────────────────────────────────────────

export type LiveMode = "original" | "instrumental";

const CROSSOVER_HZ = 180;
const FILTER_Q = 0.7071; // Butterworth

export class LiveStudioPlayer {
  private el: HTMLAudioElement;
  private ctx: AudioContext | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private dryGain: GainNode | null = null;
  private wetGain: GainNode | null = null;
  private splitter: ChannelSplitterNode | null = null;
  private lpL: BiquadFilterNode | null = null;
  private hpL: BiquadFilterNode | null = null;
  private lpR: BiquadFilterNode | null = null;
  private hpR: BiquadFilterNode | null = null;
  private mergeL: GainNode | null = null;
  private mergeR: GainNode | null = null;
  private merger: ChannelMergerNode | null = null;
  private mode: LiveMode = "original";

  constructor(el: HTMLAudioElement) {
    this.el = el;
  }

  // O nó MediaElementSource só pode ser criado UMA vez por elemento <audio>.
  get element(): HTMLAudioElement {
    return this.el;
  }

  private ensureGraph() {
    if (this.ctx) return;
    const Ctor: typeof AudioContext =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctor();
    this.ctx = ctx;

    this.source = ctx.createMediaElementSource(this.el);

    // Caminho SECO (som puro): garante que "original" toque idêntico ao arquivo.
    this.dryGain = ctx.createGain();
    this.source.connect(this.dryGain);
    this.dryGain.connect(ctx.destination);

    // Caminho MOLHADO (efeito "sem voz").
    this.wetGain = ctx.createGain();
    this.splitter = ctx.createChannelSplitter(2);
    this.source.connect(this.splitter);

    const mkLP = () => {
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = CROSSOVER_HZ;
      f.Q.value = FILTER_Q;
      return f;
    };
    const mkHP = () => {
      const f = ctx.createBiquadFilter();
      f.type = "highpass";
      f.frequency.value = CROSSOVER_HZ;
      f.Q.value = FILTER_Q;
      return f;
    };

    this.lpL = mkLP();
    this.hpL = mkHP();
    this.lpR = mkLP();
    this.hpR = mkHP();
    this.splitter.connect(this.lpL, 0);
    this.splitter.connect(this.hpL, 0);
    this.splitter.connect(this.lpR, 1);
    this.splitter.connect(this.hpR, 1);

    // Faixa média/aguda com o centro cancelado: high_L = (hpL − hpR)/2 e
    // high_R = (hpR − hpL)/2. Graves (lpL/lpR) passam intactos.
    const gLself = ctx.createGain();
    const gLcross = ctx.createGain();
    const gRself = ctx.createGain();
    const gRcross = ctx.createGain();
    gLself.gain.value = 0.5;
    gLcross.gain.value = -0.5;
    gRself.gain.value = 0.5;
    gRcross.gain.value = -0.5;
    this.hpL.connect(gLself);
    this.hpR.connect(gLcross);
    this.hpR.connect(gRself);
    this.hpL.connect(gRcross);

    this.mergeL = ctx.createGain();
    this.mergeR = ctx.createGain();
    this.lpL.connect(this.mergeL);
    gLself.connect(this.mergeL);
    gLcross.connect(this.mergeL);
    this.lpR.connect(this.mergeR);
    gRself.connect(this.mergeR);
    gRcross.connect(this.mergeR);

    this.merger = ctx.createChannelMerger(2);
    this.mergeL.connect(this.merger, 0, 0);
    this.mergeR.connect(this.merger, 0, 1);
    this.merger.connect(this.wetGain);
    this.wetGain.connect(ctx.destination);

    // Estado inicial dos crossfades sem rampa (evita "fade-in" no primeiro play).
    const dry = this.mode === "instrumental" ? 0 : 1;
    this.dryGain.gain.value = dry;
    this.wetGain.gain.value = 1 - dry;
  }

  private applyMode() {
    if (!this.ctx || !this.dryGain || !this.wetGain) return;
    const t = this.ctx.currentTime;
    const tau = 0.02; // rampa curta anti-clique
    const dry = this.mode === "instrumental" ? 0 : 1;
    this.dryGain.gain.setTargetAtTime(dry, t, tau);
    this.wetGain.gain.setTargetAtTime(1 - dry, t, tau);
  }

  async setMode(mode: LiveMode): Promise<void> {
    this.ensureGraph();
    this.mode = mode;
    if (this.ctx?.state === "suspended") await this.ctx.resume();
    this.applyMode();
  }

  async resume(): Promise<void> {
    this.ensureGraph();
    if (this.ctx?.state === "suspended") await this.ctx.resume();
  }

  dispose(): void {
    const nodes = [
      this.source,
      this.dryGain,
      this.wetGain,
      this.splitter,
      this.lpL,
      this.hpL,
      this.lpR,
      this.hpR,
      this.mergeL,
      this.mergeR,
      this.merger,
    ];
    for (const node of nodes) {
      try {
        node?.disconnect();
      } catch {
        // ignore
      }
    }
    void this.ctx?.close();
    this.ctx = null;
    this.source = null;
  }
}
