import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wand2, Music2, AudioWaveform, Heart, Search, Mic, Timer, Check, Wifi, BatteryFull } from "lucide-react";

function Waveform({ color, bars = 18, tall = false }: { color: string; bars?: number; tall?: boolean }) {
  return (
    <div className="flex items-center gap-[3px] h-8 w-full">
      {Array.from({ length: bars }).map((_, i) => {
        const h = 30 + Math.abs(Math.sin(i * 1.7)) * 70;
        return (
          <motion.span
            key={i}
            className={`flex-1 rounded-full ${color}`}
            style={{ height: `${tall ? h : h * 0.7}%` }}
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
        <rect
          key={b.n}
          x={b.x}
          y={0}
          width={8.6}
          height={21}
          rx={1.2}
          fill={pressed.has(b.n) ? "#C24BF7" : "#1E1E2E"}
        />
      ))}
    </svg>
  );
}

function SceneShell({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#C24BF7] to-[#4B45E8] flex items-center justify-center shrink-0">
          <Icon className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="text-[13px] font-bold text-white tracking-wide truncate">{title}</span>
      </div>
      <div className="flex-1 min-h-0 flex flex-col justify-center">{children}</div>
    </div>
  );
}

/* 1 — Sofisticador: cifra simples vira sofisticada */
function SceneSofisticador() {
  const [done, setDone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDone(true), 1100);
    return () => clearTimeout(t);
  }, []);
  const antes = ["C", "Am", "F", "G"];
  const depois = ["C7M(9)", "Am9", "F6/9", "G7sus4"];
  return (
    <SceneShell icon={Wand2} title="Sofisticador de Cifra">
      <div className="bg-[#fdfcf9] rounded-xl px-3.5 py-4 flex flex-col gap-2.5 overflow-hidden">
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
                  className={`px-1.5 py-1 rounded-md font-mono text-xs font-bold border ${
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
        <p className="text-slate-400 text-[11px] font-medium">Tua graça me alcançou…</p>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: done ? 1 : 0 }}
          transition={{ duration: 0.4 }}
          className="text-[10px] font-bold text-[#7C3AED] uppercase tracking-wider"
        >
          ✦ Acordes sofisticados
        </motion.div>
      </div>
    </SceneShell>
  );
}

/* 2 — Audio Lab: digita o louvor, baixa, isola e entrega a cifra */
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
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  useEffect(() => {
    if (phase !== "download") return;
    const t = setInterval(() => setPct((p) => Math.min(100, p + 8)), 90);
    return () => clearInterval(t);
  }, [phase]);

  const stems = [
    { label: "Instrumental", icon: AudioWaveform },
    { label: "Metrônomo", icon: Timer },
    { label: "Voz", icon: Mic },
  ];

  return (
    <SceneShell icon={Search} title="Audio Lab">
      <div className="bg-white/5 border border-white/10 rounded-xl px-3.5 py-4 flex flex-col gap-2.5 overflow-hidden">
        <div className="flex items-center gap-2 bg-white/5 border border-white/15 rounded-lg px-2.5 py-2">
          <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="text-[10px] font-semibold text-slate-200 leading-tight">
            {QUERY.slice(0, typed)}
            {phase === "typing" && <motion.span animate={{ opacity: [1, 0] }} transition={{ duration: 0.5, repeat: Infinity }} className="text-[#9673FF]">|</motion.span>}
          </span>
        </div>

        {phase === "download" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-1.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Baixando o áudio…</p>
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-[#9673FF] to-[#C24BF7] transition-all duration-100" style={{ width: `${pct}%` }} />
            </div>
          </motion.div>
        )}

        {(phase === "isolate" || phase === "cifra") && (
          <div className="flex gap-1.5 flex-wrap">
            {stems.map((s, i) => (
              <motion.span
                key={s.label}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.28 }}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-[10px] font-bold"
              >
                <Check className="w-3 h-3" /> {s.label}
              </motion.span>
            ))}
          </div>
        )}

        {phase === "cifra" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-[#fdfcf9] rounded-lg px-3 py-2"
          >
            <p className="font-mono text-[11px] font-bold text-[#7C3AED]">D  A/C#  Bm7  G9</p>
            <p className="text-[10px] text-slate-500 font-medium">Santo pra sempre…</p>
          </motion.div>
        )}
      </div>
    </SceneShell>
  );
}

/* 3 — Metrônomo inteligente: grava na hora e acerta o BPM */
function SceneMetronomo() {
  const [locked, setLocked] = useState(false);
  const [beat, setBeat] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setLocked(true), 2000);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (!locked) return;
    const t = setInterval(() => setBeat((b) => (b + 1) % 4), 400);
    return () => clearInterval(t);
  }, [locked]);
  return (
    <SceneShell icon={Timer} title="Metrônomo Inteligente">
      <div className="bg-white/5 border border-white/10 rounded-xl px-3.5 py-4 flex flex-col gap-2.5">
        {!locked ? (
          <>
            <div className="flex items-center gap-2">
              <motion.span
                animate={{ opacity: [1, 0.3, 1], scale: [1, 1.25, 1] }}
                transition={{ duration: 0.9, repeat: Infinity }}
                className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0"
              />
              <span className="text-[11px] font-bold text-red-400 uppercase tracking-wider">Gravando agora…</span>
              <Mic className="w-4 h-4 text-slate-400 ml-auto" />
            </div>
            <Waveform color="bg-red-400" bars={16} tall />
            <p className="text-[10px] text-slate-400 font-medium">Toque ou bata o ritmo — o app escuta</p>
          </>
        ) : (
          <>
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col gap-1.5"
            >
              <span className="self-start px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-sm font-black">
                BPM 128
              </span>
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">✓ Detectado do seu áudio</span>
            </motion.div>
            <div className="flex items-center gap-2 mt-1">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={`w-3 h-3 rounded-full transition-all duration-150 ${
                    beat === i ? "bg-[#9673FF] scale-125 shadow-[0_0_10px_rgba(150,115,255,0.8)]" : "bg-white/15"
                  }`}
                />
              ))}
              <span className="text-[10px] text-slate-400 font-medium ml-1">4/4</span>
            </div>
          </>
        )}
      </div>
    </SceneShell>
  );
}

/* 4 — Dicionário: 3 variações reais com o desenho do teclado */
function SceneAcordes() {
  const chords = [
    { name: "C7M", cat: "Maiores com 7ªM", notes: ["C", "E", "G", "B"], cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40" },
    { name: "Cm7", cat: "Menores com 7ª", notes: ["C", "Eb", "G", "Bb"], cls: "bg-rose-500/15 text-rose-400 border-rose-500/40" },
    { name: "Csus4", cat: "Sus4", notes: ["C", "F", "G"], cls: "bg-violet-500/15 text-violet-400 border-violet-500/40" },
  ];
  return (
    <SceneShell icon={Music2} title="Dicionário de Acordes">
      <div className="flex flex-col gap-2">
        {chords.map((c, i) => (
          <motion.div
            key={c.name}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.3 }}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 flex items-center gap-2.5"
          >
            <div className="flex-1 min-w-0 flex flex-col gap-1">
              <span className="font-mono font-bold text-white text-sm leading-none">{c.name}</span>
              <span className={`self-start px-1.5 py-0.5 rounded-full border text-[8px] font-bold whitespace-nowrap ${c.cls}`}>{c.cat}</span>
            </div>
            <div className="w-[45%] shrink-0">
              <MiniPiano notes={c.notes} />
            </div>
          </motion.div>
        ))}
      </div>
    </SceneShell>
  );
}

/* 5 — Favoritos */
function SceneFavoritos() {
  return (
    <SceneShell icon={Heart} title="Seu repertório salvo">
      <div className="bg-white/5 border border-white/10 rounded-xl px-3.5 py-4 flex flex-col gap-2">
        {["Santo Pra Sempre — Tom D", "Ensaio de domingo — Tom Eb"].map((t, i) => (
          <motion.div
            key={t}
            initial={{ opacity: 0, x: -14 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + i * 0.3 }}
            className="flex items-center gap-2.5 bg-white/5 border border-white/10 rounded-lg px-3 py-2"
          >
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.35, 1] }}
              transition={{ delay: 0.5 + i * 0.3, duration: 0.45 }}
            >
              <Heart className="w-4 h-4 text-[#C24BF7] fill-[#C24BF7] shrink-0" />
            </motion.span>
            <span className="text-[11px] font-semibold text-slate-200 truncate">{t}</span>
          </motion.div>
        ))}
      </div>
    </SceneShell>
  );
}

const SCENES: { Comp: () => React.ReactElement; ms: number }[] = [
  { Comp: SceneSofisticador, ms: 3200 },
  { Comp: SceneAudioLab, ms: 6800 },
  { Comp: SceneMetronomo, ms: 4200 },
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
      <div className="relative rounded-[2.8rem] border-[10px] border-slate-900 bg-[#0B0B14] shadow-2xl shadow-slate-900/30 overflow-hidden aspect-[9/18]">
        {/* status bar */}
        <div className="absolute top-0 inset-x-0 h-9 flex items-center justify-between px-5 pt-1">
          <span className="text-[10px] font-bold text-slate-300">9:41</span>
          <div className="absolute left-1/2 -translate-x-1/2 top-1.5 w-20 h-5 rounded-full bg-slate-900" />
          <div className="flex items-center gap-1 text-slate-300">
            <Wifi className="w-3 h-3" />
            <BatteryFull className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* logo do app */}
        <div className="absolute top-10 inset-x-0 flex justify-center">
          <span className="text-[10px] font-bold tracking-[0.22em] text-slate-400 uppercase">Kordi</span>
        </div>

        {/* conteúdo */}
        <div className="absolute inset-0 pt-16 pb-9 px-4">
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
              className={`h-1 rounded-full transition-all duration-300 ${
                i === idx ? "w-5 bg-[#9673FF]" : "w-1.5 bg-white/15"
              }`}
            />
          ))}
        </div>

        {/* home indicator */}
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-16 h-1 rounded-full bg-white/20" />
      </div>
    </div>
  );
}
