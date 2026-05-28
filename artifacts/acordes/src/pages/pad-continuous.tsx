import { useEffect, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Play, Pause, Square, Volume2, Waves, Loader2 } from "lucide-react";

type Quality = "major" | "minor";
type PresetId = "shimmer" | "cathedral" | "prayer";

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

const PRESETS: Record<PresetId, {
  name: string;
  desc: string;
  cutoff: number;
  reverbMix: number;
  synthMix: number;
  width: number;
}> = {
  shimmer: {
    name: "Worship Shimmer",
    desc: "O timbre original dos pads, brilhante e aéreo. Ideal para espontâneos.",
    cutoff: 16000,
    reverbMix: 0.5,
    synthMix: 0.1,
    width: 0.6,
  },
  cathedral: {
    name: "Deep Cathedral",
    desc: "Mais escuro e profundo, com reverb de catedral. Para ministração e oração.",
    cutoff: 5200,
    reverbMix: 0.82,
    synthMix: 0.14,
    width: 0.85,
  },
  prayer: {
    name: "Soft Prayer",
    desc: "Suave e contido, brilho reduzido. Cama discreta para tocar por cima.",
    cutoff: 8500,
    reverbMix: 0.62,
    synthMix: 0.07,
    width: 0.7,
  },
};

const XFADE = 2.0;

function midiToFreq(midi: number) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function synthChord(pc: number, quality: Quality): number[] {
  const root = 60 + pc;
  if (quality === "major") return [root, root + 4, root + 7, root + 11];
  return [root, root + 3, root + 7, root + 10];
}

function makeReverbImpulse(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = Math.floor(rate * seconds);
  const impulse = ctx.createBuffer(2, length, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return impulse;
}

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

type SynthVoice = {
  gain: GainNode;
  stop: (fade: number) => void;
};

export default function PadContinuous() {
  const [selectedPc, setSelectedPc] = useState<number>(0);
  const [quality, setQuality] = useState<Quality>("major");
  const [preset, setPreset] = useState<PresetId>("cathedral");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [fadeIn, setFadeIn] = useState(3);
  const [fadeOut, setFadeOut] = useState(4);

  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const sampleBusRef = useRef<BiquadFilterNode | null>(null);
  const reverbSendRef = useRef<GainNode | null>(null);
  const wetReverbRef = useRef<GainNode | null>(null);
  const synthBusRef = useRef<GainNode | null>(null);

  const bufferCache = useRef<Map<string, AudioBuffer>>(new Map());
  const samplePlayerRef = useRef<SamplePlayer | null>(null);
  const synthVoiceRef = useRef<SynthVoice | null>(null);
  const playingRef = useRef(false);
  const currentRef = useRef<{ pc: number; quality: Quality } | null>(null);
  const switchTokenRef = useRef(0);

  // ---- Audio graph setup ----
  const initAudio = useCallback(() => {
    if (ctxRef.current) return ctxRef.current;
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx: AudioContext = new Ctx();
    const p = PRESETS[preset];

    const master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);

    // Sample bus: lowpass filter to tame brightness, then to master + reverb
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.Q.value = 0.3;
    filter.frequency.value = p.cutoff;
    filter.connect(master);

    const reverb = ctx.createConvolver();
    reverb.buffer = makeReverbImpulse(ctx, 5.5, 2.6);
    const wetReverb = ctx.createGain();
    wetReverb.gain.value = p.reverbMix;
    reverb.connect(wetReverb);
    wetReverb.connect(master);

    // Reverb send (sources connect here in addition to dry filter)
    const reverbSend = ctx.createGain();
    reverbSend.gain.value = 1;
    reverbSend.connect(reverb);

    // Synth atmospheric layer bus -> filter (shares dry + reverb path)
    const synthBus = ctx.createGain();
    synthBus.gain.value = p.synthMix;
    synthBus.connect(filter);
    synthBus.connect(reverbSend);

    ctxRef.current = ctx;
    masterRef.current = master;
    sampleBusRef.current = filter;
    reverbSendRef.current = reverbSend;
    wetReverbRef.current = wetReverb;
    synthBusRef.current = synthBus;
    return ctx;
  }, [volume, preset]);

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

  // ---- Stereo widener: duplicate buffer source path with small L/R delays ----
  const createSamplePlayer = useCallback((buffer: AudioBuffer): SamplePlayer => {
    const ctx = ctxRef.current!;
    const p = PRESETS[preset];
    const gain = ctx.createGain();
    gain.gain.value = 0;

    // Stereo widening via Haas-style split
    const widthAmt = p.width;
    const merger = ctx.createGain();
    merger.connect(sampleBusRef.current!);
    merger.connect(reverbSendRef.current!);

    // center path
    const center = ctx.createGain();
    center.gain.value = 1 - widthAmt * 0.35;
    center.connect(merger);
    // wide path with tiny delay + opposite panning
    const wideL = ctx.createDelay(0.05);
    wideL.delayTime.value = 0.012;
    const panL = ctx.createStereoPanner();
    panL.pan.value = -widthAmt;
    const wideLgain = ctx.createGain();
    wideLgain.gain.value = widthAmt * 0.5;
    const wideR = ctx.createDelay(0.05);
    wideR.delayTime.value = 0.019;
    const panR = ctx.createStereoPanner();
    panR.pan.value = widthAmt;
    const wideRgain = ctx.createGain();
    wideRgain.gain.value = widthAmt * 0.5;
    wideL.connect(panL); panL.connect(wideLgain); wideLgain.connect(merger);
    wideR.connect(panR); panR.connect(wideRgain); wideRgain.connect(merger);

    gain.connect(center);
    gain.connect(wideL);
    gain.connect(wideR);

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
        // Clamp overdue events to the near future so fade-in curves never throw
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
        try { center.disconnect(); } catch {}
        try { merger.disconnect(); } catch {}
      }, (f + 0.3) * 1000);
    };

    return { gain, stop };
  }, [preset]);

  const fadeInPlayer = useCallback((player: SamplePlayer, fade: number) => {
    const ctx = ctxRef.current!;
    const now = ctx.currentTime;
    const f = Math.max(0.05, fade);
    player.gain.gain.cancelScheduledValues(now);
    player.gain.gain.setValueAtTime(0.0001, now);
    player.gain.gain.linearRampToValueAtTime(1, now + f);
  }, []);

  // ---- Synth atmospheric layer ----
  const createSynthVoice = useCallback((pc: number, q: Quality): SynthVoice => {
    const ctx = ctxRef.current!;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(synthBusRef.current!);

    const oscs: OscillatorNode[] = [];
    const notes = synthChord(pc, q);
    notes.forEach((midi, idx) => {
      const freq = midiToFreq(midi);
      const mk = (type: OscillatorType, level: number, detune: number) => {
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.value = freq;
        osc.detune.value = detune;
        const g = ctx.createGain();
        g.gain.value = (level / Math.sqrt(notes.length)) * (idx === 0 ? 1.15 : 1);
        osc.connect(g);
        g.connect(gain);
        osc.start();
        oscs.push(osc);
      };
      mk("sine", 0.7, 0);
      mk("triangle", 0.4, idx % 2 === 0 ? -4 : 4);
    });

    const stop = (fade: number) => {
      const now = ctx.currentTime;
      const f = Math.max(0.05, fade);
      holdParam(gain.gain, now);
      gain.gain.linearRampToValueAtTime(0.0001, now + f);
      const stopAt = now + f + 0.2;
      oscs.forEach(o => { try { o.stop(stopAt); } catch {} });
      window.setTimeout(() => { try { gain.disconnect(); } catch {} }, (f + 0.4) * 1000);
    };

    return { gain, stop };
  }, []);

  const fadeInSynth = useCallback((voice: SynthVoice, fade: number) => {
    const ctx = ctxRef.current!;
    const now = ctx.currentTime;
    const f = Math.max(0.05, fade);
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(0.0001, now);
    voice.gain.gain.linearRampToValueAtTime(1, now + f);
  }, []);

  // ---- Transport ----
  const startAt = useCallback(async (pc: number, q: Quality, fade: number) => {
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
    if (token !== switchTokenRef.current) return; // superseded
    const player = createSamplePlayer(buffer);
    samplePlayerRef.current = player;
    fadeInPlayer(player, fade);
    const voice = createSynthVoice(pc, q);
    synthVoiceRef.current = voice;
    fadeInSynth(voice, fade);
    currentRef.current = { pc, quality: q };
  }, [initAudio, loadBuffer, createSamplePlayer, fadeInPlayer, createSynthVoice, fadeInSynth]);

  const handlePlay = useCallback(async () => {
    if (playingRef.current) return;
    playingRef.current = true;
    setIsPlaying(true);
    await startAt(selectedPc, quality, fadeIn);
  }, [startAt, selectedPc, quality, fadeIn]);

  const handlePause = useCallback(() => {
    if (!playingRef.current) return;
    playingRef.current = false;
    setIsPlaying(false);
    switchTokenRef.current++;
    samplePlayerRef.current?.stop(fadeOut);
    synthVoiceRef.current?.stop(fadeOut);
    samplePlayerRef.current = null;
    synthVoiceRef.current = null;
  }, [fadeOut]);

  const handleStop = useCallback(() => {
    if (!playingRef.current && !samplePlayerRef.current) return;
    playingRef.current = false;
    setIsPlaying(false);
    switchTokenRef.current++;
    samplePlayerRef.current?.stop(0.4);
    synthVoiceRef.current?.stop(0.4);
    samplePlayerRef.current = null;
    synthVoiceRef.current = null;
  }, []);

  // ---- Crossfade on key / quality change while playing ----
  useEffect(() => {
    if (!playingRef.current) {
      currentRef.current = { pc: selectedPc, quality };
      return;
    }
    const cur = currentRef.current;
    if (cur && cur.pc === selectedPc && cur.quality === quality) return;

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
      const oldVoice = synthVoiceRef.current;
      const newPlayer = createSamplePlayer(buffer);
      samplePlayerRef.current = newPlayer;
      fadeInPlayer(newPlayer, XFADE);
      const newVoice = createSynthVoice(selectedPc, quality);
      synthVoiceRef.current = newVoice;
      fadeInSynth(newVoice, XFADE);
      currentRef.current = { pc: selectedPc, quality };
      oldPlayer?.stop(XFADE);
      oldVoice?.stop(XFADE);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPc, quality]);

  // ---- Live volume ----
  useEffect(() => {
    const m = masterRef.current;
    const ctx = ctxRef.current;
    if (!m || !ctx) return;
    m.gain.cancelScheduledValues(ctx.currentTime);
    m.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.1);
  }, [volume]);

  // ---- Live preset (effects) + rebuild voices via crossfade ----
  useEffect(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const p = PRESETS[preset];
    sampleBusRef.current?.frequency.setTargetAtTime(p.cutoff, ctx.currentTime, 0.3);
    wetReverbRef.current?.gain.setTargetAtTime(p.reverbMix, ctx.currentTime, 0.3);
    synthBusRef.current?.gain.setTargetAtTime(p.synthMix, ctx.currentTime, 0.3);
    if (playingRef.current) {
      const oldPlayer = samplePlayerRef.current;
      const oldVoice = synthVoiceRef.current;
      const buffer = bufferCache.current.get(KEYS[selectedPc].code);
      if (buffer) {
        const newPlayer = createSamplePlayer(buffer);
        samplePlayerRef.current = newPlayer;
        fadeInPlayer(newPlayer, XFADE);
        oldPlayer?.stop(XFADE);
      }
      const newVoice = createSynthVoice(selectedPc, quality);
      synthVoiceRef.current = newVoice;
      fadeInSynth(newVoice, XFADE);
      oldVoice?.stop(XFADE);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset]);

  // ---- Background preload of all tones (after first init) ----
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
      synthVoiceRef.current?.stop(0.1);
      samplePlayerRef.current = null;
      synthVoiceRef.current = null;
      playingRef.current = false;
      const ctx = ctxRef.current;
      if (ctx) window.setTimeout(() => { ctx.close().catch(() => {}); }, 400);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
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
          suave. Cama harmônica profunda para estudo, oração, ministração e prática.
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
            <span className="text-primary ml-2">{quality === "major" ? "" : "m"}</span>
          </div>
          <div className="text-sm text-muted-foreground">
            {quality === "major" ? "Maior" : "Menor"} · {PRESETS[preset].name}
          </div>
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
      </div>

      {/* Quality */}
      <div className="glass-card rounded-2xl p-6 md:p-8 mb-8">
        <h3 className="text-sm uppercase tracking-wider text-muted-foreground mb-4">Modo</h3>
        <div className="grid grid-cols-2 gap-3 max-w-sm">
          {(["major", "minor"] as Quality[]).map((q) => (
            <button
              key={q}
              onClick={() => setQuality(q)}
              className={`px-4 py-3 rounded-xl font-medium transition-all border ${
                quality === q
                  ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/25"
                  : "bg-secondary text-white border-white/5 hover:border-white/15"
              }`}
            >
              {q === "major" ? "Maior" : "Menor"}
            </button>
          ))}
        </div>
      </div>

      {/* Key Selection */}
      <div className="glass-card rounded-2xl p-6 md:p-8 mb-8">
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

      {/* Presets */}
      <div className="glass-card rounded-2xl p-6 md:p-8">
        <h3 className="text-sm uppercase tracking-wider text-muted-foreground mb-4">Sonoridade</h3>
        <div className="grid md:grid-cols-3 gap-3">
          {(Object.keys(PRESETS) as PresetId[]).map((id) => {
            const p = PRESETS[id];
            const active = preset === id;
            return (
              <button
                key={id}
                onClick={() => setPreset(id)}
                className={`text-left p-5 rounded-xl border transition-all ${
                  active
                    ? "bg-primary/15 border-primary/50 shadow-lg shadow-primary/10"
                    : "bg-secondary border-white/5 hover:border-primary/30"
                }`}
              >
                <div className={`font-bold mb-1 ${active ? "text-primary" : "text-white"}`}>{p.name}</div>
                <div className="text-xs text-muted-foreground leading-relaxed">{p.desc}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
