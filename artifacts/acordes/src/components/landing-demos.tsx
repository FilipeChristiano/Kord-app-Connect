/**
 * Demonstrações interativas da página pública de venda (/assinar).
 *
 * Todas reutilizam os motores reais do app:
 * - AcordeDemo    → forma comum × variações sofisticadas (PianoKeyboard +
 *                   playChordVoicing com samples reais de piano)
 * - CifraDemo     → transposeChart/classifyLine (mesma transposição do app)
 * - AudioLabDemo  → animação roteirizada do fluxo real (pesquisa → cifra →
 *                   áudio → separação Voz/Instrumental/Metrônomo)
 * - MetronomoDemo → metrônomo Web Audio (mesmo timbre do app)
 * - PadsDemo      → pads reais com Fade In/Out e Low Cut funcionais
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

// ─── 1. Dicionário: forma comum × variações sofisticadas ────────────────────

interface DemoVoicing {
  name: string;
  badge: string;
  left: string[];
  right: string[];
  hint: string;
  common?: boolean;
}

const C_VOICINGS: DemoVoicing[] = [
  {
    name: "C",
    badge: "Forma comum",
    common: true,
    left: ["C"],
    right: ["C", "E", "G"],
    hint: "A tríade básica, do jeito que todo mundo copia da internet. Funciona — mas soa igual em todo lugar.",
  },
  {
    name: "C7M",
    badge: "Variação Kordi",
    left: ["C", "G"],
    right: ["C", "E", "G", "B"],
    hint: "A sétima maior abre o acorde — som elegante, com a mão esquerda sustentando o grave.",
  },
  {
    name: "Cadd9",
    badge: "Variação Kordi",
    left: ["C", "G"],
    right: ["C", "E", "G", "D"],
    hint: "A nona adicionada traz brilho moderno — muito usada no worship e no pop.",
  },
  {
    name: "C6",
    badge: "Variação Kordi",
    left: ["C", "G"],
    right: ["C", "E", "G", "A"],
    hint: "A sexta dá um colorido vintage e suave — ótima para finais de frase.",
  },
];

export function AcordeDemo() {
  const [selected, setSelected] = useState(1);
  const v = C_VOICINGS[selected];

  function choose(i: number) {
    setSelected(i);
    playChordVoicing(C_VOICINGS[i].left, C_VOICINGS[i].right);
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-5">
        {C_VOICINGS.map((c, i) => (
          <button
            key={c.name}
            type="button"
            onClick={() => choose(i)}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
              i === selected
                ? c.common
                  ? "bg-white/20 text-white"
                  : "bg-gradient-to-br from-primary to-primary-700 text-primary-foreground shadow-lg shadow-primary/25"
                : "bg-white/5 border border-white/10 text-white/70 hover:bg-white/10"
            }`}
          >
            {c.name}
            <span
              className={`ml-2 text-[10px] font-bold uppercase tracking-wide ${
                c.common ? "text-white/50" : "text-primary-foreground/70"
              } ${i === selected ? "" : "text-white/40"}`}
            >
              {c.common ? "comum" : "Kordi"}
            </span>
          </button>
        ))}
      </div>

      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 sm:p-6">
        <PianoKeyboard
          leftHandNotes={v.left}
          rightHandNotes={v.right}
          className="w-full"
        />
        <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
          <p className="text-sm text-white/60 leading-relaxed max-w-md">
            <span
              className={`inline-block text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 mr-2 align-middle ${
                v.common
                  ? "bg-white/10 text-white/60"
                  : "bg-primary/15 text-primary border border-primary/25"
              }`}
            >
              {v.badge}
            </span>
            {v.hint}
          </p>
          <button
            type="button"
            onClick={() => playChordVoicing(v.left, v.right)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-sm font-medium transition-colors shrink-0"
          >
            <Play className="w-4 h-4 text-primary" />
            Ouvir {v.name}
          </button>
        </div>
      </div>
      <p className="text-xs text-white/40 mt-3">
        Compare a forma comum com as variações do Kordi — som de piano de
        verdade, gravado nota a nota. No app, todos os acordes têm variações
        assim.
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
        Só os acordes mudam — a letra fica intacta e alinhada, como no app. E o
        Sofisticador ainda troca os acordes simples por versões sofisticadas.
      </p>
    </div>
  );
}

// ─── 3. Audio Lab: animação roteirizada do fluxo real ───────────────────────

// Roteiro: digitar título → encontrar cifra → baixar áudio → separar → mesa.
// Trecho de 30s enviado pelo dono do app; stems separados com o mesmo motor
// de máxima qualidade do Audio Lab (Demucs). BPM/1º tempo medidos do trecho.
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
  { id: "instrumental", label: "Instrumental", color: "#34d399", file: "lab-instrumental.mp3" },
  { id: "metronomo", label: "Metrônomo", color: "#fbbf24", file: null },
];

function ProgressBar({ running, ms }: { running: boolean; ms: number }) {
  return (
    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
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

  // Roteiro: digita o título letra a letra, depois avança pelos passos.
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

  // ── Mesa de mistura REAL: stems do trecho separados pelo Kordi ──
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
  // Token de geração: invalida startLab() pendente após cancelar/reiniciar,
  // para o áudio nunca começar "sozinho" depois de um reset.
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
      try {
        s.stop();
      } catch {
        /* já parado */
      }
      try {
        s.disconnect();
      } catch {
        /* já desconectado */
      }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    // Cliques do metrônomo ancorados no relógio do AudioContext (sem deriva)
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
    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 sm:p-6">
      {/* Campo de busca com digitação */}
      <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3 mb-4">
        <Search className="w-4 h-4 text-white/40 shrink-0" />
        <span className="font-mono text-sm sm:text-base">
          {typed}
          {step === "typing" && (
            <span className="inline-block w-[2px] h-4 bg-primary align-middle ml-0.5 animate-pulse" />
          )}
        </span>
      </div>

      {/* Etapas */}
      <div className="space-y-2.5 mb-4">
        {/* Cifra encontrada */}
        <div
          className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-all duration-500 ${
            idx >= 1
              ? "bg-white/5 border-white/10 opacity-100"
              : "border-transparent opacity-30"
          }`}
        >
          {step === "searching" ? (
            <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
          ) : idx > 1 || step === "found" ? (
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <FileText className="w-4 h-4 text-white/30 shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">
              {step === "searching" ? "Encontrando a cifra…" : "Cifra encontrada"}
            </p>
            {(idx > 1 || step === "found") && (
              <p className="font-mono text-xs text-[#b79aff] truncate">
                G&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;C/G&nbsp;&nbsp;&nbsp;&nbsp;G&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;D7&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;G — tom detectado: G
              </p>
            )}
          </div>
          <Music2 className={`w-4 h-4 shrink-0 ${idx >= 1 ? "text-primary" : "text-white/20"}`} />
        </div>

        {/* Download do áudio */}
        <div
          className={`rounded-xl border px-4 py-3 transition-all duration-500 ${
            idx >= 2
              ? "bg-white/5 border-white/10 opacity-100"
              : "border-transparent opacity-30"
          }`}
        >
          <div className="flex items-center gap-3 mb-2">
            {step === "downloading" ? (
              <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
            ) : idx > 2 ? (
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <Download className="w-4 h-4 text-white/30 shrink-0" />
            )}
            <p className="text-sm font-medium">
              {step === "downloading"
                ? "Baixando o áudio…"
                : idx > 2
                  ? "Áudio vinculado"
                  : "Baixar o áudio"}
            </p>
          </div>
          {idx >= 2 && (
            <ProgressBar running={step === "downloading" || idx > 2} ms={2000} />
          )}
        </div>

        {/* Separação */}
        <div
          className={`rounded-xl border px-4 py-3 transition-all duration-500 ${
            idx >= 3
              ? "bg-white/5 border-white/10 opacity-100"
              : "border-transparent opacity-30"
          }`}
        >
          <div className="flex items-center gap-3 mb-2">
            {step === "separating" ? (
              <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
            ) : idx > 3 ? (
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <Scissors className="w-4 h-4 text-white/30 shrink-0" />
            )}
            <p className="text-sm font-medium">
              {step === "separating"
                ? "Separando voz e instrumentos…"
                : idx > 3
                  ? "Separação concluída"
                  : "Separar voz e instrumentos"}
            </p>
          </div>
          {idx >= 3 && (
            <ProgressBar running={step === "separating" || idx > 3} ms={2200} />
          )}
        </div>
      </div>

      {/* Mesa de mistura */}
      <div
        className={`transition-all duration-700 ${
          step === "mixer" ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none h-0 overflow-hidden"
        }`}
      >
        <style>{`@keyframes kordi-wave { from { transform: scaleY(0.45); } to { transform: scaleY(1.05); } }`}</style>

        {/* Player real: stems do trecho separados pelo Kordi */}
        <div className="flex items-center gap-3 mb-3">
          <button
            type="button"
            onClick={() => {
              if (labLoading) {
                cancelPendingLab();
              } else if (labPlaying) {
                stopLab(true);
              } else {
                void startLab();
              }
            }}
            aria-label={labPlaying ? "Pausar trecho" : "Ouvir trecho separado"}
            className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary-700 text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/25 hover:brightness-110 transition-all shrink-0"
          >
            {labLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : labPlaying ? (
              <Pause className="w-5 h-5" />
            ) : (
              <Play className="w-5 h-5 ml-0.5" />
            )}
          </button>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">Jó — Midian Lima</p>
            <p className="text-xs text-white/50">
              Trecho de 30s separado pelo Kordi — aperte o play e mexa nos
              volumes de cada canal
            </p>
          </div>
        </div>
        {labError && (
          <p className="text-xs text-rose-400 mb-3">
            Não foi possível carregar o áudio da demonstração. Tente de novo.
          </p>
        )}

        <div className="grid grid-cols-3 gap-2.5">
          {MIXER_CHANNELS.map(({ id, label, color }, ch) => (
            <div
              key={id}
              className="bg-white/5 border border-white/10 rounded-xl p-3"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold truncate">{label}</span>
                <Volume2 className="w-3.5 h-3.5 shrink-0" style={{ color }} />
              </div>
              <div className="flex items-end gap-[2px] h-10 mb-2" aria-hidden="true">
                {Array.from({ length: 14 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-full"
                    style={{
                      height: `${(30 + 65 * Math.abs(Math.sin(i * 0.8 + ch * 2.1))) * Math.max(0.15, vols[id])}%`,
                      backgroundColor: color,
                      opacity: labPlaying ? 0.9 : 0.35,
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
                className="w-full"
                style={{ accentColor: color }}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 mt-4">
        <p className="text-xs text-white/40 leading-relaxed">
          Fluxo real do Audio Lab: digite o nome, o Kordi acha a cifra, vincula
          o áudio e separa Voz, Instrumental e Metrônomo — e o resultado acima
          é áudio de verdade, separado pelo Kordi.
        </p>
        <button
          type="button"
          onClick={() => {
            cancelPendingLab();
            stopLab(false);
            setCycle((c) => c + 1);
          }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-medium transition-colors shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5 text-primary" />
          Ver de novo
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cadeia: pad → gain (fades) → filtro low cut (highpass) → saída.
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

  // Aplica o low cut em tempo real, com rampa curta (sem estalos) —
  // mesma lógica da tela real de pads.
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

  // Desconecta src/gain assim que o pad termina, evitando acúmulo de nós
  function attachTeardown(src: AudioBufferSourceNode, g: GainNode) {
    src.onended = () => {
      src.onended = null;
      try {
        src.disconnect();
        g.disconnect();
      } catch {
        /* já desconectado */
      }
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
    // Se o usuário mudou de pad (ou parou) enquanto carregava, não toca este
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
    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-semibold">Pads contínuos</span>
        {active && (
          <span className="text-xs text-primary font-medium animate-pulse">
            tocando em {active}
          </span>
        )}
      </div>

      <div className="grid grid-cols-6 gap-2 mb-4">
        {PAD_KEYS.map(({ label, file }) => (
          <button
            key={file}
            type="button"
            onClick={() => void playPad(file)}
            className={`h-11 rounded-xl font-semibold text-sm transition-all ${
              active === file
                ? "bg-gradient-to-br from-primary to-primary-700 text-primary-foreground shadow-lg shadow-primary/30"
                : "bg-white/5 border border-white/10 text-white/70 hover:bg-white/10"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Controles reais: Fade In / Fade Out / Low Cut */}
      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-white/60">Fade In</span>
            <span className="text-white/80 font-medium">{fadeIn.toFixed(1)}s</span>
          </div>
          <input
            type="range"
            min={0.5}
            max={8}
            step={0.5}
            value={fadeIn}
            onChange={(e) => setFadeIn(Number(e.target.value))}
            aria-label="Duração do fade in"
            className="w-full accent-[#9673FF]"
          />
        </div>
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-white/60">Fade Out</span>
            <span className="text-white/80 font-medium">{fadeOut.toFixed(1)}s</span>
          </div>
          <input
            type="range"
            min={0.5}
            max={8}
            step={0.5}
            value={fadeOut}
            onChange={(e) => setFadeOut(Number(e.target.value))}
            aria-label="Duração do fade out"
            className="w-full accent-[#9673FF]"
          />
        </div>
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <button
              type="button"
              onClick={() => setLowCutOn((v) => !v)}
              className={`flex items-center gap-1.5 font-medium transition-colors ${
                lowCutOn ? "text-primary" : "text-white/60 hover:text-white/80"
              }`}
            >
              <span
                className={`inline-block w-7 h-4 rounded-full relative transition-colors ${
                  lowCutOn ? "bg-primary" : "bg-white/15"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${
                    lowCutOn ? "left-3.5" : "left-0.5"
                  }`}
                />
              </span>
              Low Cut
            </button>
            <span className={`font-medium ${lowCutOn ? "text-white/80" : "text-white/35"}`}>
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
            aria-label="Frequência do low cut"
            className={`w-full ${lowCutOn ? "accent-[#9673FF]" : "accent-[#52525b] opacity-50"}`}
          />
        </div>
      </div>

      <p className="text-xs text-white/40 mt-3">
        Tudo funcionando de verdade: toque um tom, ajuste o Fade In/Out e ligue
        o Low Cut para limpar os graves — os mesmos controles da tela do app.
      </p>
    </div>
  );
}
