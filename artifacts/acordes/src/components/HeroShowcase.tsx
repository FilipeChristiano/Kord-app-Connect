import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wand2, Heart, Search, Mic, Check, Wifi, BatteryFull, Menu, Play, AudioWaveform, Timer } from "lucide-react";

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

/* Mini teclado de piano com as notas do acorde acesas */
const FLAT_TO_SHARP: Record<string, string> = { Db: "C#", Eb: "D#", Gb: "F#", Ab: "G#", Bb: "A#" };

function MiniPiano({ notes }: { notes: string[] }) {
  const pressed = new Set(notes.map((n) => FLAT_TO_SHARP[n] ?? n));
  const whites = ["C", "D", "E", "F", "G", "A", "B"];
  const blacks = [
    { n: "C#", x: 9.8 },
    { n: "D#", x: 23.8 },
    { n: "F#", x: 51.8 },
    { n: "G#", x: 65.8 },
    { n: "A#", x: 79.8 },
  ];
  return (
    <svg viewBox="0 0 98 34" className="w-full h-auto rounded-[3px] overflow-hidden" aria-hidden="true">
      {whites.map((n, i) => (
        <rect
          key={n}
          x={i * 14}
          y={0}
          width={13.6}
          height={34}
          rx={1.5}
          fill={pressed.has(n) ? "#9673FF" : "#F8FAFC"}
          stroke="#0B0B14"
          strokeWidth={0.8}
        />
      ))}
      {blacks.map((b) => (
        <rect key={b.n} x={b.x} y={0} width={8.6} height={21} rx={1.2} fill={pressed.has(b.n) ? "#C24BF7" : "#1E1E2E"} />
      ))}
    </svg>
  );
}

/* Cabeçalho de página igual ao do app: ícone gradiente + título com destaque roxo */
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
function SceneSofisticador() {
  const [done, setDone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDone(true), 1300);
    return () => clearTimeout(t);
  }, []);
  const antes = ["C", "G", "Am", "F"];
  const depois = ["C7M(9)", "G7sus4", "Am9", "F6/9"];
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
      <div className="bg-[#fdfcf9] rounded-xl px-3 py-3.5 flex-1 flex flex-col gap-2 shadow-inner">
        <div className="flex flex-wrap gap-1.5">
          <AnimatePresence mode="popLayout">
            {(done ? depois : antes).map((c, i) => (
              <motion.span
                key={`${done}-${c}`}
                initial={{ opacity: 0, y: done ? 10 : 0, scale: 0.85 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.35, delay: i * 0.12 }}
              >
                <span
                  className={`px-1.5 py-1 rounded-md font-mono text-[11px] font-bold border ${
                    done
                      ? "bg-[#7C3AED]/10 text-[#7C3AED] border-[#7C3AED]/30"
                      : "bg-slate-100 text-slate-500 border-slate-200"
                  }`}
                >
                  {c}
                </span>
              </motion.span>
            ))}
          </AnimatePresence>
        </div>
        <p className="text-slate-400 text-[10px] font-medium font-mono">Tua graça me alcançou…</p>
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

/* 2 — Audio Lab: busca pelo título, download, separação e cifra */
const QUERY = "santo pra sempre - gabriel guedes";

function SceneAudioLab() {
  const [typed, setTyped] = useState(0);
  const [phase, setPhase] = useState<"typing" | "download" | "isolate" | "cifra">("typing");
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const type = setInterval(() => {
      setTyped((n) => {
        if (n >= QUERY.length) {
          clearInterval(type);
          return n;
        }
        return n + 1;
      });
    }, 52);
    return () => clearInterval(type);
  }, []);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("download"), QUERY.length * 52 + 350);
    const t2 = setTimeout(() => setPhase("isolate"), QUERY.length * 52 + 1650);
    const t3 = setTimeout(() => setPhase("cifra"), QUERY.length * 52 + 3100);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  useEffect(() => {
    if (phase !== "download") return;
    const t = setInterval(() => setPct((p) => Math.min(100, p + 8)), 90);
    return () => clearInterval(t);
  }, [phase]);

  const stems = ["Instrumental", "Metrônomo", "Voz"];

  return (
    <div className="h-full flex flex-col">
      <PageTitle icon={AudioWaveform} plain="Audio" accent="Lab" />
      <div className="bg-white/[0.04] border border-white/10 rounded-2xl px-3 py-3.5 flex flex-col gap-2.5 flex-1">
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

        {(phase === "isolate" || phase === "cifra") && (
          <div className="flex gap-1.5 flex-wrap">
            {stems.map((s, i) => (
              <motion.span
                key={s}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.28 }}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-[9px] font-bold"
              >
                <Check className="w-2.5 h-2.5" /> {s}
              </motion.span>
            ))}
          </div>
        )}

        {phase === "cifra" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-[#fdfcf9] rounded-xl px-3 py-2.5 mt-auto"
          >
            <p className="font-mono text-[11px] font-bold text-[#7C3AED]">D  A/C#  Bm7  G9</p>
            <p className="text-[9.5px] text-slate-500 font-medium">Santo pra sempre…</p>
          </motion.div>
        )}
      </div>
    </div>
  );
}

/* 3 — Metrônomo: medidor circular de BPM igual ao da tela real */
const BPM_TARGET = 128;
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

function SceneMetronomo() {
  const [locked, setLocked] = useState(false);
  const [progress, setProgress] = useState(0);
  const [beat, setBeat] = useState(-1);
  const raf = useRef<number | undefined>(undefined);

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
    }, 1400);
    return () => {
      clearTimeout(t);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, []);

  useEffect(() => {
    if (!locked) return;
    setBeat(0);
    const t = setInterval(() => setBeat((b) => (b + 1) % 4), 60000 / BPM_TARGET);
    return () => clearInterval(t);
  }, [locked]);

  const listening = !locked && progress === 0;
  const accent = ["#9673FF", "#94A3B8", "#EAB308", "#94A3B8"];

  return (
    <div className="h-full flex flex-col">
      <PageTitle icon={Timer} plain="Metrônomo" accent="Inteligente" />
      <div className="bg-white/[0.04] border border-white/10 rounded-2xl px-3 py-3 flex-1 flex flex-col">
        <ArcGauge progress={listening ? 0 : progress} listening={listening} />

        <div className="mt-1 min-h-[30px]">
          {listening ? (
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

        {listening ? (
          <div className="mt-2">
            <Waveform color="bg-red-400" bars={16} />
          </div>
        ) : (
          <div className="mt-2">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-[0.14em]">Acentuação</span>
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

/* 4 — Dicionário: cards reais com badge, notas e desenho do teclado */
function SceneAcordes() {
  const chords = [
    { name: "C7M", cat: "Maiores com 7ªM", notes: ["C", "E", "G", "B"], cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40" },
    { name: "Cm7", cat: "Menores com 7ª", notes: ["C", "Eb", "G", "Bb"], cls: "bg-rose-500/15 text-rose-400 border-rose-500/40" },
    { name: "Csus4", cat: "Sus4", notes: ["C", "F", "G"], cls: "bg-violet-500/15 text-violet-400 border-violet-500/40" },
  ];
  return (
    <div className="h-full flex flex-col">
      <PageTitle icon={Search} plain="Dicionário de" accent="Acordes" />
      <div className="flex flex-col gap-2">
        {chords.map((c, i) => (
          <motion.div
            key={c.name}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.3 }}
            className="bg-white/[0.04] border border-white/10 rounded-2xl px-3 py-2.5"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className={`px-1.5 py-0.5 rounded-full border text-[7.5px] font-bold whitespace-nowrap ${c.cls}`}>{c.cat}</span>
              <div className="flex items-center gap-1.5 text-slate-400">
                <Play className="w-3 h-3" />
                <Heart className="w-3 h-3" />
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="flex-1 min-w-0 flex flex-col gap-1">
                <span className="font-bold text-white text-base leading-none">{c.name}</span>
                <div className="flex gap-1">
                  {c.notes.map((n) => (
                    <span key={n} className="w-4.5 h-4.5 px-1 py-0.5 rounded-full bg-white/10 text-slate-300 text-[7.5px] font-bold flex items-center justify-center">
                      {n}
                    </span>
                  ))}
                </div>
              </div>
              <div className="w-[44%] shrink-0">
                <MiniPiano notes={c.notes} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* 5 — Favoritos */
function SceneFavoritos() {
  return (
    <div className="h-full flex flex-col">
      <PageTitle icon={Heart} plain="Seu" accent="repertório" />
      <div className="flex flex-col gap-2">
        {[
          { t: "Santo Pra Sempre", d: "Tom D · 128 BPM" },
          { t: "Ensaio de domingo", d: "Tom Eb · setlist" },
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

const SCENES: { Comp: () => React.ReactElement; ms: number }[] = [
  { Comp: SceneSofisticador, ms: 3600 },
  { Comp: SceneAudioLab, ms: 6800 },
  { Comp: SceneMetronomo, ms: 5200 },
  { Comp: SceneAcordes, ms: 3600 },
  { Comp: SceneFavoritos, ms: 3200 },
];

export function HeroShowcase() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setIdx((i) => (i + 1) % SCENES.length), SCENES[idx].ms);
    return () => clearTimeout(t);
  }, [idx]);
  const { Comp } = SCENES[idx];
  return (
    <div className="relative mx-auto w-[270px] sm:w-[300px]" aria-label="Prévia animada do Kordi no celular">
      {/* moldura do celular */}
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

        {/* barra do app, igual à real: logo à esquerda + menu à direita */}
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
        <div className="absolute inset-0 pt-[5.2rem] pb-9 px-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.3 }}
              className="h-full"
            >
              <Comp />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* indicador de progresso */}
        <div className="absolute bottom-3.5 inset-x-0 flex items-center justify-center gap-1.5">
          {SCENES.map((_, i) => (
            <span
              key={i}
              className={`h-1 rounded-full transition-all duration-300 ${i === idx ? "w-5 bg-[#9673FF]" : "w-1.5 bg-white/15"}`}
            />
          ))}
        </div>

        {/* home indicator */}
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-16 h-1 rounded-full bg-white/20" />
      </div>
    </div>
  );
}
