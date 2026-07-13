/**
 * Demonstrações interativas da página pública de venda (/assinar).
 *
 * Todas reutilizam os motores reais do app:
 * - AcordeDemo    → PianoKeyboard + playChordVoicing (samples reais de piano)
 * - CifraDemo     → transposeChart/classifyLine (mesma transposição do app)
 * - AudioLabDemo  → simulação visual interativa da mesa do Audio Lab
 * - RitmoDemo     → metrônomo Web Audio (mesmo timbre do app) + pads reais
 */

import { useEffect, useRef, useState } from "react";
import { Minus, Pause, Play, Plus, Volume2, VolumeX } from "lucide-react";

import { PianoKeyboard } from "@/components/PianoKeyboard";
import { playChordVoicing, getAudio } from "@/lib/piano";
import { classifyLine, transposeChart, transposeToken } from "@/lib/chord-transpose";

// ─── 1. Dicionário de acordes ────────────────────────────────────────────────

interface DemoChord {
  name: string;
  left: string[];
  right: string[];
  hint: string;
}

const DEMO_CHORDS: DemoChord[] = [
  {
    name: "C7M",
    left: ["C", "G"],
    right: ["C", "E", "G", "B"],
    hint: "O acorde maior com sétima — som aberto e elegante.",
  },
  {
    name: "Am7",
    left: ["A", "E"],
    right: ["A", "C", "E", "G"],
    hint: "Menor com sétima — presença suave, muito usado em levadas.",
  },
  {
    name: "F7M(9)",
    left: ["F", "C"],
    right: ["F", "A", "C", "E", "G"],
    hint: "Sétima maior com nona — aquele brilho a mais no acorde.",
  },
  {
    name: "G7(13)",
    left: ["G", "D"],
    right: ["F", "B", "E"],
    hint: "Dominante com décima terceira — tensão sofisticada antes de resolver.",
  },
];

export function AcordeDemo() {
  const [selected, setSelected] = useState(0);
  const chord = DEMO_CHORDS[selected];

  function choose(i: number) {
    setSelected(i);
    playChordVoicing(DEMO_CHORDS[i].left, DEMO_CHORDS[i].right);
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-5">
        {DEMO_CHORDS.map((c, i) => (
          <button
            key={c.name}
            type="button"
            onClick={() => choose(i)}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
              i === selected
                ? "bg-gradient-to-br from-primary to-primary-700 text-primary-foreground shadow-lg shadow-primary/25"
                : "bg-white/5 border border-white/10 text-white/70 hover:bg-white/10"
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 sm:p-6">
        <PianoKeyboard
          leftHandNotes={chord.left}
          rightHandNotes={chord.right}
          className="w-full"
        />
        <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
          <p className="text-sm text-white/60 leading-relaxed max-w-md">
            {chord.hint}
          </p>
          <button
            type="button"
            onClick={() => playChordVoicing(chord.left, chord.right)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-sm font-medium transition-colors shrink-0"
          >
            <Play className="w-4 h-4 text-primary" />
            Ouvir {chord.name}
          </button>
        </div>
      </div>
      <p className="text-xs text-white/40 mt-3">
        Som de piano de verdade, gravado nota a nota — igualzinho dentro do app.
      </p>
    </div>
  );
}

// ─── 2. Cifras inteligentes (transposição ao vivo) ──────────────────────────

// Trecho original criado para a demonstração (sem direitos de terceiros).
const DEMO_CHART = [
  "[Refrão]",
  "C           G/B         Am7          F7M",
  "Deixa o som te levar pra outro lugar",
  "C           G           F7M          G7",
  "Toca sem pressa e o coração vai guiar",
].join("\n");

const FLAT_KEYS = new Set(["F", "Bb", "Eb", "Ab", "Db", "Gb"]);

export function CifraDemo() {
  const [semis, setSemis] = useState(0);

  const keySharp = transposeToken("C", semis, false);
  const preferFlats = FLAT_KEYS.has(transposeToken("C", semis, true));
  const key = preferFlats ? transposeToken("C", semis, true) : keySharp;
  const chart = transposeChart(DEMO_CHART, semis, preferFlats);

  function bump(d: number) {
    setSemis((s) => {
      const next = s + d;
      if (next > 11 || next < -11) return s;
      return next;
    });
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <span className="text-sm text-white/60">Tom:</span>
        <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-full p-1">
          <button
            type="button"
            onClick={() => bump(-1)}
            aria-label="Baixar meio tom"
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
          >
            <Minus className="w-4 h-4" />
          </button>
          <span className="font-display font-bold text-lg w-12 text-center text-primary">
            {key}
          </span>
          <button
            type="button"
            onClick={() => bump(1)}
            aria-label="Subir meio tom"
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        {semis !== 0 && (
          <button
            type="button"
            onClick={() => setSemis(0)}
            className="text-xs text-white/50 hover:text-white/80 underline underline-offset-2"
          >
            voltar para C
          </button>
        )}
      </div>

      {/* Papel de cifra claro — mesma superfície do app */}
      <div className="bg-[#FAF7F0] text-stone-800 rounded-2xl p-5 sm:p-6 overflow-x-auto shadow-inner">
        <pre className="font-mono text-[13px] sm:text-sm leading-relaxed whitespace-pre">
          {chart.split("\n").map((line, i) => {
            const kind = classifyLine(line);
            if (kind === "section") {
              return (
                <div key={i} className="text-stone-500 font-semibold">
                  {line}
                </div>
              );
            }
            if (kind === "chords") {
              return (
                <div key={i} className="text-[#7C3AED] font-bold">
                  {line}
                </div>
              );
            }
            return <div key={i}>{line || "\u00A0"}</div>;
          })}
        </pre>
      </div>
      <p className="text-xs text-white/40 mt-3">
        Só os acordes mudam — a letra fica intacta e alinhada, como no app.
      </p>
    </div>
  );
}

// ─── 3. Audio Lab (simulação visual da mesa) ────────────────────────────────

const WAVE_BARS = 36;

function waveHeights(seed: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < WAVE_BARS; i++) {
    const v =
      0.35 +
      0.65 *
        Math.abs(
          Math.sin(i * 0.55 + seed) * Math.cos(i * 0.23 + seed * 1.7),
        );
    out.push(Math.min(1, v));
  }
  return out;
}

interface ChannelProps {
  label: string;
  color: string;
  seed: number;
  playing: boolean;
  volume: number;
  onVolume: (v: number) => void;
}

function MixChannel({ label, color, seed, playing, volume, onVolume }: ChannelProps) {
  const heights = waveHeights(seed);
  const muted = volume === 0;
  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold">{label}</span>
        <button
          type="button"
          aria-label={muted ? `Ativar ${label}` : `Silenciar ${label}`}
          onClick={() => onVolume(muted ? 80 : 0)}
          className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors"
        >
          {muted ? (
            <VolumeX className="w-4 h-4 text-white/40" />
          ) : (
            <Volume2 className="w-4 h-4" style={{ color }} />
          )}
        </button>
      </div>
      <div className="flex items-end gap-[3px] h-14 mb-3" aria-hidden="true">
        {heights.map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-full transition-all duration-300"
            style={{
              height: `${Math.max(8, h * (volume / 100) * 100)}%`,
              backgroundColor: color,
              opacity: muted ? 0.15 : 0.4 + 0.6 * (volume / 100),
              animation:
                playing && !muted
                  ? `kordi-wave 0.9s ease-in-out ${i * 0.045}s infinite alternate`
                  : "none",
            }}
          />
        ))}
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={volume}
        onChange={(e) => onVolume(Number(e.target.value))}
        aria-label={`Volume de ${label}`}
        className="w-full accent-[#9673FF]"
      />
    </div>
  );
}

export function AudioLabDemo() {
  const [playing, setPlaying] = useState(false);
  const [vozVol, setVozVol] = useState(80);
  const [instVol, setInstVol] = useState(80);

  return (
    <div>
      <style>{`@keyframes kordi-wave { from { transform: scaleY(0.55); } to { transform: scaleY(1.05); } }`}</style>
      <div className="grid sm:grid-cols-2 gap-3 mb-4">
        <MixChannel
          label="Voz"
          color="#9673FF"
          seed={1.3}
          playing={playing}
          volume={vozVol}
          onVolume={setVozVol}
        />
        <MixChannel
          label="Instrumentos"
          color="#34d399"
          seed={4.1}
          playing={playing}
          volume={instVol}
          onVolume={setInstVol}
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-br from-primary to-primary-700 text-primary-foreground text-sm font-semibold shadow-lg shadow-primary/20 hover:brightness-110 transition-all"
        >
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          {playing ? "Pausar" : "Simular"}
        </button>
        <p className="text-xs text-white/40 leading-relaxed">
          Ilustração da mesa real do Audio Lab. No app, você envia qualquer
          música sua e controla voz e instrumentos separadamente, de verdade.
        </p>
      </div>
    </div>
  );
}

// ─── 4. Metrônomo + Pads ─────────────────────────────────────────────────────

function clickAt(ctx: AudioContext, dest: AudioNode, t: number, strong: boolean) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.value = strong ? 1500 : 1050;
  const dur = strong ? 0.06 : 0.05;
  const peak = strong ? 0.9 : 0.55;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(dest);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export function MetronomoDemo() {
  const [bpm, setBpm] = useState(90);
  const [playing, setPlaying] = useState(false);
  const [beat, setBeat] = useState(-1);
  const stateRef = useRef<{
    timer: number | null;
    nextTime: number;
    nextBeat: number;
    gain: GainNode | null;
    beatTimeouts: number[];
  }>({ timer: null, nextTime: 0, nextBeat: 0, gain: null, beatTimeouts: [] });
  const bpmRef = useRef(bpm);
  bpmRef.current = bpm;

  // Libera todos os recursos do metrônomo (intervalo, timeouts e nó de ganho)
  function releaseMetronome() {
    const st = stateRef.current;
    if (st.timer !== null) window.clearInterval(st.timer);
    st.timer = null;
    st.beatTimeouts.forEach((id) => window.clearTimeout(id));
    st.beatTimeouts = [];
    st.gain?.disconnect();
    st.gain = null;
  }

  useEffect(() => releaseMetronome, []);

  useEffect(() => {
    const st = stateRef.current;
    if (!playing) {
      releaseMetronome();
      setBeat(-1);
      return;
    }
    const a = getAudio();
    if (!a) {
      setPlaying(false);
      return;
    }
    const { ctx } = a;
    // Ganho próprio (o master compartilhado é baixo demais para cliques)
    if (!st.gain) {
      st.gain = ctx.createGain();
      st.gain.gain.value = 0.5;
      st.gain.connect(ctx.destination);
    }
    st.nextTime = ctx.currentTime + 0.08;
    st.nextBeat = 0;
    const tick = () => {
      const horizon = ctx.currentTime + 0.12;
      while (st.nextTime < horizon) {
        const b = st.nextBeat;
        clickAt(ctx, st.gain as GainNode, st.nextTime, b === 0);
        const delay = Math.max(0, (st.nextTime - ctx.currentTime) * 1000);
        const id = window.setTimeout(() => {
          st.beatTimeouts = st.beatTimeouts.filter((x) => x !== id);
          setBeat(b);
        }, delay);
        st.beatTimeouts.push(id);
        st.nextTime += 60 / bpmRef.current;
        st.nextBeat = (b + 1) % 4;
      }
    };
    tick();
    st.timer = window.setInterval(tick, 40);
    return releaseMetronome;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-semibold">Metrônomo</span>
        <div className="flex gap-1.5" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-2.5 h-2.5 rounded-full transition-all duration-100 ${
                beat === i
                  ? i === 0
                    ? "bg-primary scale-125 shadow-lg shadow-primary/50"
                    : "bg-white scale-110"
                  : "bg-white/15"
              }`}
            />
          ))}
        </div>
      </div>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? "Parar metrônomo" : "Tocar metrônomo"}
          className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary-700 text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/25 hover:brightness-110 transition-all shrink-0"
        >
          {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
        </button>
        <div className="flex-1">
          <div className="flex items-baseline justify-between mb-1">
            <span className="font-display font-bold text-2xl">{bpm}</span>
            <span className="text-xs text-white/50">BPM</span>
          </div>
          <input
            type="range"
            min={60}
            max={160}
            value={bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
            aria-label="Andamento em BPM"
            className="w-full accent-[#9673FF]"
          />
        </div>
      </div>
    </div>
  );
}

const PAD_KEYS: { label: string; file: string }[] = [
  { label: "C", file: "C" },
  { label: "D", file: "D" },
  { label: "E", file: "E" },
  { label: "F", file: "F" },
  { label: "G", file: "G" },
  { label: "A", file: "A" },
];

export function PadsDemo() {
  const [active, setActive] = useState<string | null>(null);
  const currentRef = useRef<{ src: AudioBufferSourceNode; gain: GainNode } | null>(null);
  const buffersRef = useRef(new Map<string, Promise<AudioBuffer | null>>());
  const requestRef = useRef(0);

  useEffect(() => {
    return () => stopPad(0.15);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopPad(fade = 0.8) {
    const cur = currentRef.current;
    currentRef.current = null;
    if (!cur) return;
    const a = getAudio();
    if (!a) return;
    const t = a.ctx.currentTime;
    cur.gain.gain.cancelScheduledValues(t);
    cur.gain.gain.setValueAtTime(cur.gain.gain.value, t);
    cur.gain.gain.linearRampToValueAtTime(0.0001, t + fade);
    cur.src.stop(t + fade + 0.05);
  }

  async function playPad(file: string) {
    const a = getAudio();
    if (!a) return;
    if (active === file) {
      requestRef.current++;
      stopPad();
      setActive(null);
      return;
    }
    const req = ++requestRef.current;
    stopPad();
    setActive(file);
    let p = buffersRef.current.get(file);
    if (!p) {
      p = fetch(`${import.meta.env.BASE_URL}pads/pad-${file}.mp3`)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
        .then((d) => a.ctx.decodeAudioData(d))
        .catch(() => {
          buffersRef.current.delete(file);
          return null;
        });
      buffersRef.current.set(file, p);
    }
    const buffer = await p;
    // Se o usuário mudou de pad (ou parou) enquanto carregava, não toca este
    if (!buffer || req !== requestRef.current) return;
    const src = a.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const g = a.ctx.createGain();
    const t = a.ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.9, t + 1.2);
    src.connect(g).connect(a.ctx.destination);
    src.start(t);
    currentRef.current = { src, gain: g };
  }

  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-semibold">Pads contínuos</span>
        {active && (
          <span className="text-xs text-primary font-medium animate-pulse">
            tocando em {active}
          </span>
        )}
      </div>
      <div className="grid grid-cols-6 gap-2">
        {PAD_KEYS.map(({ label, file }) => (
          <button
            key={file}
            type="button"
            onClick={() => void playPad(file)}
            className={`h-12 rounded-xl font-semibold text-sm transition-all ${
              active === file
                ? "bg-gradient-to-br from-primary to-primary-700 text-primary-foreground shadow-lg shadow-primary/30"
                : "bg-white/5 border border-white/10 text-white/70 hover:bg-white/10"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="text-xs text-white/40 mt-3">
        Toque um tom e ouça o pad que sustenta o louvor entre uma música e outra.
      </p>
    </div>
  );
}
