/**
 * Demonstrações interativas da página pública de venda (/assinar).
 * Tema: Light, Airy, Modern.
 */

import { useEffect, useRef, useState } from "react";
import {
  Check,
  Download,
  FileText,
  Loader2,
  Minus,
  Music2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Scissors,
  Search,
  Volume2,
} from "lucide-react";

import { PianoKeyboard } from "@/components/PianoKeyboard";
import { playChordVoicing, getAudio } from "@/lib/piano";
import { classifyLine, transposeChart, transposeToken } from "@/lib/chord-transpose";
import { CHORDS } from "@/data/chords";
import { splitHands } from "@/lib/notes";

// ─── 1. Dicionário: cifra simplificada × cifra Kordi ("Santo Pra Sempre") ───
// Trecho REAL da cifra usada no app; todas as variações vêm do dicionário
// real (data/chords.ts) — mesmo diagrama e mesmo piano do app.

type FamilyKey = "C" | "Am" | "G" | "F";

interface SongVariation {
  token: string; // como o acorde aparece na cifra
  dictId: string; // id real no dicionário do app
  badge: string;
  common?: boolean;
}

const FAMILIES: Record<FamilyKey, SongVariation[]> = {
  C: [
    { token: "C", dictId: "C-maior", badge: "Na cifra simples", common: true },
    { token: "C7M", dictId: "C7M", badge: "Variação" },
    { token: "Cadd9", dictId: "Cadd9", badge: "Variação" },
    { token: "C7M(9)", dictId: "C9M", badge: "Na cifra Kordi" },
  ],
  Am: [
    { token: "Am7", dictId: "Am7", badge: "Na cifra simples", common: true },
    { token: "Am11", dictId: "Am11", badge: "Variação" },
    { token: "Am7(9)", dictId: "Am9", badge: "Na cifra Kordi" },
  ],
  G: [
    { token: "G", dictId: "G-maior", badge: "Na cifra simples", common: true },
    { token: "Gsus4", dictId: "Gsus4", badge: "Variação" },
    { token: "G7sus4", dictId: "G7sus4", badge: "Na cifra Kordi" },
  ],
  F: [
    { token: "F9", dictId: "Fadd9", badge: "Na cifra simples", common: true },
    { token: "F7M", dictId: "F7M", badge: "Variação" },
    { token: "F7M(9)", dictId: "F9M", badge: "Na cifra Kordi" },
  ],
};

interface SongLine {
  chords: { token: string; family: FamilyKey }[];
  lyric: string;
}

const SIMPLE_LINES: SongLine[] = [
  { chords: [{ token: "C", family: "C" }], lyric: "As muitas gerações rendidas em louvor" },
  {
    chords: [
      { token: "Am7", family: "Am" },
      { token: "G", family: "G" },
      { token: "F9", family: "F" },
    ],
    lyric: "Cantando ao cordeiro uma canção",
  },
];

const KORDI_LINES: SongLine[] = [
  { chords: [{ token: "C7M(9)", family: "C" }], lyric: "As muitas gerações rendidas em louvor" },
  {
    chords: [
      { token: "Am7(9)", family: "Am" },
      { token: "G7sus4", family: "G" },
      { token: "F7M(9)", family: "F" },
    ],
    lyric: "Cantando ao cordeiro uma canção",
  },
];

function dictChord(dictId: string) {
  return CHORDS.find((c) => c.id === dictId)!;
}

function playDictChord(dictId: string) {
  const chord = dictChord(dictId);
  const { leftHand, rightHand } = splitHands(chord.notes, chord.category);
  playChordVoicing(leftHand, rightHand);
}

function CifraCard({
  title,
  badge,
  kordi,
  lines,
  selectedToken,
  onPick,
}: {
  title: string;
  badge: string;
  kordi?: boolean;
  lines: SongLine[];
  selectedToken: string;
  onPick: (family: FamilyKey, token: string) => void;
}) {
  return (
    <div
      className={`rounded-3xl border p-5 sm:p-6 ${
        kordi
          ? "bg-[#FAF7F0] border-primary/30 shadow-lg shadow-primary/10"
          : "bg-[#FAF7F0] border-[#EBE5D9] shadow-inner"
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-bold text-stone-700">{title}</span>
        <span
          className={`text-[10px] font-bold uppercase tracking-widest rounded-full px-2.5 py-1 ${
            kordi
              ? "bg-primary/10 text-primary border border-primary/20"
              : "bg-stone-200/70 text-stone-500"
          }`}
        >
          {badge}
        </span>
      </div>
      <div className="flex flex-col gap-4">
        {lines.map((line) => (
          <div key={line.lyric}>
            <div className="flex flex-wrap gap-2 mb-1.5">
              {line.chords.map((c) => (
                <button
                  key={c.token}
                  type="button"
                  onClick={() => onPick(c.family, c.token)}
                  title={`Ver variações de ${c.token}`}
                  className={`font-mono text-sm font-bold px-2.5 py-1 rounded-lg border transition-all active:scale-95 ${
                    selectedToken === c.token
                      ? "bg-[#7C3AED] text-white border-[#7C3AED] shadow-md shadow-[#7C3AED]/30"
                      : "bg-white text-[#7C3AED] border-[#7C3AED]/25 hover:border-[#7C3AED]/60 hover:bg-[#7C3AED]/5"
                  }`}
                >
                  {c.token}
                </button>
              ))}
            </div>
            <p className="font-mono text-[13px] sm:text-sm text-stone-700 whitespace-nowrap overflow-x-auto">
              {line.lyric}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AcordeDemo() {
  const [family, setFamily] = useState<FamilyKey>("C");
  const [token, setToken] = useState("C7M(9)");

  const variations = FAMILIES[family];
  const current = variations.find((v) => v.token === token) ?? variations[0];
  const chord = dictChord(current.dictId);
  const { leftHand, rightHand } = splitHands(chord.notes, chord.category);

  function pick(f: FamilyKey, t: string) {
    setFamily(f);
    setToken(t);
    const v = FAMILIES[f].find((x) => x.token === t) ?? FAMILIES[f][0];
    playDictChord(v.dictId);
  }

  return (
    <div>
      {/* Trecho real, lado a lado: cifra simples × cifra Kordi */}
      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <CifraCard
          title="Cifra simplificada"
          badge="como se acha por aí"
          lines={SIMPLE_LINES}
          selectedToken={token}
          onPick={pick}
        />
        <CifraCard
          title="Cifra Kordi"
          badge="sofisticada"
          kordi
          lines={KORDI_LINES}
          selectedToken={token}
          onPick={pick}
        />
      </div>

      {/* Variações do acorde clicado — dados reais do dicionário */}
      <div className="flex flex-wrap gap-2 mb-5">
        {variations.map((v) => (
          <button
            key={v.token}
            type="button"
            onClick={() => pick(family, v.token)}
            className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all transform hover:scale-[1.02] active:scale-95 ${
              v.token === current.token
                ? v.common
                  ? "bg-slate-800 text-white shadow-md shadow-slate-900/20"
                  : "bg-gradient-to-br from-primary to-[#8B5CF6] text-white shadow-lg shadow-primary/30 ring-2 ring-primary/20 ring-offset-2"
                : "bg-white border border-slate-200 text-slate-600 hover:border-primary/40 hover:text-primary shadow-sm"
            }`}
          >
            {v.token}
            <span
              className={`ml-2 text-[10px] font-bold uppercase tracking-widest ${
                v.token === current.token
                  ? v.common
                    ? "text-slate-300"
                    : "text-white/80"
                  : "text-slate-400"
              }`}
            >
              {v.common ? "simples" : "Kordi"}
            </span>
          </button>
        ))}
      </div>

      <div className="bg-white border border-slate-100 rounded-3xl p-6 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all">
        <PianoKeyboard
          leftHandNotes={leftHand}
          rightHandNotes={rightHand}
          className="w-full max-w-full drop-shadow-sm"
        />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 mt-8">
          <p className="text-sm text-slate-500 leading-relaxed max-w-md">
            <span
              className={`inline-block text-[10px] font-bold uppercase tracking-widest rounded-full px-2.5 py-1 mr-3 align-middle transition-colors ${
                current.common
                  ? "bg-slate-100 text-slate-500"
                  : "bg-primary/10 text-primary border border-primary/20"
              }`}
            >
              {current.badge}
            </span>
            {chord.description}
          </p>
          <button
            type="button"
            onClick={() => playDictChord(current.dictId)}
            className="group flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-white border border-slate-200 hover:border-primary/50 hover:bg-primary/5 text-slate-700 hover:text-primary text-sm font-bold transition-all shadow-sm shrink-0 active:scale-95"
          >
            <Play className="w-4 h-4 text-primary fill-primary/20 group-hover:fill-primary transition-all" />
            Ouvir {current.token}
          </button>
        </div>
      </div>
      <p className="text-xs text-slate-400 mt-4 px-2">
        Trecho de "Santo Pra Sempre" (Gabriel Guedes). Toque em qualquer acorde
        das duas cifras para ver e ouvir as variações — som de piano de
        verdade, gravado nota a nota, direto do dicionário do Kordi.
      </p>
    </div>
  );
}

// ─── 2. Cifras inteligentes (transposição ao vivo) ──────────────────────────

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
      <div className="flex items-center gap-4 mb-5">
        <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Mudar Tom:</span>
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-full p-1.5 shadow-sm">
          <button
            type="button"
            onClick={() => bump(-1)}
            aria-label="Baixar meio tom"
            className="w-10 h-10 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors active:scale-90"
          >
            <Minus className="w-5 h-5" />
          </button>
          <span className="font-display font-bold text-xl w-14 text-center text-primary">
            {key}
          </span>
          <button
            type="button"
            onClick={() => bump(1)}
            aria-label="Subir meio tom"
            className="w-10 h-10 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors active:scale-90"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
        {semis !== 0 && (
          <button
            type="button"
            onClick={() => setSemis(0)}
            className="text-xs font-semibold text-slate-400 hover:text-primary transition-colors underline underline-offset-4"
          >
            Voltar para C
          </button>
        )}
      </div>

      <div className="bg-[#FAF7F0] text-stone-800 rounded-3xl p-6 sm:p-8 overflow-x-auto shadow-inner border border-[#EBE5D9]">
        <pre className="font-mono text-[14px] sm:text-base leading-relaxed whitespace-pre">
          {chart.split("\n").map((line, i) => {
            const kind = classifyLine(line);
            if (kind === "section") {
              return (
                <div key={i} className="text-stone-400 font-bold uppercase tracking-widest text-xs mb-1 mt-2">
                  {line.replace(/[\[\]]/g, '')}
                </div>
              );
            }
            if (kind === "chords") {
              return (
                <div key={i} className="text-[#7C3AED] font-bold text-[1.05em]">
                  {line}
                </div>
              );
            }
            return <div key={i} className="text-stone-700">{line || "\u00A0"}</div>;
          })}
        </pre>
      </div>
      <p className="text-xs text-slate-400 mt-4 px-2">
        Só os acordes mudam — a letra fica intacta e alinhada. O Sofisticador (no app) ainda troca acordes simples por versões sofisticadas.
      </p>
    </div>
  );
}

// ─── 3. Audio Lab: animação roteirizada do fluxo real ───────────────────────

const TYPED_TITLE = "Midian Lima - Jó";
const LAB_BPM = 64.6;
const LAB_FIRST_BEAT = 0.372;

type LabStep = "typing" | "searching" | "found" | "downloading" | "separating" | "mixer";

const STEP_AFTER: Record<LabStep, { next: LabStep; delay: number }> = {
  typing: { next: "searching", delay: 600 },
  searching: { next: "found", delay: 1500 },
  found: { next: "downloading", delay: 1600 },
  downloading: { next: "separating", delay: 2200 },
  separating: { next: "mixer", delay: 2400 },
  mixer: { next: "mixer", delay: 0 },
};

type LabChannelId = "voz" | "instrumental" | "metronomo";

const MIXER_CHANNELS: {
  id: LabChannelId;
  label: string;
  color: string;
  file: string | null;
}[] = [
  { id: "voz", label: "Voz", color: "#9673FF", file: "lab-voz.mp3" },
  { id: "instrumental", label: "Instrumental", color: "#10B981", file: "lab-instrumental.mp3" },
  { id: "metronomo", label: "Metrônomo", color: "#F59E0B", file: null },
];

function ProgressBar({ running, ms }: { running: boolean; ms: number }) {
  return (
    <div className="h-2 bg-slate-100 rounded-full overflow-hidden w-full mt-3 border border-slate-200/60">
      <div
        className="h-full rounded-full bg-gradient-to-r from-primary to-[#C24BF7]"
        style={{
          width: running ? "100%" : "0%",
          transition: running ? `width ${ms}ms linear` : "none",
        }}
      />
    </div>
  );
}

export function AudioLabDemo() {
  const [step, setStep] = useState<LabStep>("typing");
  const [typed, setTyped] = useState("");
  const [cycle, setCycle] = useState(0);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    const timers = timersRef.current;
    setStep("typing");
    setTyped("");
    for (let i = 1; i <= TYPED_TITLE.length; i++) {
      timers.push(
        window.setTimeout(() => setTyped(TYPED_TITLE.slice(0, i)), 350 + i * 90),
      );
    }
    let acc = 350 + TYPED_TITLE.length * 90;
    let cur: LabStep = "typing";
    while (cur !== "mixer") {
      const info: { next: LabStep; delay: number } = STEP_AFTER[cur];
      acc += info.delay;
      const target = info.next;
      timers.push(window.setTimeout(() => setStep(target), acc));
      cur = info.next;
    }
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      timersRef.current = [];
    };
  }, [cycle]);

  const stepIndex: Record<LabStep, number> = {
    typing: 0,
    searching: 1,
    found: 1,
    downloading: 2,
    separating: 3,
    mixer: 4,
  };
  const idx = stepIndex[step];

  const [labPlaying, setLabPlaying] = useState(false);
  const [labLoading, setLabLoading] = useState(false);
  const [labError, setLabError] = useState(false);
  const [vols, setVols] = useState<Record<LabChannelId, number>>({
    voz: 0.9,
    instrumental: 0.9,
    metronomo: 0.4,
  });
  const volsRef = useRef(vols);
  volsRef.current = vols;
  const labBuffersRef = useRef<Map<LabChannelId, AudioBuffer> | null>(null);
  const labOffsetRef = useRef(0);
  const labSeqRef = useRef(0);
  const labLoadingRef = useRef(false);
  const labPlayRef = useRef<{
    srcs: AudioBufferSourceNode[];
    gains: Map<LabChannelId, GainNode>;
    startedAt: number;
    offset: number;
    endTimer: number;
  } | null>(null);

  function stopLab(remember: boolean) {
    const pb = labPlayRef.current;
    labPlayRef.current = null;
    setLabPlaying(false);
    if (!pb) return;
    window.clearTimeout(pb.endTimer);
    const a = getAudio();
    const elapsed = a ? Math.max(0, a.ctx.currentTime - pb.startedAt) : 0;
    labOffsetRef.current = remember ? pb.offset + elapsed : 0;
    pb.srcs.forEach((s) => {
      s.onended = null;
      try { s.stop(); } catch {}
      try { s.disconnect(); } catch {}
    });
    pb.gains.forEach((g) => g.disconnect());
  }

  function cancelPendingLab() {
    labSeqRef.current += 1;
    labLoadingRef.current = false;
    setLabLoading(false);
  }

  useEffect(() => {
    return () => {
      cancelPendingLab();
      stopLab(false);
    };
  }, []);

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

  async function startLab() {
    const a = getAudio();
    if (!a || labLoadingRef.current) return;
    const seq = ++labSeqRef.current;
    if (!labBuffersRef.current) {
      labLoadingRef.current = true;
      setLabLoading(true);
      try {
        const withFile = MIXER_CHANNELS.filter(
          (c): c is (typeof MIXER_CHANNELS)[number] & { file: string } => !!c.file,
        );
        const entries = await Promise.all(
          withFile.map(async (c) => {
            const r = await fetch(`${import.meta.env.BASE_URL}landing/${c.file}`);
            if (!r.ok) throw new Error(String(r.status));
            const buf = await a.ctx.decodeAudioData(await r.arrayBuffer());
            return [c.id, buf] as const;
          }),
        );
        if (seq !== labSeqRef.current) return;
        labBuffersRef.current = new Map(entries);
        setLabError(false);
      } catch {
        if (seq === labSeqRef.current) setLabError(true);
        return;
      } finally {
        if (seq === labSeqRef.current) {
          labLoadingRef.current = false;
          setLabLoading(false);
        }
      }
    }
    if (seq !== labSeqRef.current) return;
    stopLab(true);
    const buffers = labBuffersRef.current;
    const dur = buffers.get("voz")?.duration ?? 30;
    let offset = labOffsetRef.current;
    if (offset >= dur - 0.25) offset = 0;
    const t0 = a.ctx.currentTime + 0.08;
    const gains = new Map<LabChannelId, GainNode>();
    const srcs: AudioBufferSourceNode[] = [];
    for (const ch of MIXER_CHANNELS) {
      const g = a.ctx.createGain();
      g.gain.value = volsRef.current[ch.id];
      g.connect(a.ctx.destination);
      gains.set(ch.id, g);
      const buf = ch.file ? buffers.get(ch.id) : undefined;
      if (buf) {
        const src = a.ctx.createBufferSource();
        src.buffer = buf;
        src.connect(g);
        src.start(t0, offset);
        srcs.push(src);
      }
    }
    const clickGain = gains.get("metronomo");
    if (clickGain) {
      const beat = 60 / LAB_BPM;
      for (let k = 0; LAB_FIRST_BEAT + k * beat <= dur; k++) {
        const bt = LAB_FIRST_BEAT + k * beat;
        if (bt < offset) continue;
        clickAt(a.ctx, clickGain, t0 + (bt - offset), k % 4 === 0);
      }
    }
    const endTimer = window.setTimeout(
      () => stopLab(false),
      (dur - offset) * 1000 + 300,
    );
    labPlayRef.current = { srcs, gains, startedAt: t0, offset, endTimer };
    setLabPlaying(true);
  }

  function setChannelVol(id: LabChannelId, v: number) {
    setVols((p) => ({ ...p, [id]: v }));
    const g = labPlayRef.current?.gains.get(id);
    if (g) g.gain.value = v;
  }

  return (
    <div className="bg-white border border-slate-100 rounded-3xl p-6 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
      {/* Campo de busca */}
      <div className="flex items-center gap-3 bg-white border-2 border-slate-100 rounded-2xl px-5 py-4 mb-6 shadow-sm focus-within:border-primary/30 transition-colors">
        <Search className="w-5 h-5 text-slate-400 shrink-0" />
        <span className="font-sans font-medium text-slate-800 text-base sm:text-lg">
          {typed || <span className="text-slate-300 font-normal">Digite uma música...</span>}
          {step === "typing" && (
            <span className="inline-block w-0.5 h-5 bg-primary align-middle ml-1 animate-pulse" />
          )}
        </span>
      </div>

      {/* Etapas */}
      <div className="space-y-3 mb-8">
        {/* Cifra */}
        <div
          className={`flex items-center gap-4 rounded-2xl border px-5 py-4 transition-all duration-500 shadow-sm ${
            idx >= 1
              ? "bg-white border-slate-200 opacity-100"
              : "bg-slate-50 border-transparent opacity-40 grayscale"
          }`}
        >
          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${idx > 1 || step === "found" ? "bg-emerald-100 text-emerald-600" : "bg-primary/10 text-primary"}`}>
            {step === "searching" ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : idx > 1 || step === "found" ? (
              <Check className="w-5 h-5" />
            ) : (
              <FileText className="w-5 h-5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-800">
              {step === "searching" ? "Encontrando a cifra..." : "Cifra encontrada"}
            </p>
            {(idx > 1 || step === "found") && (
              <p className="font-mono text-xs text-primary truncate mt-1 bg-primary/5 inline-block px-2 py-0.5 rounded">
                G   C/G  G   D7   G — Tom: G
              </p>
            )}
          </div>
        </div>

        {/* Download */}
        <div
          className={`rounded-2xl border px-5 py-4 transition-all duration-500 shadow-sm ${
            idx >= 2
              ? "bg-white border-slate-200 opacity-100"
              : "bg-slate-50 border-transparent opacity-40 grayscale"
          }`}
        >
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${idx > 2 ? "bg-emerald-100 text-emerald-600" : "bg-primary/10 text-primary"}`}>
              {step === "downloading" ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : idx > 2 ? (
                <Check className="w-5 h-5" />
              ) : (
                <Download className="w-5 h-5" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-slate-800">
                {step === "downloading" ? "Baixando o áudio..." : idx > 2 ? "Áudio vinculado" : "Baixar áudio"}
              </p>
            </div>
          </div>
          {idx >= 2 && <ProgressBar running={step === "downloading" || idx > 2} ms={2000} />}
        </div>

        {/* Separação */}
        <div
          className={`rounded-2xl border px-5 py-4 transition-all duration-500 shadow-sm ${
            idx >= 3
              ? "bg-white border-slate-200 opacity-100"
              : "bg-slate-50 border-transparent opacity-40 grayscale"
          }`}
        >
          <div className="flex items-center gap-4">
             <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${idx > 3 ? "bg-emerald-100 text-emerald-600" : "bg-primary/10 text-primary"}`}>
              {step === "separating" ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : idx > 3 ? (
                <Check className="w-5 h-5" />
              ) : (
                <Scissors className="w-5 h-5" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-slate-800">
                {step === "separating" ? "Separando instrumentos..." : idx > 3 ? "Separação concluída" : "Separar faixas"}
              </p>
            </div>
          </div>
          {idx >= 3 && <ProgressBar running={step === "separating" || idx > 3} ms={2200} />}
        </div>
      </div>

      {/* Mesa de mistura */}
      <div
        className={`transition-all duration-700 bg-slate-50 border border-slate-200 rounded-3xl p-6 ${
          step === "mixer" ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none h-0 overflow-hidden hidden"
        }`}
      >
        <style>{`@keyframes kordi-wave { from { transform: scaleY(0.45); } to { transform: scaleY(1.05); } }`}</style>

        <div className="flex items-center gap-4 mb-6">
          <button
            type="button"
            onClick={() => {
              if (labLoading) cancelPendingLab();
              else if (labPlaying) stopLab(true);
              else void startLab();
            }}
            aria-label={labLoading ? "Cancelar carregamento" : labPlaying ? "Pausar mesa de som" : "Tocar mesa de som"}
            className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-[#8B5CF6] text-white flex items-center justify-center shadow-lg shadow-primary/30 hover:shadow-xl hover:scale-105 transition-all shrink-0 active:scale-95"
          >
            {labLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : labPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1 fill-white" />}
          </button>
          <div className="min-w-0">
            <p className="text-base font-bold text-slate-900 truncate">Jó — Midian Lima</p>
            <p className="text-sm text-slate-500">
              Aperte o play e teste os volumes separados.
            </p>
          </div>
        </div>
        {labError && (
          <p className="text-sm font-medium text-rose-500 mb-4 bg-rose-50 p-3 rounded-lg">
            Erro ao carregar o áudio. Tente novamente.
          </p>
        )}

        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          {MIXER_CHANNELS.map(({ id, label, color }, ch) => (
            <div key={id} className="bg-white border border-slate-200 shadow-sm rounded-2xl p-4 flex flex-col items-center">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-4">{label}</span>
              <div className="flex items-end justify-center gap-1 h-12 w-full mb-4 px-2" aria-hidden="true">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-full max-w-[4px]"
                    style={{
                      height: `${(30 + 65 * Math.abs(Math.sin(i * 0.8 + ch * 2.1))) * Math.max(0.15, vols[id])}%`,
                      backgroundColor: color,
                      opacity: labPlaying ? 0.9 : 0.2,
                      animation: `kordi-wave ${0.7 + ch * 0.15}s ease-in-out ${i * 0.05}s infinite alternate`,
                      animationPlayState: labPlaying ? "running" : "paused",
                      transition: "opacity 0.4s",
                    }}
                  />
                ))}
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(vols[id] * 100)}
                onChange={(e) => setChannelVol(id, Number(e.target.value) / 100)}
                aria-label={`Volume do canal ${label}`}
                className="w-full h-2 rounded-full cursor-pointer appearance-none bg-slate-200"
                style={{ accentColor: color }}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
        <p className="text-sm text-slate-500 leading-relaxed text-center sm:text-left px-2">
          Isto é áudio real separado no navegador. O Kordi acha a cifra, baixa o áudio e gera as faixas isoladas para você estudar.
        </p>
        <button
          type="button"
          onClick={() => {
            cancelPendingLab();
            stopLab(false);
            setCycle((c) => c + 1);
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-600 text-sm font-bold transition-all shadow-sm shrink-0 active:scale-95"
        >
          <RotateCcw className="w-4 h-4 text-primary" />
          Repetir
        </button>
      </div>
    </div>
  );
}

// ─── 4. Metrônomo ────────────────────────────────────────────────────────────

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
  }, [playing]);

  return (
    <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] h-full flex flex-col justify-center">
      <div className="flex items-center justify-between mb-6">
        <span className="text-sm font-bold text-slate-800 uppercase tracking-wider">Metrônomo</span>
        <div className="flex gap-2" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full transition-all duration-100 ${
                beat === i
                  ? i === 0
                    ? "bg-primary scale-125 shadow-md shadow-primary/40 ring-2 ring-primary/20"
                    : "bg-slate-700 scale-110"
                  : "bg-slate-200"
              }`}
            />
          ))}
        </div>
      </div>
      <div className="flex items-center gap-5">
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? "Parar metrônomo" : "Tocar metrônomo"}
          className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-[#8B5CF6] text-white flex items-center justify-center shadow-lg shadow-primary/30 hover:scale-105 hover:shadow-xl transition-all shrink-0 active:scale-95"
        >
          {playing ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-1 fill-white" />}
        </button>
        <div className="flex-1 bg-slate-50 border border-slate-100 rounded-2xl p-4">
          <div className="flex items-baseline justify-center gap-1 mb-2">
            <span className="font-display font-black text-3xl text-slate-900">{bpm}</span>
            <span className="text-xs font-bold text-slate-400">BPM</span>
          </div>
          <input
            type="range"
            min={60}
            max={160}
            value={bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
            aria-label="Andamento em BPM"
            className="w-full h-2 bg-slate-200 rounded-full appearance-none cursor-pointer"
            style={{ accentColor: "#9673FF" }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── 5. Pads contínuos com Fade In/Out e Low Cut reais ──────────────────────

const PAD_KEYS: { label: string; file: string }[] = [
  { label: "C", file: "C" },
  { label: "D", file: "D" },
  { label: "E", file: "E" },
  { label: "F", file: "F" },
  { label: "G", file: "G" },
  { label: "A", file: "A" },
];

const LOWCUT_MIN = 20;
const LOWCUT_MAX = 300;

export function PadsDemo() {
  const [active, setActive] = useState<string | null>(null);
  const [fadeIn, setFadeIn] = useState(3);
  const [fadeOut, setFadeOut] = useState(4);
  const [lowCutHz, setLowCutHz] = useState(85);
  const [lowCutOn, setLowCutOn] = useState(false);

  const currentRef = useRef<{ src: AudioBufferSourceNode; gain: GainNode } | null>(null);
  const filterRef = useRef<BiquadFilterNode | null>(null);
  const buffersRef = useRef(new Map<string, Promise<AudioBuffer | null>>());
  const requestRef = useRef(0);
  const fadeInRef = useRef(fadeIn);
  const fadeOutRef = useRef(fadeOut);
  fadeInRef.current = fadeIn;
  fadeOutRef.current = fadeOut;

  useEffect(() => {
    return () => {
      requestRef.current++;
      stopPad(0.15);
      filterRef.current?.disconnect();
      filterRef.current = null;
    };
  }, []);

  function getFilter(ctx: AudioContext): BiquadFilterNode {
    if (!filterRef.current) {
      const f = ctx.createBiquadFilter();
      f.type = "highpass";
      f.Q.value = 0.707;
      f.frequency.value = lowCutOn ? lowCutHz : LOWCUT_MIN;
      f.connect(ctx.destination);
      filterRef.current = f;
    }
    return filterRef.current;
  }

  useEffect(() => {
    const f = filterRef.current;
    const a = getAudio();
    if (!f || !a) return;
    const target = lowCutOn ? lowCutHz : LOWCUT_MIN;
    const t = a.ctx.currentTime;
    f.frequency.cancelScheduledValues(t);
    f.frequency.setValueAtTime(f.frequency.value, t);
    f.frequency.linearRampToValueAtTime(target, t + 0.08);
  }, [lowCutHz, lowCutOn]);

  function stopPad(fade?: number) {
    const cur = currentRef.current;
    currentRef.current = null;
    if (!cur) return;
    const a = getAudio();
    if (!a) return;
    const dur = fade ?? fadeOutRef.current;
    const t = a.ctx.currentTime;
    cur.gain.gain.cancelScheduledValues(t);
    cur.gain.gain.setValueAtTime(cur.gain.gain.value, t);
    cur.gain.gain.linearRampToValueAtTime(0.0001, t + dur);
    cur.src.stop(t + dur + 0.05);
  }

  function attachTeardown(src: AudioBufferSourceNode, g: GainNode) {
    src.onended = () => {
      src.onended = null;
      try {
        src.disconnect();
        g.disconnect();
      } catch {}
    };
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
    if (!buffer || req !== requestRef.current) return;
    const src = a.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const g = a.ctx.createGain();
    const t = a.ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.9, t + fadeInRef.current);
    src.connect(g).connect(getFilter(a.ctx));
    attachTeardown(src, g);
    src.start(t);
    currentRef.current = { src, gain: g };
  }

  return (
    <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] h-full flex flex-col">
      <div className="flex items-center justify-between mb-5">
        <span className="text-sm font-bold text-slate-800 uppercase tracking-wider">Pad Worship</span>
        {active && (
          <span className="text-xs font-bold text-primary animate-pulse bg-primary/10 px-2 py-1 rounded-md">
            Tocando {active}
          </span>
        )}
      </div>

      <div className="grid grid-cols-6 gap-2 mb-6">
        {PAD_KEYS.map(({ label, file }) => (
          <button
            key={file}
            type="button"
            onClick={() => void playPad(file)}
            className={`h-12 rounded-xl font-black text-sm transition-all active:scale-95 ${
              active === file
                ? "bg-gradient-to-br from-primary to-[#8B5CF6] text-white shadow-lg shadow-primary/30 ring-2 ring-primary/20 ring-offset-1 scale-105"
                : "bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-primary/40 hover:text-primary"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-4 flex-1">
        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            <span>Fade In</span>
            <span className="text-primary">{fadeIn.toFixed(1)}s</span>
          </div>
          <input
            type="range"
            min={0.5}
            max={8}
            step={0.5}
            value={fadeIn}
            onChange={(e) => setFadeIn(Number(e.target.value))}
            className="w-full h-2 bg-slate-200 rounded-full appearance-none cursor-pointer"
            style={{ accentColor: "#9673FF" }}
          />
        </div>
        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            <span>Fade Out</span>
            <span className="text-primary">{fadeOut.toFixed(1)}s</span>
          </div>
          <input
            type="range"
            min={0.5}
            max={8}
            step={0.5}
            value={fadeOut}
            onChange={(e) => setFadeOut(Number(e.target.value))}
            className="w-full h-2 bg-slate-200 rounded-full appearance-none cursor-pointer"
            style={{ accentColor: "#9673FF" }}
          />
        </div>
        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => setLowCutOn((v) => !v)}
              className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider transition-colors outline-none ${
                lowCutOn ? "text-primary" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <div
                className={`w-8 h-4.5 rounded-full relative transition-colors ${
                  lowCutOn ? "bg-primary" : "bg-slate-300"
                }`}
              >
                <div
                  className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-all shadow-sm ${
                    lowCutOn ? "left-[18px]" : "left-0.5"
                  }`}
                />
              </div>
              Low Cut
            </button>
            <span className={`text-xs font-bold ${lowCutOn ? "text-primary" : "text-slate-400"}`}>
              {lowCutHz} Hz
            </span>
          </div>
          <input
            type="range"
            min={LOWCUT_MIN}
            max={LOWCUT_MAX}
            step={5}
            value={lowCutHz}
            disabled={!lowCutOn}
            onChange={(e) => setLowCutHz(Number(e.target.value))}
            className={`w-full h-2 bg-slate-200 rounded-full appearance-none transition-opacity ${
              lowCutOn ? "cursor-pointer" : "opacity-40 cursor-not-allowed"
            }`}
            style={{ accentColor: "#9673FF" }}
          />
        </div>
      </div>
    </div>
  );
}
