import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wand2, Music2, AudioWaveform, Heart, UploadCloud, Mic2, Piano } from "lucide-react";

const SCENE_MS = 1500;
const NUM_SCENES = 5;

function Waveform({ color, bars = 24, tall = false }: { color: string; bars?: number; tall?: boolean }) {
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

function SceneShell({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#C24BF7] to-[#4B45E8] flex items-center justify-center shrink-0">
          <Icon className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="text-[13px] font-bold text-white tracking-wide">{title}</span>
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}

function SceneSofisticador() {
  const [done, setDone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDone(true), 550);
    return () => clearTimeout(t);
  }, []);
  const antes = ["C", "Am", "F", "G"];
  const depois = ["C7M(9)", "Am9", "F6/9", "G7sus4"];
  return (
    <SceneShell icon={Wand2} title="Sofisticador de Cifra">
      <div className="bg-[#fdfcf9] rounded-xl px-4 py-3 h-full flex flex-col justify-center gap-2 overflow-hidden">
        <div className="flex flex-wrap gap-2">
          <AnimatePresence mode="popLayout">
            {(done ? depois : antes).map((c, i) => (
              <motion.span
                key={`${done}-${c}`}
                initial={{ opacity: 0, y: done ? 10 : 0, scale: 0.85 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.28, delay: i * 0.08 }}
              >
                <span
                  className={`px-2 py-1 rounded-md font-mono text-[13px] sm:text-sm font-bold border ${
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
        <p className="text-slate-400 text-[11px] sm:text-xs font-medium">Tua graça me alcançou…</p>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: done ? 1 : 0 }}
          className="text-[10px] font-bold text-[#7C3AED] uppercase tracking-wider"
        >
          ✦ Acordes sofisticados
        </motion.div>
      </div>
    </SceneShell>
  );
}

function SceneUpload() {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setPct((p) => Math.min(100, p + 9)), 60);
    return () => clearInterval(t);
  }, []);
  const ready = pct >= 100;
  return (
    <SceneShell icon={UploadCloud} title="Audio Lab — sua música">
      <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 h-full flex flex-col justify-center gap-2.5">
        <div className="flex items-center gap-2 text-slate-300 text-xs font-semibold">
          <Music2 className="w-4 h-4 text-[#9673FF]" />
          minha-musica.mp3
        </div>
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#9673FF] to-[#C24BF7] transition-all duration-100"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex gap-2">
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: ready ? 1 : 0, scale: ready ? 1 : 0.8 }}
            className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-[11px] font-bold"
          >
            BPM 72
          </motion.span>
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: ready ? 1 : 0, scale: ready ? 1 : 0.8 }}
            transition={{ delay: 0.12 }}
            className="px-2.5 py-1 rounded-full bg-[#9673FF]/15 border border-[#9673FF]/40 text-[#B99CFF] text-[11px] font-bold"
          >
            Tom: C
          </motion.span>
        </div>
      </div>
    </SceneShell>
  );
}

function SceneIsolamento() {
  return (
    <SceneShell icon={AudioWaveform} title="Isolar voz e instrumental">
      <div className="grid grid-cols-2 gap-2.5 h-full">
        <div className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 flex flex-col justify-center gap-2">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-300">
            <Mic2 className="w-3.5 h-3.5 text-[#C24BF7]" /> Voz
          </div>
          <Waveform color="bg-[#C24BF7]" bars={14} tall />
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 flex flex-col justify-center gap-2">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-300">
            <Piano className="w-3.5 h-3.5 text-[#9673FF]" /> Instrumental
          </div>
          <Waveform color="bg-[#9673FF]" bars={14} />
        </div>
      </div>
    </SceneShell>
  );
}

function SceneAcordes() {
  const chords = [
    { name: "C7M(9)", cat: "Maiores", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40" },
    { name: "Am9", cat: "Menores", cls: "bg-rose-500/15 text-rose-400 border-rose-500/40" },
    { name: "G7sus4", cat: "Sus", cls: "bg-violet-500/15 text-violet-400 border-violet-500/40" },
  ];
  return (
    <SceneShell icon={Music2} title="Dicionário com som real">
      <div className="grid grid-cols-3 gap-2 h-full">
        {chords.map((c, i) => (
          <motion.div
            key={c.name}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.14 }}
            className="bg-white/5 border border-white/10 rounded-xl px-2 py-2.5 flex flex-col items-center justify-center gap-1.5"
          >
            <span className={`px-1.5 py-0.5 rounded-full border text-[9px] font-bold ${c.cls}`}>{c.cat}</span>
            <span className="font-mono font-bold text-white text-xs sm:text-sm">{c.name}</span>
          </motion.div>
        ))}
      </div>
    </SceneShell>
  );
}

function SceneFavoritos() {
  return (
    <SceneShell icon={Heart} title="Seu repertório salvo">
      <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 h-full flex flex-col justify-center gap-2">
        {["Minha música — Tom C", "Ensaio de domingo — Tom Eb"].map((t, i) => (
          <motion.div
            key={t}
            initial={{ opacity: 0, x: -14 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.12 + i * 0.18 }}
            className="flex items-center gap-2.5 bg-white/5 border border-white/10 rounded-lg px-3 py-2"
          >
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.35, 1] }}
              transition={{ delay: 0.3 + i * 0.18, duration: 0.4 }}
            >
              <Heart className="w-4 h-4 text-[#C24BF7] fill-[#C24BF7]" />
            </motion.span>
            <span className="text-xs font-semibold text-slate-200 truncate">{t}</span>
          </motion.div>
        ))}
      </div>
    </SceneShell>
  );
}

const SCENES = [SceneSofisticador, SceneUpload, SceneIsolamento, SceneAcordes, SceneFavoritos];

export function HeroShowcase() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % NUM_SCENES), SCENE_MS);
    return () => clearInterval(t);
  }, []);
  const Scene = SCENES[idx];
  return (
    <div className="relative w-full aspect-video bg-[#0B0B14] select-none" aria-label="Prévia animada do Kordi">
      {/* barra estilo app */}
      <div className="absolute top-0 inset-x-0 h-8 flex items-center gap-1.5 px-3 border-b border-white/5 bg-white/[0.03]">
        <span className="w-2 h-2 rounded-full bg-white/15" />
        <span className="w-2 h-2 rounded-full bg-white/15" />
        <span className="w-2 h-2 rounded-full bg-white/15" />
        <span className="ml-2 text-[10px] font-bold tracking-[0.18em] text-slate-400 uppercase">Kordi</span>
      </div>

      <div className="absolute inset-0 pt-10 pb-7 px-4 sm:px-5">
        <AnimatePresence mode="wait">
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14 }}
            transition={{ duration: 0.25 }}
            className="h-full"
          >
            <Scene />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* indicador de progresso */}
      <div className="absolute bottom-2.5 inset-x-0 flex items-center justify-center gap-1.5">
        {Array.from({ length: NUM_SCENES }).map((_, i) => (
          <span
            key={i}
            className={`h-1 rounded-full transition-all duration-300 ${
              i === idx ? "w-5 bg-[#9673FF]" : "w-1.5 bg-white/15"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
