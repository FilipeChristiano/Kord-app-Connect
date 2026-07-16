import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wand2,
  Heart,
  Search,
  Mic,
  Check,
  Wifi,
  BatteryFull,
  Menu,
  Play,
  AudioWaveform,
  Timer,
  Waves,
  Square,
  Volume2,
  FileText,
  UploadCloud,
  FileAudio,
} from "lucide-react";
import { PianoKeyboard } from "@/components/PianoKeyboard";
import { CHORDS, CATEGORY_COLORS } from "@/data/chords";
import { splitHands } from "@/lib/notes";

function Waveform({ color, bars = 18 }: { color: string; bars?: number }) {
  return (
    <div className="flex items-center gap-[3px] h-7 w-full">
      {Array.from({ length: bars }).map((_, i) => {
        const h = 30 + Math.abs(Math.sin(i * 1.7)) * 70;
        return (
          <motion.span
            key={i}
            className={`flex-1 rounded-full ${color}`}
            style={{ height: `${h}%` }}
            animate={{ scaleY: [1, 0.45 + Math.abs(Math.sin(i * 2.3)) * 0.8, 1] }}
            transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.04, ease: "easeInOut" }}
          />
        );
      })}
    </div>
  );
}

function PageTitle({ icon: Icon, plain, accent }: { icon: any; plain: string; accent: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#C24BF7] to-[#4B45E8] flex items-center justify-center shrink-0 shadow-lg shadow-[#9673FF]/20">
        <Icon className="w-3.5 h-3.5 text-white" />
      </div>
      <span className="text-[14px] font-bold text-white tracking-tight truncate">
        {plain} <span className="text-[#9673FF]">{accent}</span>
      </span>
    </div>
  );
}

/* 1 — Sofisticador: níveis + papel de cifra, igual à tela real */
export function SceneSofisticador() {
  const [done, setDone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDone(true), 1300);
    return () => clearTimeout(t);
  }, []);
  const linhas: { chords: [string, string][]; lyric: string }[] = [
    { chords: [["C", "C7M(9)"], ["C4", "C4"], ["C", "C7M(9)"]], lyric: "As muitas gerações rendidas em louvor" },
    { chords: [["Am7", "Am7(9)"], ["G", "G7sus4"], ["F9", "F7M(9)"]], lyric: "Cantando ao cordeiro uma canção" },
  ];
  const niveis = ["Original", "Suave", "Intermediário", "Avançado"];
  return (
    <div className="h-full flex flex-col">
      <PageTitle icon={Wand2} plain="Sofisticador de" accent="Cifra" />
      <p className="text-[8px] font-bold text-slate-500 uppercase tracking-[0.14em] mb-1.5">Nível de sofisticação</p>
      <div className="grid grid-cols-2 gap-1.5 mb-3">
        {niveis.map((n) => (
          <span
            key={n}
            className={`text-center px-1 py-1.5 rounded-lg text-[9px] font-bold border transition-colors ${
              n === "Intermediário"
                ? "border-[#9673FF] text-[#9673FF] bg-[#9673FF]/10 shadow-[0_0_12px_rgba(150,115,255,0.25)]"
                : "border-white/10 text-slate-400 bg-white/[0.03]"
            }`}
          >
            {n}
          </span>
        ))}
      </div>
      <p className="text-[8px] font-bold text-slate-500 uppercase tracking-[0.14em] mb-1.5">
        {done ? "Cifra sofisticada" : "Cifra original"}
      </p>
      <div className="bg-[#fdfcf9] rounded-xl px-3 py-3 flex-1 flex flex-col gap-2 shadow-inner">
        {linhas.map((linha, li) => (
          <div key={li}>
            <div className="flex flex-wrap gap-1.5 mb-0.5">
              {linha.chords.map(([orig, sof], i) => {
                const c = done ? sof : orig;
                return (
                  <motion.span
                    key={`${done}-${li}-${i}`}
                    initial={{ opacity: 0, y: done ? 8 : 0, scale: 0.85 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.3, delay: (li * 2 + i) * 0.08 }}
                    className={`px-1.5 py-0.5 rounded-md font-mono text-[10px] font-bold border ${
                      done
                        ? "bg-[#7C3AED]/10 text-[#7C3AED] border-[#7C3AED]/30"
                        : "bg-slate-100 text-slate-500 border-slate-200"
                    }`}
                  >
                    {c}
                  </motion.span>
                );
              })}
            </div>
            <p className="text-slate-500 text-[9.5px] font-medium font-mono leading-tight">{linha.lyric}</p>
          </div>
        ))}
        <motion.div
          animate={{ opacity: done ? 1 : 0 }}
          transition={{ duration: 0.4 }}
          className="mt-auto text-[9px] font-bold text-[#7C3AED] uppercase tracking-wider"
        >
          ✦ Acordes substituídos
        </motion.div>
      </div>
    </div>
  );
}

/* 2 — Audio Lab: busca, download, separação e a MESA com 15 s reais da música */
const QUERY = "santo pra sempre - gabriel guedes";
const TYPE_MS = 52;
const T_TYPED = QUERY.length * TYPE_MS;
const T_DOWNLOAD = T_TYPED + 350;
const T_ISOLATE = T_DOWNLOAD + 1300;
export const T_MESA = T_ISOLATE + 2000;
const MESA_FASES: { at: number; label: string; canais: boolean[] }[] = [
  { at: 0, label: "Tudo junto", canais: [true, true, true] },
  { at: 6000, label: "Só a voz", canais: [true, false, false] },
  { at: 10500, label: "Só o instrumental", canais: [false, true, false] },
];
export const T_LAB_END = T_MESA + 15600;
const CANAIS = ["Voz", "Instrumental", "Metrônomo"];

export function SceneAudioLab() {
  const [typed, setTyped] = useState(0);
  const [phase, setPhase] = useState<"typing" | "download" | "isolate" | "mesa">("typing");
  const [pct, setPct] = useState(0);
  const [stemsOn, setStemsOn] = useState(0);
  const [fase, setFase] = useState(0);

  useEffect(() => {
    const type = setInterval(() => {
      setTyped((n) => {
        if (n >= QUERY.length) {
          clearInterval(type);
          return n;
        }
        return n + 1;
      });
    }, TYPE_MS);
    return () => clearInterval(type);
  }, []);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase("download"), T_DOWNLOAD),
      setTimeout(() => setPhase("isolate"), T_ISOLATE),
      setTimeout(() => setPhase("mesa"), T_MESA),
      ...CANAIS.map((_, i) => setTimeout(() => setStemsOn(i + 1), T_ISOLATE + 500 * i)),
      ...MESA_FASES.map((f, i) => setTimeout(() => setFase(i), T_MESA + f.at)),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (phase !== "download") return;
    const t = setInterval(() => setPct((p) => Math.min(100, p + 10)), 90);
    return () => clearInterval(t);
  }, [phase]);

  return (
    <div className="h-full flex flex-col">
      <PageTitle icon={AudioWaveform} plain="Audio" accent="Lab" />
      <div className="bg-white/[0.04] border border-white/10 rounded-2xl px-3 py-3 flex flex-col gap-2.5 flex-1">
        {phase !== "mesa" && (
          <>
            <p className="text-[11px] font-bold text-white flex items-center gap-1.5">
              <Search className="w-3 h-3 text-[#9673FF]" /> Pesquisar pelo título
            </p>
            <div className="flex items-center gap-2 bg-white/[0.04] border border-white/15 rounded-xl px-2.5 py-2">
              <span className="text-[9.5px] font-medium text-slate-200 leading-tight">
                {typed === 0 ? <span className="text-slate-500">Ex.: Gabriela Rocha - Atos 2</span> : QUERY.slice(0, typed)}
                {phase === "typing" && (
                  <motion.span animate={{ opacity: [1, 0] }} transition={{ duration: 0.5, repeat: Infinity }} className="text-[#9673FF]">
                    |
                  </motion.span>
                )}
              </span>
            </div>
          </>
        )}

        {phase === "download" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-1.5">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Baixando o áudio…</p>
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#9673FF] to-[#C24BF7] transition-all duration-100"
                style={{ width: `${pct}%` }}
              />
            </div>
          </motion.div>
        )}

        {phase === "isolate" && (
          <div className="flex flex-col gap-1.5">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Separando o áudio…</p>
            {CANAIS.map((nome, i) => {
              const on = stemsOn > i;
              return (
                <motion.div
                  key={nome}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: on ? 1 : 0.3, x: 0 }}
                  className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 transition-colors ${
                    on ? "bg-emerald-500/10 border-emerald-500/30" : "bg-white/[0.03] border-white/10"
                  }`}
                >
                  {on ? <Check className="w-3 h-3 shrink-0 text-emerald-400" /> : <span className="w-3 h-3 shrink-0" />}
                  <span className={`text-[9.5px] font-bold ${on ? "text-emerald-400" : "text-slate-500"}`}>{nome}</span>
                </motion.div>
              );
            })}
          </div>
        )}

        {phase === "mesa" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-2 flex-1">
            <div className="flex items-center justify-between">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Mesa de mistura</p>
              <AnimatePresence mode="wait">
                <motion.span
                  key={fase}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="px-2 py-0.5 rounded-full bg-[#9673FF]/15 border border-[#9673FF]/40 text-[#9673FF] text-[9px] font-bold"
                >
                  {MESA_FASES[fase].label}
                </motion.span>
              </AnimatePresence>
            </div>
            {CANAIS.map((nome, i) => {
              const on = MESA_FASES[fase].canais[i];
              return (
                <div
                  key={nome}
                  className={`rounded-xl border px-2.5 py-2 transition-colors ${
                    on ? "bg-[#9673FF]/10 border-[#9673FF]/40" : "bg-white/[0.03] border-white/10"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[10px] font-bold ${on ? "text-white" : "text-slate-500"}`}>{nome}</span>
                    <span
                      className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${
                        on ? "bg-emerald-500/15 text-emerald-400" : "bg-white/[0.05] text-slate-500"
                      }`}
                    >
                      {on ? "100%" : "0%"}
                    </span>
                  </div>
                  {on ? (
                    <Waveform color="bg-[#9673FF]" bars={14} />
                  ) : (
                    <div className="h-7 flex items-center">
                      <div className="h-[3px] w-full rounded-full bg-white/10" />
                    </div>
                  )}
                </div>
              );
            })}
            <p className="text-[8.5px] text-slate-500 font-medium mt-auto truncate">Santo Pra Sempre · separada pelo Kordi</p>
          </motion.div>
        )}
      </div>
    </div>
  );
}

/* 3 — Metrônomo: demonstração real com "Jó" — detector real do app: 132 BPM */
const BPM_TARGET = 132;
export const UPLOAD_MS = 1400;
const BPM_MIN = 40;
const BPM_MAX = 240;

function ArcGauge({ progress, listening }: { progress: number; listening: boolean }) {
  const R = 46;
  const CX = 60;
  const CY = 58;
  const angle = Math.PI * (1 - progress);
  const kx = CX + R * Math.cos(angle);
  const ky = CY - R * Math.sin(angle);
  const arcLen = Math.PI * R;
  const bpm = Math.round(BPM_MIN + progress * (BPM_MAX - BPM_MIN));
  return (
    <svg viewBox="0 0 120 72" className="w-full h-auto">
      <path d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`} fill="none" stroke="#22223A" strokeWidth={5} strokeLinecap="round" />
      <path
        d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
        fill="none"
        stroke="url(#kordiArc)"
        strokeWidth={5}
        strokeLinecap="round"
        strokeDasharray={arcLen}
        strokeDashoffset={arcLen * (1 - progress)}
      />
      <defs>
        <linearGradient id="kordiArc" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#9673FF" />
          <stop offset="100%" stopColor="#C24BF7" />
        </linearGradient>
      </defs>
      <circle cx={kx} cy={ky} r={5} fill="#0B0B14" stroke="#9673FF" strokeWidth={2.5} />
      <text x={CX} y={CY - 24} textAnchor="middle" fill="#94A3B8" fontSize="7" fontWeight="700" letterSpacing="1">
        BPM
      </text>
      <text x={CX} y={CY - 2} textAnchor="middle" fill="#FFFFFF" fontSize="24" fontWeight="800">
        {listening ? "· · ·" : bpm}
      </text>
      <text x={CX} y={CY + 11} textAnchor="middle" fill="#64748B" fontSize="6.5" fontWeight="600">
        {BPM_MIN} – {BPM_MAX}
      </text>
    </svg>
  );
}

export function SceneMetronomo() {
  const [uploading, setUploading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [progress, setProgress] = useState(0);
  const [beat, setBeat] = useState(-1);
  const raf = useRef<number | undefined>(undefined);

  useEffect(() => {
    const t = setTimeout(() => setUploading(false), UPLOAD_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      const start = performance.now();
      const dur = 900;
      const target = (BPM_TARGET - BPM_MIN) / (BPM_MAX - BPM_MIN);
      const step = (now: number) => {
        const p = Math.min(1, (now - start) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        setProgress(eased * target);
        if (p < 1) raf.current = requestAnimationFrame(step);
        else setLocked(true);
      };
      raf.current = requestAnimationFrame(step);
    }, UPLOAD_MS + 1400);
    return () => {
      clearTimeout(t);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, []);

  useEffect(() => {
    if (!locked) return;
    let iv = 0;
    const d = setTimeout(() => {
      setBeat(0);
      iv = window.setInterval(() => setBeat((b) => (b + 1) % 4), 60000 / BPM_TARGET);
    }, 415);
    return () => {
      clearTimeout(d);
      window.clearInterval(iv);
    };
  }, [locked]);

  const listening = !locked && progress === 0;
  const accent = ["#9673FF", "#9673FF", "#9673FF", "#9673FF"];

  return (
    <div className="h-full flex flex-col">
      <PageTitle icon={Timer} plain="Metrônomo" accent="Inteligente" />
      <p className="text-[8.5px] font-semibold text-slate-400 -mt-2 mb-2 truncate">♪ Jó — Midian Lima</p>
      <div className="bg-white/[0.04] border border-white/10 rounded-2xl px-3 py-3 flex-1 flex flex-col">
        <ArcGauge progress={listening ? 0 : progress} listening={listening} />

        <div className="mt-1 min-h-[30px]">
          {uploading ? (
            <div className="flex items-center gap-2">
              <motion.span
                animate={{ y: [0, -2, 0] }}
                transition={{ duration: 0.7, repeat: Infinity }}
                className="shrink-0"
              >
                <UploadCloud className="w-3.5 h-3.5 text-[#9673FF]" />
              </motion.span>
              <span className="text-[9px] font-bold text-[#9673FF] uppercase tracking-wider">Enviando sua música…</span>
              <FileAudio className="w-3.5 h-3.5 text-slate-400 ml-auto" />
            </div>
          ) : listening ? (
            <div className="flex items-center gap-2">
              <motion.span
                animate={{ opacity: [1, 0.3, 1], scale: [1, 1.25, 1] }}
                transition={{ duration: 0.9, repeat: Infinity }}
                className="w-2 h-2 rounded-full bg-red-500 shrink-0"
              />
              <span className="text-[9px] font-bold text-red-400 uppercase tracking-wider">Ouvindo seu áudio…</span>
              <Mic className="w-3.5 h-3.5 text-slate-400 ml-auto" />
            </div>
          ) : (
            <motion.span
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-[9px] font-bold"
            >
              <Check className="w-2.5 h-2.5" /> Detectado do seu áudio
            </motion.span>
          )}
        </div>

        {uploading ? (
          <div className="mt-2">
            <div className="flex items-center gap-2 bg-white/[0.04] border border-white/10 rounded-xl px-2.5 py-2">
              <FileAudio className="w-4 h-4 text-[#9673FF] shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[9px] font-semibold text-slate-200 truncate">jo-midian-lima.mp3</p>
                <div className="mt-1 h-1 rounded-full bg-white/10 overflow-hidden">
                  <motion.div
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: (UPLOAD_MS - 250) / 1000, ease: "easeOut" }}
                    className="h-full rounded-full bg-gradient-to-r from-[#9673FF] to-[#C24BF7]"
                  />
                </div>
              </div>
            </div>
          </div>
        ) : listening ? (
          <div className="mt-2">
            <Waveform color="bg-red-400" bars={16} />
          </div>
        ) : (
          <div className="mt-2">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-[0.14em]">Compasso</span>
              <span className="text-[9px] font-bold text-slate-300">{beat >= 0 ? beat + 1 : 1} / 4</span>
            </div>
            <div className="flex items-center gap-2.5">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex flex-col items-center gap-0.5">
                  <span
                    className="w-3.5 h-3.5 rounded-full transition-all duration-100"
                    style={{
                      backgroundColor: accent[i],
                      opacity: beat === i ? 1 : 0.35,
                      transform: beat === i ? "scale(1.3)" : "scale(1)",
                      boxShadow: beat === i ? `0 0 10px ${accent[i]}` : "none",
                    }}
                  />
                  <span className="text-[7px] text-slate-500 font-semibold">{i + 1}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* 4 — Pad Continuous: réplica da tela real */
export function ScenePad() {
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setPlaying(true), 900);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="h-full flex flex-col">
      <PageTitle icon={Waves} plain="Pad Worship" accent="Contínuo" />
      <div className="flex gap-1.5 mb-2.5">
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#9673FF] text-white text-[9px] font-bold">
          <Waves className="w-2.5 h-2.5" /> Pads
        </span>
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/[0.05] border border-white/10 text-slate-400 text-[9px] font-bold">
          <FileText className="w-2.5 h-2.5" /> Pads + cifras
        </span>
      </div>
      <div className="relative bg-white/[0.04] border border-white/10 rounded-2xl px-3 py-4 flex flex-col items-center overflow-hidden">
        {playing && (
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(circle at 50% 45%, rgba(150,115,255,0.28), transparent 65%)" }}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-[0.3em] mb-1">
          {playing ? "Tocando agora" : "Pronto para tocar"}
        </span>
        <span className="text-5xl font-black text-white leading-none my-1">C</span>
        <span className="text-[9.5px] text-slate-400 font-medium">Worship Shimmer</span>
      </div>
      <div className="flex gap-1.5 mt-2.5">
        <motion.span
          animate={playing ? { scale: [1, 0.96, 1] } : {}}
          transition={{ duration: 0.5 }}
          className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-bold ${
            playing ? "bg-gradient-to-r from-[#C24BF7] to-[#4B45E8] text-white shadow-lg shadow-[#9673FF]/30" : "bg-white/[0.06] border border-white/10 text-slate-300"
          }`}
        >
          <Play className="w-3 h-3" /> Tocar Pad
        </motion.span>
        <span className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.05] border border-white/10 text-slate-400 text-[10px] font-bold">
          <Square className="w-2.5 h-2.5" /> Stop
        </span>
      </div>
      <div className="mt-2.5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-[0.14em] flex items-center gap-1">
            <Volume2 className="w-2.5 h-2.5" /> Volume
          </span>
          <span className="text-[9px] font-bold text-slate-300">70%</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full w-[70%] rounded-full bg-gradient-to-r from-[#9673FF] to-[#C24BF7]" />
        </div>
      </div>
    </div>
  );
}

/* 5 — Dicionário: acordes reais do módulo (dados + diagrama de piano de verdade) */
const DICT_IDS = ["C9M", "G7sus4", "F9M"] as const;
const DICT_CHORDS = DICT_IDS.map((id) => CHORDS.find((c) => c.id === id)!).filter(Boolean);
export const DICT_STEP = 1250;

export function SceneAcordes() {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const timers = DICT_CHORDS.map((_, i) => setTimeout(() => setShown(i + 1), 250 + i * DICT_STEP));
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="h-full flex flex-col">
      <PageTitle icon={Search} plain="Dicionário de" accent="Acordes" />
      <div className="flex flex-col gap-2">
        {DICT_CHORDS.map((c, i) => {
          const { leftHand, rightHand } = splitHands(c.notes, c.category);
          return (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: shown > i ? 1 : 0, y: shown > i ? 0 : 12 }}
              transition={{ duration: 0.35 }}
              className="bg-white/[0.04] border border-white/10 rounded-2xl px-3 py-2"
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`px-1.5 py-0.5 rounded-full border text-[7.5px] font-bold whitespace-nowrap ${CATEGORY_COLORS[c.category] ?? ""}`}>
                  {c.category}
                </span>
                <div className="flex items-center gap-1.5">
                  <Play className={`w-3 h-3 ${shown === i + 1 ? "text-[#9673FF]" : "text-slate-400"}`} />
                  <Heart className="w-3 h-3 text-slate-400" />
                </div>
              </div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-bold text-white text-[15px] leading-none">{c.name}</span>
                <span className="text-[8px] text-slate-500 font-semibold">{c.formula}</span>
              </div>
              <PianoKeyboard leftHandNotes={leftHand} rightHandNotes={rightHand} className="w-full h-auto" />
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

/* 6 — Favoritos */
export function SceneFavoritos() {
  return (
    <div className="h-full flex flex-col">
      <PageTitle icon={Heart} plain="Seu" accent="repertório" />
      <div className="flex flex-col gap-2">
        {[
          { t: "Santo Pra Sempre", d: "Tom Db · 144 BPM" },
          { t: "Jó", d: "Midian Lima · 132 BPM" },
        ].map((s, i) => (
          <motion.div
            key={s.t}
            initial={{ opacity: 0, x: -14 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + i * 0.3 }}
            className="flex items-center gap-2.5 bg-white/[0.04] border border-white/10 rounded-2xl px-3 py-2.5"
          >
            <motion.span initial={{ scale: 0 }} animate={{ scale: [0, 1.35, 1] }} transition={{ delay: 0.5 + i * 0.3, duration: 0.45 }}>
              <Heart className="w-4 h-4 text-[#C24BF7] fill-[#C24BF7] shrink-0" />
            </motion.span>
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-semibold text-slate-200 truncate">{s.t}</span>
              <span className="text-[9px] text-slate-500 font-medium">{s.d}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* Moldura do celular igual à da página de vendas */
export function PhoneFrame({
  children,
  activeIndex,
  total = 6,
}: {
  children: React.ReactNode;
  activeIndex: number;
  total?: number;
}) {
  return (
    <div className="relative w-[300px]" aria-label="Prévia animada do Kordi no celular">
      <div className="relative rounded-[2.8rem] border-[10px] border-slate-900 bg-[#07070E] shadow-2xl shadow-slate-900/30 overflow-hidden aspect-[9/18]">
        {/* status bar */}
        <div className="absolute top-0 inset-x-0 h-9 flex items-center justify-between px-5 pt-1 z-10">
          <span className="text-[10px] font-bold text-slate-300">9:41</span>
          <div className="absolute left-1/2 -translate-x-1/2 top-1.5 w-20 h-5 rounded-full bg-slate-900" />
          <div className="flex items-center gap-1 text-slate-300">
            <Wifi className="w-3 h-3" />
            <BatteryFull className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* barra do app: logo à esquerda + menu à direita */}
        <div className="absolute top-9 inset-x-0 h-9 flex items-center justify-between px-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-md bg-gradient-to-br from-[#C24BF7] to-[#4B45E8] flex items-center justify-center">
              <span className="text-[9px] font-black text-white leading-none">K</span>
            </div>
            <span className="text-[10px] font-bold tracking-[0.28em] text-white uppercase">Kordi</span>
          </div>
          <Menu className="w-4 h-4 text-slate-400" />
        </div>

        {/* conteúdo */}
        <div className="absolute inset-0 pt-[5.2rem] pb-9 px-4">{children}</div>

        {/* indicador de progresso */}
        <div className="absolute bottom-3.5 inset-x-0 flex items-center justify-center gap-1.5">
          {Array.from({ length: total }).map((_, i) => (
            <span
              key={i}
              className={`h-1 rounded-full transition-all duration-300 ${i === activeIndex ? "w-5 bg-[#9673FF]" : "w-1.5 bg-white/15"}`}
            />
          ))}
        </div>

        {/* home indicator */}
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-16 h-1 rounded-full bg-white/20" />
      </div>
    </div>
  );
}
