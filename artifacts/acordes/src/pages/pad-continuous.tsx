import { useEffect, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { useIsActive } from "@/components/KeepAlive";
import {
  Play, Pause, Square, Volume2, Waves, Loader2, Filter,
  FileText, Copy, Check, Wand2, ChevronDown,
} from "lucide-react";
import { useCifrasFavoritas } from "@/hooks/use-cifras-favoritas";

const NIVEL_LABELS: Record<string, { label: string; color: string }> = {
  suave: { label: "Suave", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
  intermediario: { label: "Intermediário", color: "text-orange-400 bg-orange-500/10 border-orange-500/30" },
  avancado: { label: "Avançado", color: "text-rose-400 bg-rose-500/10 border-rose-500/30" },
};

const KEYS: { label: string; pc: number; code: string }[] = [
  { label: "C", pc: 0, code: "C" },
  { label: "C# / Db", pc: 1, code: "Cs" },
  { label: "D", pc: 2, code: "D" },
  { label: "D# / Eb", pc: 3, code: "Ds" },
  { label: "E", pc: 4, code: "E" },
  { label: "F", pc: 5, code: "F" },
  { label: "F# / Gb", pc: 6, code: "Fs" },
  { label: "G", pc: 7, code: "G" },
  { label: "G# / Ab", pc: 8, code: "Gs" },
  { label: "A", pc: 9, code: "A" },
  { label: "A# / Bb", pc: 10, code: "As" },
  { label: "B", pc: 11, code: "B" },
];

const XFADE = 2.0;

// Equal-power crossfade curves
function makeCurve(fadeIn: boolean): Float32Array {
  const n = 64;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * (Math.PI / 2);
    c[i] = fadeIn ? Math.sin(x) : Math.cos(x);
  }
  return c;
}
const FADE_IN_CURVE = makeCurve(true);
const FADE_OUT_CURVE = makeCurve(false);

function holdParam(param: AudioParam, now: number) {
  const anyParam = param as AudioParam & { cancelAndHoldAtTime?: (t: number) => void };
  if (typeof anyParam.cancelAndHoldAtTime === "function") {
    anyParam.cancelAndHoldAtTime(now);
  } else {
    const current = param.value;
    param.cancelScheduledValues(now);
    param.setValueAtTime(current, now);
  }
}

type SamplePlayer = {
  gain: GainNode;
  stop: (fade: number) => void;
};

export default function PadContinuous() {
  const [selectedPc, setSelectedPc] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [fadeIn, setFadeIn] = useState(3);
  const [fadeOut, setFadeOut] = useState(4);
  const [lowCutHz, setLowCutHz] = useState(85);
  const [lowCutOn, setLowCutOn] = useState(false);

  // ---- Modo Pads + Cifra ----
  const { cifras } = useCifrasFavoritas();
  const [modoCifra, setModoCifra] = useState(false);
  const [cifraSelId, setCifraSelId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const cifraAtual = cifras.find((c) => c.id === cifraSelId) ?? cifras[0] ?? null;

  const copiarCifra = (texto: string) => {
    navigator.clipboard
      .writeText(texto)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        /* clipboard indisponível neste contexto: ignora silenciosamente */
      });
  };

  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const lowCutRef = useRef<BiquadFilterNode | null>(null);
  const lowCutHzRef = useRef(85);
  const lowCutOnRef = useRef(false);

  const bufferCache = useRef<Map<string, AudioBuffer>>(new Map());
  const samplePlayerRef = useRef<SamplePlayer | null>(null);
  const playingRef = useRef(false);
  const currentPcRef = useRef<number | null>(null);
  const switchTokenRef = useRef(0);

  // ---- Audio graph setup ----
  const initAudio = useCallback(() => {
    if (ctxRef.current) return ctxRef.current;
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx: AudioContext = new Ctx();
    const master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
    // Low Cut (High-Pass Filter) dinâmico — colocado ANTES do volume master.
    // 20 Hz = transparente (sem corte); até 300 Hz = corte de graves ajustável.
    const lowCutFilter = ctx.createBiquadFilter();
    lowCutFilter.type = "highpass";
    lowCutFilter.Q.value = 0.7;
    lowCutFilter.frequency.value = lowCutOnRef.current ? lowCutHzRef.current : 20;
    lowCutFilter.connect(master);
    ctxRef.current = ctx;
    masterRef.current = master;
    lowCutRef.current = lowCutFilter;
    return ctx;
  }, [volume]);

  // ---- Buffer loading / preload ----
  const loadBuffer = useCallback(async (code: string): Promise<AudioBuffer> => {
    const cached = bufferCache.current.get(code);
    if (cached) return cached;
    const ctx = initAudio();
    const url = `${import.meta.env.BASE_URL}pads/pad-${code}.mp3`;
    const res = await fetch(url);
    const arr = await res.arrayBuffer();
    const buf = await ctx.decodeAudioData(arr);
    bufferCache.current.set(code, buf);
    return buf;
  }, [initAudio]);

  // ---- Seamless infinite loop player (plays the real sample, crossfaded) ----
  const createSamplePlayer = useCallback((buffer: AudioBuffer): SamplePlayer => {
    const ctx = ctxRef.current!;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(lowCutRef.current ?? masterRef.current!);

    const period = Math.max(0.5, buffer.duration - XFADE);
    let nextStart = ctx.currentTime + 0.05;
    const activeSrcs: AudioBufferSourceNode[] = [];
    let stopped = false;

    const scheduleOne = (at: number) => {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const sg = ctx.createGain();
      sg.gain.value = 0;
      src.connect(sg);
      sg.connect(gain);
      const dur = buffer.duration;
      try {
        sg.gain.setValueCurveAtTime(FADE_IN_CURVE, at, XFADE);
        sg.gain.setValueCurveAtTime(FADE_OUT_CURVE, at + dur - XFADE, XFADE);
      } catch {
        sg.gain.setValueAtTime(1, at);
      }
      src.start(at);
      src.stop(at + dur + 0.05);
      activeSrcs.push(src);
      src.onended = () => {
        const i = activeSrcs.indexOf(src);
        if (i >= 0) activeSrcs.splice(i, 1);
        try { sg.disconnect(); } catch {}
      };
    };

    const tick = () => {
      if (stopped) return;
      const horizon = ctx.currentTime + 1.0;
      while (nextStart < horizon) {
        const at = Math.max(nextStart, ctx.currentTime + 0.05);
        scheduleOne(at);
        nextStart = at + period;
      }
    };
    tick();
    const schedulerId = window.setInterval(tick, 250);

    const stop = (fade: number) => {
      stopped = true;
      window.clearInterval(schedulerId);
      const now = ctx.currentTime;
      const f = Math.max(0.05, fade);
      holdParam(gain.gain, now);
      gain.gain.linearRampToValueAtTime(0.0001, now + f);
      window.setTimeout(() => {
        activeSrcs.forEach(s => { try { s.stop(); } catch {} });
        try { gain.disconnect(); } catch {}
      }, (f + 0.3) * 1000);
    };

    return { gain, stop };
  }, []);

  const fadeInPlayer = useCallback((player: SamplePlayer, fade: number) => {
    const ctx = ctxRef.current!;
    const now = ctx.currentTime;
    const f = Math.max(0.05, fade);
    player.gain.gain.cancelScheduledValues(now);
    player.gain.gain.setValueAtTime(0.0001, now);
    player.gain.gain.linearRampToValueAtTime(1, now + f);
  }, []);

  // ---- Transport ----
  const startAt = useCallback(async (pc: number, fade: number) => {
    const ctx = initAudio();
    if (ctx.state === "suspended") await ctx.resume();
    const code = KEYS[pc].code;
    setIsLoading(true);
    const token = ++switchTokenRef.current;
    let buffer: AudioBuffer;
    try {
      buffer = await loadBuffer(code);
    } finally {
      setIsLoading(false);
    }
    if (token !== switchTokenRef.current) return;
    const player = createSamplePlayer(buffer);
    samplePlayerRef.current = player;
    fadeInPlayer(player, fade);
    currentPcRef.current = pc;
  }, [initAudio, loadBuffer, createSamplePlayer, fadeInPlayer]);

  const handlePlay = useCallback(async () => {
    if (playingRef.current) return;
    playingRef.current = true;
    setIsPlaying(true);
    await startAt(selectedPc, fadeIn);
  }, [startAt, selectedPc, fadeIn]);

  const handlePause = useCallback(() => {
    if (!playingRef.current) return;
    playingRef.current = false;
    setIsPlaying(false);
    switchTokenRef.current++;
    samplePlayerRef.current?.stop(fadeOut);
    samplePlayerRef.current = null;
  }, [fadeOut]);

  const handleStop = useCallback(() => {
    if (!playingRef.current && !samplePlayerRef.current) return;
    playingRef.current = false;
    setIsPlaying(false);
    switchTokenRef.current++;
    samplePlayerRef.current?.stop(0.4);
    samplePlayerRef.current = null;
  }, []);

  // Ao sair do módulo (keep-alive o mantém montado), para o pad para não ficar
  // tocando em segundo plano. As configurações continuam preservadas.
  const active = useIsActive();
  useEffect(() => {
    if (!active && playingRef.current) handleStop();
  }, [active, handleStop]);

  // ---- Crossfade on key change while playing ----
  useEffect(() => {
    if (!playingRef.current) {
      currentPcRef.current = selectedPc;
      return;
    }
    if (currentPcRef.current === selectedPc) return;

    let cancelled = false;
    (async () => {
      const ctx = ctxRef.current;
      if (!ctx) return;
      const code = KEYS[selectedPc].code;
      const token = ++switchTokenRef.current;
      setIsLoading(true);
      let buffer: AudioBuffer;
      try {
        buffer = await loadBuffer(code);
      } finally {
        setIsLoading(false);
      }
      if (cancelled || token !== switchTokenRef.current || !playingRef.current) return;
      const oldPlayer = samplePlayerRef.current;
      const newPlayer = createSamplePlayer(buffer);
      samplePlayerRef.current = newPlayer;
      fadeInPlayer(newPlayer, XFADE);
      currentPcRef.current = selectedPc;
      oldPlayer?.stop(XFADE);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPc]);

  // ---- Live volume ----
  useEffect(() => {
    const m = masterRef.current;
    const ctx = ctxRef.current;
    if (!m || !ctx) return;
    m.gain.cancelScheduledValues(ctx.currentTime);
    m.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.1);
  }, [volume]);

  // ---- Low Cut (High-Pass) dinâmico em tempo real, com transição suave ----
  useEffect(() => {
    lowCutHzRef.current = lowCutHz;
    lowCutOnRef.current = lowCutOn;
    const f = lowCutRef.current;
    const ctx = ctxRef.current;
    if (!f || !ctx) return;
    const target = lowCutOn ? lowCutHz : 20;
    const now = ctx.currentTime;
    holdParam(f.frequency, now);
    f.frequency.linearRampToValueAtTime(target, now + 0.08);
  }, [lowCutHz, lowCutOn]);

  // ---- Background preload of all tones ----
  useEffect(() => {
    let cancelled = false;
    const id = window.setTimeout(async () => {
      for (const k of KEYS) {
        if (cancelled) return;
        try { await loadBuffer(k.code); } catch {}
      }
    }, 1500);
    return () => { cancelled = true; window.clearTimeout(id); };
  }, [loadBuffer]);

  // ---- Cleanup ----
  useEffect(() => {
    return () => {
      switchTokenRef.current++;
      samplePlayerRef.current?.stop(0.1);
      samplePlayerRef.current = null;
      playingRef.current = false;
      const ctx = ctxRef.current;
      if (ctx) window.setTimeout(() => { ctx.close().catch(() => {}); }, 400);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Seletor de modo: Só Pads  /  Pads + Cifra */}
      <div className="flex justify-center mb-8">
        <div className="inline-flex items-center gap-1 bg-white/5 border border-white/10 rounded-2xl p-1">
          <button
            onClick={() => setModoCifra(false)}
            className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              !modoCifra ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25" : "text-muted-foreground hover:text-white"
            }`}
          >
            <Waves className="w-4 h-4" /> Pads
          </button>
          <button
            onClick={() => setModoCifra(true)}
            className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              modoCifra ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25" : "text-muted-foreground hover:text-white"
            }`}
          >
            <FileText className="w-4 h-4" /> Pads + cifras
          </button>
        </div>
      </div>

      {modoCifra ? combinedView() : fullView()}
    </div>
  );

  function combinedView() {
    return (
      <div className="flex flex-col gap-5">
        {/* Barra de pads minimalista, fixa no topo */}
        <div className="sticky top-20 z-30 glass-card rounded-2xl p-4 border border-white/10 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            {isPlaying ? (
              <button
                onClick={handlePause}
                aria-label="Pausar"
                className="flex items-center justify-center w-12 h-12 shrink-0 rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:bg-orange-400 transition-all"
              >
                <Pause className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={handlePlay}
                disabled={isLoading}
                aria-label="Tocar"
                className="flex items-center justify-center w-12 h-12 shrink-0 rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:bg-orange-400 transition-all disabled:opacity-60"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
              </button>
            )}
            <button
              onClick={handleStop}
              aria-label="Parar"
              className="flex items-center justify-center w-11 h-11 shrink-0 rounded-xl bg-secondary text-white border border-white/5 hover:border-white/10 hover:bg-secondary/70 transition-all"
            >
              <Square className="w-4 h-4" />
            </button>

            <div className="flex-1 min-w-0 text-center px-1">
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground leading-none mb-1">
                {isLoading ? "Carregando" : isPlaying ? "Tocando" : "Tom"}
              </div>
              <div className="font-display text-2xl font-bold text-white leading-none notranslate" translate="no">
                {KEYS[selectedPc].label.split(" / ")[0]}
              </div>
            </div>

            <div className="flex items-center gap-2 w-24 sm:w-32 shrink-0">
              <Volume2 className="w-4 h-4 text-muted-foreground shrink-0" />
              <input
                type="range" min={0} max={1} step={0.01} value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-full accent-primary"
                aria-label="Volume"
              />
            </div>
          </div>

          {/* Seletor de tom compacto */}
          <div className="mt-3 grid grid-cols-6 gap-1.5">
            {KEYS.map((k) => (
              <button
                key={k.pc}
                onClick={() => setSelectedPc(k.pc)}
                className={`py-2 rounded-lg font-bold text-sm transition-all border notranslate ${
                  selectedPc === k.pc
                    ? "bg-primary text-primary-foreground border-primary shadow shadow-primary/20"
                    : "bg-secondary/60 text-white/80 border-white/5 hover:border-primary/40 hover:bg-secondary"
                }`}
                translate="no"
              >
                {k.label.split(" / ")[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Painel de cifras */}
        {cifras.length > 0 ? (
          <div className="glass-card rounded-2xl p-4 sm:p-6">
            {/* Seletor de cifra + copiar */}
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1 min-w-0">
                <select
                  value={cifraAtual?.id ?? ""}
                  onChange={(e) => setCifraSelId(e.target.value)}
                  className="w-full appearance-none bg-secondary/60 border border-white/10 rounded-xl pl-4 pr-10 py-3 text-sm font-medium text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 cursor-pointer truncate"
                  aria-label="Escolher cifra"
                >
                  {cifras.map((c) => (
                    <option key={c.id} value={c.id} className="bg-[#12121f] text-white">
                      {c.titulo}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              {cifraAtual && (
                <button
                  onClick={() => copiarCifra(cifraAtual.textoSofisticado)}
                  aria-label="Copiar cifra"
                  className="flex items-center gap-1.5 shrink-0 text-xs font-medium px-3 py-3 rounded-xl bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-all"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span className="hidden sm:inline">{copied ? "Copiado!" : "Copiar"}</span>
                </button>
              )}
            </div>

            {cifraAtual && (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      (NIVEL_LABELS[cifraAtual.nivel] ?? NIVEL_LABELS.intermediario).color
                    }`}
                  >
                    {(NIVEL_LABELS[cifraAtual.nivel] ?? NIVEL_LABELS.intermediario).label}
                  </span>
                  <h2 className="font-display font-bold text-white text-base leading-tight truncate">
                    {cifraAtual.titulo}
                  </h2>
                </div>
                {/* Área da cifra: rola sozinha, sem mexer na tela inteira */}
                <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 sm:px-5 py-4 font-mono text-sm text-white/90 leading-loose whitespace-pre-wrap max-h-[55vh] overflow-y-auto overscroll-contain">
                  {cifraAtual.textoSofisticado}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="py-16 text-center glass-card rounded-2xl border-dashed">
            <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-5 text-muted-foreground">
              <Wand2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-display font-bold text-white mb-2">Nenhuma cifra salva ainda</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Use o Sofisticador para gerar cifras sofisticadas e salvá-las. Elas vão aparecer aqui
              para você ler enquanto toca o pad.
            </p>
            <Link
              href="/sofisticador"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold bg-primary text-primary-foreground hover:bg-orange-400 transition-colors shadow-lg shadow-primary/20"
            >
              <Wand2 className="w-5 h-5" /> Abrir Sofisticador
            </Link>
          </div>
        )}
      </div>
    );
  }

  function fullView() {
    return (
      <>
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-4">
          <Waves className="w-4 h-4" />
          Pad Continuous
        </div>
        <h1 className="font-display text-3xl md:text-5xl font-bold text-white mb-3">
          Pad <span className="text-primary">Worship</span> Contínuo
        </h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Pads worship reais, gravados em todos os 12 tons, tocando em loop infinito com transição
          suave. Cama harmônica para estudo, oração, ministração e prática.
        </p>
      </div>

      {/* Now Playing */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-2xl p-6 md:p-8 mb-8 text-center relative overflow-hidden"
      >
        <div className={`absolute inset-0 bg-[radial-gradient(ellipse_at_center,_hsl(var(--primary)/0.25),_transparent_70%)] pointer-events-none transition-opacity duration-700 ${isPlaying ? "opacity-100" : "opacity-30"}`} />
        <div className="relative">
          <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground mb-3">
            {isLoading ? "Carregando pad..." : isPlaying ? "Tocando agora" : "Pronto para tocar"}
          </div>
          <div
            className="font-display text-5xl md:text-7xl font-bold text-white mb-1 notranslate"
            translate="no"
          >
            {KEYS[selectedPc].label.split(" / ")[0]}
          </div>
          <div className="text-sm text-muted-foreground">Worship Shimmer</div>
        </div>
      </motion.div>

      {/* Transport */}
      <div className="glass-card rounded-2xl p-6 md:p-8 mb-8">
        <div className="flex flex-wrap items-center justify-center gap-4 mb-6">
          {isPlaying ? (
            <button
              onClick={handlePause}
              className="flex items-center gap-3 px-8 py-4 rounded-2xl bg-primary text-primary-foreground font-bold shadow-lg shadow-primary/30 hover:bg-orange-400 hover:-translate-y-0.5 transition-all"
            >
              <Pause className="w-6 h-6" /> Pausar
            </button>
          ) : (
            <button
              onClick={handlePlay}
              disabled={isLoading}
              className="flex items-center gap-3 px-8 py-4 rounded-2xl bg-primary text-primary-foreground font-bold shadow-lg shadow-primary/30 hover:bg-orange-400 hover:-translate-y-0.5 transition-all disabled:opacity-60"
            >
              {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Play className="w-6 h-6" />}
              {isLoading ? "Carregando" : "Tocar Pad"}
            </button>
          )}
          <button
            onClick={handleStop}
            className="flex items-center gap-2 px-6 py-4 rounded-2xl bg-secondary text-white font-medium border border-white/5 hover:border-white/10 hover:bg-secondary/70 transition-all"
          >
            <Square className="w-5 h-5" /> Stop
          </button>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <label className="flex items-center gap-2 text-sm text-white/80 font-medium mb-2">
              <Volume2 className="w-4 h-4" /> Volume
            </label>
            <input
              type="range" min={0} max={1} step={0.01} value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="text-xs text-muted-foreground mt-1 notranslate" translate="no">{Math.round(volume * 100)}%</div>
          </div>
          <div>
            <label className="text-sm text-white/80 font-medium mb-2 block">Fade In</label>
            <input
              type="range" min={0.1} max={8} step={0.1} value={fadeIn}
              onChange={(e) => setFadeIn(parseFloat(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="text-xs text-muted-foreground mt-1 notranslate" translate="no">{fadeIn.toFixed(1)}s</div>
          </div>
          <div>
            <label className="text-sm text-white/80 font-medium mb-2 block">Fade Out</label>
            <input
              type="range" min={0.1} max={8} step={0.1} value={fadeOut}
              onChange={(e) => setFadeOut(parseFloat(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="text-xs text-muted-foreground mt-1 notranslate" translate="no">{fadeOut.toFixed(1)}s</div>
          </div>
        </div>

        {/* Low Cut dinâmico (High-Pass) */}
        <div className="mt-6 pt-6 border-t border-white/5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <label className="flex items-center gap-2 text-sm text-white/80 font-medium">
              <Filter className="w-4 h-4" /> Low Cut
            </label>
            <div className="flex items-center gap-3">
              <span
                className={`text-sm font-bold notranslate ${
                  lowCutOn ? "text-primary" : "text-muted-foreground"
                }`}
                translate="no"
              >
                {lowCutOn ? `${lowCutHz} Hz` : "OFF"}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={lowCutOn}
                aria-label="Ligar ou desligar o Low Cut"
                onClick={() => setLowCutOn((v) => !v)}
                className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${
                  lowCutOn ? "bg-primary" : "bg-white/15"
                }`}
              >
                <span
                  className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform duration-200 ${
                    lowCutOn ? "translate-x-[22px]" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
          </div>
          <input
            type="range"
            min={20}
            max={300}
            step={1}
            value={lowCutHz}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              setLowCutHz(v);
              setLowCutOn(v > 20);
            }}
            className="w-full accent-primary"
            style={lowCutOn ? undefined : { accentColor: "#52525b" }}
            aria-label="Frequência do Low Cut em Hz"
          />
          <div
            className="flex justify-between text-[10px] text-muted-foreground/70 mt-1 notranslate"
            translate="no"
          >
            <span>20 Hz</span>
            <span>300 Hz</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2 max-w-md">
            Corte de graves ajustável. Basta arrastar o controle: o corte liga sozinho ao passar de
            20&nbsp;Hz e desliga ao voltar. Quanto maior a frequência, mais limpo e definido o som
            fica ao tocar com teclado, voz ou banda. Em 20&nbsp;Hz o pad toca cheio (sem corte).
          </p>
        </div>
      </div>

      {/* Key Selection */}
      <div className="glass-card rounded-2xl p-6 md:p-8">
        <h3 className="text-sm uppercase tracking-wider text-muted-foreground mb-4">Tom</h3>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 md:gap-3">
          {KEYS.map((k) => (
            <button
              key={k.pc}
              onClick={() => setSelectedPc(k.pc)}
              className={`px-2 py-4 rounded-xl font-bold text-base transition-all border notranslate ${
                selectedPc === k.pc
                  ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/25 scale-[1.02]"
                  : "bg-secondary text-white border-white/5 hover:border-primary/40 hover:bg-secondary/70"
              }`}
              translate="no"
            >
              {k.label}
            </button>
          ))}
        </div>
        {isPlaying && (
          <p className="text-xs text-muted-foreground mt-4 text-center">
            Trocar de tom enquanto toca faz transição suave (crossfade) entre os pads reais, sem cortes.
          </p>
        )}
      </div>
      </>
    );
  }
}
