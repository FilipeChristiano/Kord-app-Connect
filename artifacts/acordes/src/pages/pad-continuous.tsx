import { useEffect, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Play, Pause, Square, Volume2, Waves } from "lucide-react";

type Quality = "major" | "minor";
type PresetId = "warm" | "deep" | "soft";

const KEYS: { label: string; pc: number }[] = [
  { label: "C", pc: 0 },
  { label: "C# / Db", pc: 1 },
  { label: "D", pc: 2 },
  { label: "D# / Eb", pc: 3 },
  { label: "E", pc: 4 },
  { label: "F", pc: 5 },
  { label: "F# / Gb", pc: 6 },
  { label: "G", pc: 7 },
  { label: "G# / Ab", pc: 8 },
  { label: "A", pc: 9 },
  { label: "A# / Bb", pc: 10 },
  { label: "B", pc: 11 },
];

const PRESETS: Record<PresetId, {
  name: string;
  desc: string;
  cutoff: number;
  cutoffLfoDepth: number;
  lfoRate: number;
  saw: number;
  tri: number;
  sine: number;
  reverbMix: number;
  delayMix: number;
  delayTime: number;
  detune: number;
}> = {
  warm: {
    name: "Warm Worship Pad",
    desc: "Cama harmônica quente, ideal para adoração intimista.",
    cutoff: 1400,
    cutoffLfoDepth: 350,
    lfoRate: 0.12,
    saw: 0.35,
    tri: 0.6,
    sine: 0.45,
    reverbMix: 0.55,
    delayMix: 0.18,
    delayTime: 0.42,
    detune: 8,
  },
  deep: {
    name: "Deep Ambient Pad",
    desc: "Som profundo e cinematográfico para ministração.",
    cutoff: 900,
    cutoffLfoDepth: 250,
    lfoRate: 0.07,
    saw: 0.5,
    tri: 0.45,
    sine: 0.55,
    reverbMix: 0.75,
    delayMix: 0.28,
    delayTime: 0.55,
    detune: 12,
  },
  soft: {
    name: "Soft Prayer Pad",
    desc: "Pad suave e etéreo para momentos de oração.",
    cutoff: 1700,
    cutoffLfoDepth: 200,
    lfoRate: 0.1,
    saw: 0.18,
    tri: 0.5,
    sine: 0.7,
    reverbMix: 0.65,
    delayMix: 0.22,
    delayTime: 0.48,
    detune: 5,
  },
};

function midiToFreq(midi: number) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function chordMidi(pc: number, quality: Quality): number[] {
  const root = 48 + pc;
  if (quality === "major") {
    return [root - 12, root, root + 4, root + 7, root + 11, root + 14];
  }
  return [root - 12, root, root + 3, root + 7, root + 10, root + 14, root + 17];
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

type Voice = {
  gain: GainNode;
  oscs: OscillatorNode[];
  lfo: OscillatorNode;
  lfoGain: GainNode;
  filter: BiquadFilterNode;
};

export default function PadContinuous() {
  const [selectedPc, setSelectedPc] = useState<number>(0);
  const [quality, setQuality] = useState<Quality>("major");
  const [preset, setPreset] = useState<PresetId>("warm");
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [fadeIn, setFadeIn] = useState(2.5);
  const [fadeOut, setFadeOut] = useState(2.5);

  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const dryRef = useRef<GainNode | null>(null);
  const wetReverbRef = useRef<GainNode | null>(null);
  const wetDelayRef = useRef<GainNode | null>(null);
  const reverbRef = useRef<ConvolverNode | null>(null);
  const delayRef = useRef<DelayNode | null>(null);
  const delayFbRef = useRef<GainNode | null>(null);
  const voiceRef = useRef<Voice | null>(null);
  const playingRef = useRef(false);
  const currentChordRef = useRef<{ pc: number; quality: Quality } | null>(null);

  const initAudio = useCallback(() => {
    if (ctxRef.current) return ctxRef.current;
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx: AudioContext = new Ctx();
    const master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);

    const dry = ctx.createGain();
    dry.gain.value = 1;
    dry.connect(master);

    const reverb = ctx.createConvolver();
    reverb.buffer = makeReverbImpulse(ctx, 3.8, 2.2);
    const wetReverb = ctx.createGain();
    wetReverb.gain.value = PRESETS[preset].reverbMix;
    reverb.connect(wetReverb);
    wetReverb.connect(master);

    const delay = ctx.createDelay(2.0);
    delay.delayTime.value = PRESETS[preset].delayTime;
    const delayFb = ctx.createGain();
    delayFb.gain.value = 0.35;
    const wetDelay = ctx.createGain();
    wetDelay.gain.value = PRESETS[preset].delayMix;
    delay.connect(delayFb);
    delayFb.connect(delay);
    delay.connect(wetDelay);
    wetDelay.connect(reverb);
    wetDelay.connect(master);

    ctxRef.current = ctx;
    masterRef.current = master;
    dryRef.current = dry;
    reverbRef.current = reverb;
    wetReverbRef.current = wetReverb;
    delayRef.current = delay;
    delayFbRef.current = delayFb;
    wetDelayRef.current = wetDelay;
    return ctx;
  }, [volume, preset]);

  const buildVoice = useCallback((ctx: AudioContext, pc: number, q: Quality): Voice => {
    const p = PRESETS[preset];
    const gain = ctx.createGain();
    gain.gain.value = 0;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.Q.value = 0.7;
    filter.frequency.value = p.cutoff;

    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = p.lfoRate;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = p.cutoffLfoDepth;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();

    filter.connect(gain);
    gain.connect(dryRef.current!);
    gain.connect(reverbRef.current!);
    gain.connect(delayRef.current!);

    const oscs: OscillatorNode[] = [];
    const notes = chordMidi(pc, q);
    notes.forEach((midi, idx) => {
      const freq = midiToFreq(midi);
      // 1 saw + 1 tri + 1 sine per note, slightly detuned, attenuated per voice
      const voiceMix = ctx.createGain();
      // attenuate so the cluster doesn't clip
      voiceMix.gain.value = 1 / Math.sqrt(notes.length);
      voiceMix.connect(filter);

      const mkOsc = (type: OscillatorType, level: number, detuneCents: number) => {
        if (level <= 0) return;
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.value = freq;
        osc.detune.value = detuneCents;
        const g = ctx.createGain();
        // give lowest octave a tiny bit more weight for warmth
        const octaveBoost = idx === 0 ? 1.2 : 1.0;
        g.gain.value = level * octaveBoost;
        osc.connect(g);
        g.connect(voiceMix);
        osc.start();
        oscs.push(osc);
      };

      // Per-note slight detune offset so each note feels alive
      const noteOffset = (idx % 2 === 0 ? -1 : 1) * 2;
      mkOsc("sawtooth", p.saw, noteOffset - p.detune);
      mkOsc("sawtooth", p.saw, noteOffset + p.detune);
      mkOsc("triangle", p.tri, noteOffset);
      mkOsc("sine", p.sine, noteOffset);
    });

    return { gain, oscs, lfo, lfoGain, filter };
  }, [preset]);

  const holdParam = useCallback((param: AudioParam, now: number) => {
    const anyParam = param as AudioParam & { cancelAndHoldAtTime?: (t: number) => void };
    if (typeof anyParam.cancelAndHoldAtTime === "function") {
      anyParam.cancelAndHoldAtTime(now);
    } else {
      // Fallback: hold at the currently-computed value (best-effort) and clear future ramps.
      const current = param.value;
      param.cancelScheduledValues(now);
      param.setValueAtTime(current, now);
    }
  }, []);

  const stopVoice = useCallback((v: Voice, fadeSec: number) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const now = ctx.currentTime;
    const target = Math.max(0.05, fadeSec);
    holdParam(v.gain.gain, now);
    v.gain.gain.linearRampToValueAtTime(0.0001, now + target);
    const stopAt = now + target + 0.2;
    v.oscs.forEach(o => {
      try { o.stop(stopAt); } catch {}
    });
    try { v.lfo.stop(stopAt); } catch {}
    setTimeout(() => {
      try { v.gain.disconnect(); } catch {}
      try { v.filter.disconnect(); } catch {}
      try { v.lfoGain.disconnect(); } catch {}
    }, (target + 0.5) * 1000);
  }, [holdParam]);

  const startVoice = useCallback((v: Voice, fadeSec: number) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const now = ctx.currentTime;
    const target = Math.max(0.05, fadeSec);
    holdParam(v.gain.gain, now);
    v.gain.gain.linearRampToValueAtTime(1, now + target);
  }, [holdParam]);

  const handlePlay = useCallback(async () => {
    const ctx = initAudio();
    if (ctx.state === "suspended") await ctx.resume();
    if (playingRef.current) return;
    playingRef.current = true;
    setIsPlaying(true);
    const v = buildVoice(ctx, selectedPc, quality);
    voiceRef.current = v;
    currentChordRef.current = { pc: selectedPc, quality };
    startVoice(v, fadeIn);
  }, [initAudio, buildVoice, selectedPc, quality, startVoice, fadeIn]);

  const handlePause = useCallback(() => {
    if (!playingRef.current) return;
    playingRef.current = false;
    setIsPlaying(false);
    const v = voiceRef.current;
    if (v) stopVoice(v, fadeOut);
    voiceRef.current = null;
  }, [stopVoice, fadeOut]);

  const handleStop = useCallback(() => {
    if (!playingRef.current && !voiceRef.current) return;
    playingRef.current = false;
    setIsPlaying(false);
    const v = voiceRef.current;
    if (v) stopVoice(v, 0.25);
    voiceRef.current = null;
  }, [stopVoice]);

  // Crossfade to new chord when key/quality changes while playing
  useEffect(() => {
    if (!playingRef.current) {
      currentChordRef.current = { pc: selectedPc, quality };
      return;
    }
    const cur = currentChordRef.current;
    if (cur && cur.pc === selectedPc && cur.quality === quality) return;
    const ctx = ctxRef.current;
    if (!ctx) return;
    const oldVoice = voiceRef.current;
    const newVoice = buildVoice(ctx, selectedPc, quality);
    voiceRef.current = newVoice;
    currentChordRef.current = { pc: selectedPc, quality };
    startVoice(newVoice, 1.6);
    if (oldVoice) stopVoice(oldVoice, 1.6);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPc, quality]);

  // Live volume changes
  useEffect(() => {
    const m = masterRef.current;
    const ctx = ctxRef.current;
    if (!m || !ctx) return;
    m.gain.cancelScheduledValues(ctx.currentTime);
    m.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.1);
  }, [volume]);

  // Live preset changes (effects only — voice params apply on next start/crossfade)
  useEffect(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const p = PRESETS[preset];
    wetReverbRef.current?.gain.setTargetAtTime(p.reverbMix, ctx.currentTime, 0.3);
    wetDelayRef.current?.gain.setTargetAtTime(p.delayMix, ctx.currentTime, 0.3);
    delayRef.current?.delayTime.setTargetAtTime(p.delayTime, ctx.currentTime, 0.3);
    // If playing, rebuild voice with new preset via crossfade
    if (playingRef.current) {
      const oldVoice = voiceRef.current;
      const newVoice = buildVoice(ctx, selectedPc, quality);
      voiceRef.current = newVoice;
      startVoice(newVoice, 1.4);
      if (oldVoice) stopVoice(oldVoice, 1.4);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset]);

  useEffect(() => {
    return () => {
      const v = voiceRef.current;
      if (v) stopVoice(v, 0.1);
      voiceRef.current = null;
      playingRef.current = false;
      const ctx = ctxRef.current;
      if (ctx) {
        setTimeout(() => { ctx.close().catch(() => {}); }, 400);
      }
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
          Escolha um tom, selecione o modo e deixe o pad rolar em loop infinito. Ideal para estudo,
          oração, ministração e prática harmônica.
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
            {isPlaying ? "Tocando agora" : "Pronto para tocar"}
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
              className="flex items-center gap-3 px-8 py-4 rounded-2xl bg-primary text-primary-foreground font-bold shadow-lg shadow-primary/30 hover:bg-orange-400 hover:-translate-y-0.5 transition-all"
            >
              <Play className="w-6 h-6" /> Tocar Pad
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
          {/* Volume */}
          <div>
            <label className="flex items-center gap-2 text-sm text-white/80 font-medium mb-2">
              <Volume2 className="w-4 h-4" /> Volume
            </label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="text-xs text-muted-foreground mt-1 notranslate" translate="no">
              {Math.round(volume * 100)}%
            </div>
          </div>

          {/* Fade In */}
          <div>
            <label className="text-sm text-white/80 font-medium mb-2 block">Fade In</label>
            <input
              type="range"
              min={0.1}
              max={8}
              step={0.1}
              value={fadeIn}
              onChange={(e) => setFadeIn(parseFloat(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="text-xs text-muted-foreground mt-1 notranslate" translate="no">
              {fadeIn.toFixed(1)}s
            </div>
          </div>

          {/* Fade Out */}
          <div>
            <label className="text-sm text-white/80 font-medium mb-2 block">Fade Out</label>
            <input
              type="range"
              min={0.1}
              max={8}
              step={0.1}
              value={fadeOut}
              onChange={(e) => setFadeOut(parseFloat(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="text-xs text-muted-foreground mt-1 notranslate" translate="no">
              {fadeOut.toFixed(1)}s
            </div>
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
            Trocar de tom enquanto toca faz transição suave (crossfade), sem cortes.
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
                <div className={`font-bold mb-1 ${active ? "text-primary" : "text-white"}`}>
                  {p.name}
                </div>
                <div className="text-xs text-muted-foreground leading-relaxed">{p.desc}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
