// ─────────────────────────────────────────────────────────────────────────────
// Reprodução AO VIVO do "sem voz" (instrumental) com nós nativos do Web Audio.
//
// Em vez de processar o arquivo inteiro antes de tocar (lento e pesado), tocamos
// o áudio em streaming e aplicamos o cancelamento de centro em tempo real:
//
//   <audio> → MediaElementSource → ChannelSplitter → [L×+0.5, R×−0.5] → soma → saída
//
// O efeito liga/desliga instantaneamente durante a reprodução (sem reprocessar).
// Custo de CPU é mínimo (só ganhos e soma), então não trava nem esquenta o
// aparelho. Precisa de áudio ESTÉREO — em mono o resultado fica em silêncio.
// ─────────────────────────────────────────────────────────────────────────────

export type LiveMode = "original" | "instrumental";

export class LiveStudioPlayer {
  private el: HTMLAudioElement;
  private ctx: AudioContext | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private splitter: ChannelSplitterNode | null = null;
  private gainL: GainNode | null = null;
  private gainR: GainNode | null = null;
  private sum: GainNode | null = null;
  private mode: LiveMode = "original";

  constructor(el: HTMLAudioElement) {
    this.el = el;
  }

  // O nó MediaElementSource só pode ser criado UMA vez por elemento <audio>.
  // Por isso reaproveitamos o mesmo player enquanto o elemento for o mesmo, e só
  // recriamos (descartando o antigo) quando o elemento muda.
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
    // Só pode ser criado UMA vez por elemento — a partir daqui o som do elemento
    // passa obrigatoriamente pelo grafo (por isso sempre ligamos à saída).
    this.source = ctx.createMediaElementSource(this.el);
    this.splitter = ctx.createChannelSplitter(2);
    this.gainL = ctx.createGain();
    this.gainR = ctx.createGain();
    this.sum = ctx.createGain();
    this.gainL.gain.value = 0.5;
    this.gainR.gain.value = -0.5;
    this.source.connect(this.splitter);
    this.splitter.connect(this.gainL, 0);
    this.splitter.connect(this.gainR, 1);
    this.gainL.connect(this.sum);
    this.gainR.connect(this.sum);
    this.applyMode();
  }

  private applyMode() {
    if (!this.ctx || !this.source || !this.sum) return;
    try {
      this.source.disconnect(this.ctx.destination);
    } catch {
      // já desconectado
    }
    try {
      this.sum.disconnect(this.ctx.destination);
    } catch {
      // já desconectado
    }
    if (this.mode === "instrumental") {
      this.sum.connect(this.ctx.destination);
    } else {
      this.source.connect(this.ctx.destination);
    }
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
    try {
      this.source?.disconnect();
    } catch {
      // ignore
    }
    try {
      this.splitter?.disconnect();
    } catch {
      // ignore
    }
    try {
      this.gainL?.disconnect();
      this.gainR?.disconnect();
      this.sum?.disconnect();
    } catch {
      // ignore
    }
    void this.ctx?.close();
    this.ctx = null;
    this.source = null;
  }
}
