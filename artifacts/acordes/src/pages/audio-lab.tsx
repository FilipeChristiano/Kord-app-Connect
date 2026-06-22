import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AudioWaveform,
  UploadCloud,
  Loader2,
  Music2,
  Gauge,
  Clock,
  FileAudio,
  RotateCcw,
  Wand2,
  Info,
  AlertTriangle,
  FileText,
  Copy,
  Check,
  Pencil,
  Mic,
  Search,
  ExternalLink,
  ListMusic,
} from "lucide-react";
import { useLocation } from "wouter";
import {
  analyzeAudioBuffer,
  decodeAudioFile,
  formatDuration,
  type AnalysisStep,
  type AudioAnalysisResult,
} from "@/lib/audio-analysis";
import {
  getTranscriptionStatus,
  transcribeAudio,
} from "@/lib/transcription";
import { analyzeChordsRemote } from "@/lib/chord-remote";
import { fetchCifra, type FetchedCifra } from "@/lib/cifra-remote";
import { buildAlignedChart } from "@/lib/lyric-align";
import {
  processChordChartFull,
  type SophisticationLevel,
} from "@/data/substitutions";
import { cn } from "@/lib/utils";

const MAX_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_DURATION = 12 * 60; // 12 minutos (limita memória/CPU mesmo com arquivos comprimidos)
const ACCEPT = ".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/x-m4a,audio/mp4,audio/*";

const STEPS: { key: AnalysisStep; label: string }[] = [
  { key: "lendo", label: "Lendo o áudio" },
  { key: "tom", label: "Detectando o tom" },
  { key: "bpm", label: "Detectando o BPM" },
  { key: "acordes", label: "Detectando os acordes" },
  { key: "finalizando", label: "Gerando o resultado" },
];

type Phase = "idle" | "analyzing" | "result" | "error";
type ChartSource = "detectados" | "sofisticados";

// Chave usada para enviar a cifra montada ao Sofisticador de Cifras.
// O mesmo literal é lido em chord-substitutor.tsx.
const SOFISTICADOR_PREFILL_KEY = "harmonic:sofisticador:prefill";

function isAllowedFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return /\.(mp3|wav|m4a)$/.test(name) || file.type.startsWith("audio/");
}

// Transforma o nome do arquivo num palpite de busca ("Artista - Música").
// Tira a extensão, troca separadores por espaço e remove ruídos comuns.
function guessQueryFromFile(name: string): string {
  return name
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[_]+/g, " ")
    .replace(/\s*\(.*?\)\s*/g, " ") // remove "(Ao Vivo)", "(Clipe)" etc.
    .replace(/\b(official|oficial|lyric|lyrics|video|clipe|audio|hd|hq)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Montagem da cifra com letra ───────────────────────────────────────────────
// Divide a letra em linhas, preservando as quebras coladas pelo usuário.
// Se vier em bloco único, tenta dividir por frases.
function splitLyrics(raw: string): string[] {
  const byLine = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (byLine.length > 1) return byLine;

  const single = (byLine[0] ?? raw).trim();
  if (!single) return [];

  let phrases = single
    .split(/(?<=[.!?…])\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (phrases.length <= 1) {
    phrases = single
      .split(/[,;]\s*/)
      .map((p) => p.trim())
      .filter(Boolean);
  }
  return phrases.length > 1 ? phrases : [single];
}

// Posiciona os acordes acima de uma linha, espaçados de forma legível.
function buildChordLine(chordsForLine: string[], lyric: string): string {
  if (chordsForLine.length === 0) return "";
  const len = Math.max(lyric.length, 1);
  let line = "";
  chordsForLine.forEach((ch, idx) => {
    let col = Math.round((idx * len) / chordsForLine.length);
    if (line.length > 0 && col <= line.length) col = line.length + 1; // não grudar
    while (line.length < col) line += " ";
    line += ch;
  });
  return line.replace(/\s+$/, "");
}

// Monta a cifra completa: cabeçalho + acordes distribuídos sobre cada linha.
function buildLyricChart(
  lyricsRaw: string,
  progression: string[],
  keySymbol: string,
  bpm: number,
): string {
  const lines = splitLyrics(lyricsRaw);
  if (lines.length === 0) return "";
  const prog = progression.map((c) => c.trim()).filter(Boolean);

  const headerParts = [`Tom: ${keySymbol}`];
  if (bpm > 0) headerParts.push(`BPM: ${bpm}`);
  const header = headerParts.join("   ");

  // Distribuição proporcional: garante que TODA a progressão apareça.
  // - menos linhas que acordes  → mais de um acorde por linha
  // - mais linhas que acordes    → a progressão se repete ao longo das linhas
  const perLine = prog.length > 0 ? Math.max(1, Math.ceil(prog.length / lines.length)) : 0;

  const blocks: string[] = [];
  let ci = 0;
  for (const lyric of lines) {
    if (prog.length === 0) {
      blocks.push(lyric);
      continue;
    }
    const chordsForLine: string[] = [];
    for (let k = 0; k < perLine; k++) {
      chordsForLine.push(prog[ci % prog.length]);
      ci++;
    }
    const chordLine = buildChordLine(chordsForLine, lyric);
    blocks.push(chordLine ? `${chordLine}\n${lyric}` : lyric);
  }

  return `${header}\n\n${blocks.join("\n\n")}`;
}

export default function AudioLab() {
  const [, navigate] = useLocation();

  const [phase, setPhase] = useState<Phase>("idle");
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string>("");
  const [step, setStep] = useState<AnalysisStep>("lendo");
  const [error, setError] = useState<string>("");

  const [result, setResult] = useState<AudioAnalysisResult | null>(null);
  const [chords, setChords] = useState<string[]>([]);
  const level: SophisticationLevel = "intermediario";

  // ── Montar cifra com letra ─────────────────────────────────────────────────
  const [lyrics, setLyrics] = useState("");
  const [chartSource, setChartSource] = useState<ChartSource>("detectados");
  const [chart, setChart] = useState("");
  const [chartReady, setChartReady] = useState(false);
  const [editingChart, setEditingChart] = useState(false);
  const [copied, setCopied] = useState(false);
  const [chartHasUncertain, setChartHasUncertain] = useState(false);

  // ── Pipeline automático (transcrição) ──────────────────────────────────────
  const [autoAvailable, setAutoAvailable] = useState<boolean | null>(null);
  const [autoState, setAutoState] = useState<"idle" | "running">("idle");
  const [autoMessage, setAutoMessage] = useState("");

  // Busca de cifra pronta (CifraClub)
  const [cifraQuery, setCifraQuery] = useState("");
  const [cifraState, setCifraState] = useState<"idle" | "running">("idle");
  const [cifraNotice, setCifraNotice] = useState("");
  const [cifraMeta, setCifraMeta] = useState<FetchedCifra | null>(null);
  // Origem da cifra montada (muda o cabeçalho e as dicas exibidas).
  const [chartOrigin, setChartOrigin] = useState<"cifra" | "auto" | "manual" | null>(null);
  const cifraRunIdRef = useRef(0);
  const cifraTriggeredRef = useRef(false);
  // Token de escrita compartilhado: garante que apenas a operação mais recente
  // (cifra, transcrição ou montagem manual) escreva no estado `chart`, evitando
  // que uma resposta tardia sobrescreva conteúdo já gerado/editado pelo usuário.
  const chartClaimRef = useRef(0);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioFileRef = useRef<File | null>(null);
  const runIdRef = useRef(0);
  const autoRunIdRef = useRef(0);
  const autoTriggeredRef = useRef(false);
  const busyRef = useRef(false);

  useEffect(() => {
    return () => {
      runIdRef.current++; // invalida análise pendente ao sair
    };
  }, []);

  const reset = useCallback(() => {
    runIdRef.current++;
    busyRef.current = false;
    setPhase("idle");
    setFileName("");
    setError("");
    setResult(null);
    setChords([]);
    setLyrics("");
    setChartSource("detectados");
    setChart("");
    setChartReady(false);
    setEditingChart(false);
    setCopied(false);
    setChartHasUncertain(false);
    setAutoAvailable(null);
    setAutoState("idle");
    setAutoMessage("");
    setCifraQuery("");
    setCifraState("idle");
    setCifraNotice("");
    setCifraMeta(null);
    setChartOrigin(null);
    cifraRunIdRef.current++; // invalida busca de cifra pendente
    cifraTriggeredRef.current = false;
    chartClaimRef.current++; // invalida qualquer escrita pendente em `chart`
    autoRunIdRef.current++; // invalida transcrição pendente
    autoTriggeredRef.current = false;
    audioFileRef.current = null;
    setStep("lendo");
  }, []);

  const handleFile = useCallback(async (file: File) => {
    if (busyRef.current) return; // evita uploads simultâneos
    if (!isAllowedFile(file)) {
      setPhase("error");
      setError("Envie um arquivo MP3, WAV ou M4A.");
      return;
    }
    if (file.size > MAX_SIZE) {
      setPhase("error");
      setError("Esse arquivo é muito grande. Tente enviar um áudio menor (até 50MB).");
      return;
    }

    const runId = ++runIdRef.current;
    busyRef.current = true;
    autoTriggeredRef.current = false;
    cifraTriggeredRef.current = false;
    audioFileRef.current = file;
    setFileName(file.name);
    setCifraQuery(guessQueryFromFile(file.name));
    setError("");
    setResult(null);
    setStep("lendo");
    setPhase("analyzing");

    try {
      const data = await file.arrayBuffer();
      if (runId !== runIdRef.current) return;
      const buffer = await decodeAudioFile(data);
      if (runId !== runIdRef.current) return;

      if (buffer.duration > MAX_DURATION) {
        setPhase("error");
        setError(
          "Esse áudio é muito longo. Envie uma música ou um trecho de até 12 minutos.",
        );
        return;
      }

      const analysis = await analyzeAudioBuffer(buffer, (s) => {
        if (runId === runIdRef.current) setStep(s);
      });
      if (runId !== runIdRef.current) return;

      if (!analysis.bpm.bpm && analysis.chords.length === 0) {
        setPhase("error");
        setError(
          "Não conseguimos analisar esse áudio com precisão. Tente um trecho mais limpo ou com menos instrumentos.",
        );
        return;
      }

      // Análise harmônica profissional no servidor (muito mais precisa). Mantém
      // o BPM e a duração locais; substitui apenas tom/acordes quando o servidor
      // responde. Em qualquer falha, fica com o detector local (fallback).
      let finalAnalysis = analysis;
      try {
        setStep("acordes");
        const remote = await analyzeChordsRemote(file, analysis.bpm.bpm);
        if (runId !== runIdRef.current) return;
        if (remote.ok && remote.result.chords.length > 0) {
          finalAnalysis = {
            ...analysis,
            key: remote.result.key ?? analysis.key,
            chords: remote.result.chords,
            chordTimeline: remote.result.chordTimeline,
          };
        }
      } catch {
        // Mantém o resultado local.
      }

      setResult(finalAnalysis);
      setChords(finalAnalysis.chords);
      setPhase("result");
    } catch {
      if (runId !== runIdRef.current) return;
      setPhase("error");
      setError(
        "Não foi possível analisar esse áudio. O formato pode não ser suportado neste navegador (tente MP3 ou WAV).",
      );
    } finally {
      if (runId === runIdRef.current) busyRef.current = false;
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  // ── Sofisticação ────────────────────────────────────────────────────────────
  const sophisticated = useMemo(() => {
    const clean = chords.map((c) => c.trim()).filter(Boolean);
    if (clean.length === 0) return [];
    const { lines } = processChordChartFull(clean.join("  "), level);
    return lines
      .flatMap((l) => l.tokens)
      .filter((t) => t.type === "chord" && t.substitution)
      .map((t) => ({
        original: t.substitution!.original,
        substituted: t.substitution!.substituted,
        chordId: t.substitution!.chordId,
      }));
  }, [chords, level]);

  const bpmOpt = result?.bpm.options[result.bpm.recommendedIndex];
  const altBpms = result
    ? result.bpm.options
        .filter((_, i) => i !== result.bpm.recommendedIndex)
        .map((o) => o.bpm)
        .filter((b) => b > 0)
    : [];

  // Progressão sofisticada (na ordem) para usar na cifra com letra
  const sophisticatedChords = useMemo(
    () => sophisticated.map((s) => s.substituted),
    [sophisticated],
  );
  const bpmValue = bpmOpt?.bpm ?? result?.bpm.bpm ?? 0;

  // Ao entrar no resultado: dispara a busca da cifra pronta (uma vez) e verifica,
  // em segundo plano, se a transcrição automática está disponível como alternativa.
  useEffect(() => {
    if (phase !== "result") return;
    let active = true;

    if (!cifraTriggeredRef.current && cifraQuery.trim()) {
      cifraTriggeredRef.current = true;
      void handleFetchCifra();
    }

    setAutoAvailable(null);
    getTranscriptionStatus().then((s) => {
      if (!active) return;
      setAutoAvailable(s.available);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, result]);

  const buildChart = useCallback(() => {
    if (!result) return;
    const prog =
      chartSource === "sofisticados" && sophisticatedChords.length > 0
        ? sophisticatedChords
        : chords;
    chartClaimRef.current++; // assume a escrita: invalida cifra/transcrição pendentes
    const text = buildLyricChart(lyrics, prog, result.key.symbol, bpmValue);
    setChart(text);
    setChartReady(true);
    setChartHasUncertain(false);
    setEditingChart(false);
    setCopied(false);
    setChartOrigin("manual");
  }, [result, chartSource, sophisticatedChords, chords, lyrics, bpmValue]);

  // Pipeline automático: transcreve a letra (worker externo) e alinha os acordes
  // detectados (com timestamps) sobre as palavras. Nunca inventa letra.
  const generateAutoChart = useCallback(async () => {
    if (!result || !audioFileRef.current || autoState === "running") return;
    const runId = ++autoRunIdRef.current;
    const claim = ++chartClaimRef.current; // reivindica a escrita em `chart`
    setAutoState("running");
    setAutoMessage("");

    const outcome = await transcribeAudio(audioFileRef.current);
    if (runId !== autoRunIdRef.current) return; // descarta resposta obsoleta (reset/troca)

    if (!outcome.ok) {
      setAutoState("idle");
      setAutoMessage(outcome.message);
      if (outcome.reason === "external_processing_required") setAutoAvailable(false);
      return;
    }

    // Se o usuário gerou/editou outra cifra enquanto transcrevíamos, não sobrescreve.
    if (claim !== chartClaimRef.current) {
      setAutoState("idle");
      return;
    }

    const { chart: aligned, hasUncertain } = buildAlignedChart(
      outcome.result,
      result.chordTimeline,
      result.key.symbol,
      bpmValue,
    );
    setChart(aligned);
    setChartReady(true);
    setChartHasUncertain(hasUncertain);
    setEditingChart(false);
    setCopied(false);
    setChartOrigin("auto");
    setAutoState("idle");
    setAutoMessage("");
  }, [result, autoState, bpmValue]);

  // Busca uma cifra pronta no CifraClub a partir do texto digitado/derivado do
  // nome do arquivo. Em caso de sucesso, a cifra (acordes sobre a letra) vira a
  // cifra montada editável — substituindo a detecção do áudio.
  const handleFetchCifra = useCallback(async () => {
    const q = cifraQuery.trim();
    if (!q || cifraState === "running") return;
    const runId = ++cifraRunIdRef.current;
    const claim = ++chartClaimRef.current; // reivindica a escrita em `chart`
    setCifraState("running");
    setCifraNotice("");

    const out = await fetchCifra(q);
    if (runId !== cifraRunIdRef.current) return; // descarta resposta obsoleta

    setCifraState("idle");

    if (!out.ok) {
      if (out.reason === "unauthorized") {
        setCifraNotice(
          "Sua sessão expirou. Atualize a página e entre novamente para buscar a cifra.",
        );
      } else if (out.reason === "empty") {
        setCifraNotice("Digite o nome da música (de preferência: Artista - Música).");
      } else {
        setCifraNotice(
          "Não consegui acessar a cifra agora. Verifique sua conexão e tente de novo.",
        );
      }
      return;
    }

    if (!out.found) {
      setCifraNotice(
        "Não encontrei essa cifra no CifraClub. Confira o nome (ex.: “Artista - Música”) ou cole/edite a cifra manualmente abaixo.",
      );
      setCifraMeta(null);
      return;
    }

    // Se o usuário já montou/editou outra cifra enquanto buscávamos, não sobrescreve.
    if (claim !== chartClaimRef.current) {
      setCifraMeta(out.cifra);
      return;
    }

    setCifraMeta(out.cifra);
    setChart(out.cifra.body);
    setChartReady(true);
    setChartHasUncertain(false);
    setEditingChart(false);
    setCopied(false);
    setChartOrigin("cifra");
  }, [cifraQuery, cifraState]);

  const copyChart = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(chart);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard indisponível — ignora silenciosamente
    }
  }, [chart]);

  const sendChartToSofisticador = useCallback(() => {
    try {
      sessionStorage.setItem(SOFISTICADOR_PREFILL_KEY, chart);
    } catch {
      // sessionStorage indisponível — segue para a página mesmo assim
    }
    navigate("/sofisticador");
  }, [chart, navigate]);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 lg:py-12">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <AudioWaveform className="w-5 h-5 text-primary" />
          </div>
          <h1 className="font-display text-3xl font-bold text-white">Audio Lab</h1>
        </div>
        <p className="text-muted-foreground text-base leading-relaxed">
          Envie uma música e descubra o tom, o BPM e os acordes. Depois é só ajustar e
          mandar a progressão para o Sofisticador de Cifras.
        </p>
      </div>

      <AnimatePresence mode="wait">
        {/* ── Upload ─────────────────────────────────────────────────────────── */}
        {(phase === "idle" || phase === "error") && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "glass-card rounded-3xl border-2 border-dashed p-10 sm:p-14 text-center cursor-pointer transition-all",
                dragOver
                  ? "border-primary bg-primary/10"
                  : "border-white/15 hover:border-primary/50 hover:bg-white/[0.03]",
              )}
            >
              <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/15 border border-primary/20 flex items-center justify-center text-primary mb-5">
                <UploadCloud className="w-8 h-8" />
              </div>
              <h2 className="font-display text-xl font-bold text-white mb-2">
                Envie uma música
              </h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
                O Harmonic analisa o áudio e identifica tom, BPM e acordes. Arraste o
                arquivo aqui ou clique para escolher.
              </p>
              <span className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl font-semibold text-white bg-primary hover:bg-primary/90 transition-all">
                <FileAudio className="w-5 h-5" />
                Enviar áudio
              </span>
              <p className="text-xs text-muted-foreground/60 mt-5">
                Formatos: MP3, WAV ou M4A • até 50MB
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />

            {phase === "error" && error && (
              <div className="flex items-start gap-2 mt-5 text-sm text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 py-3">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-start gap-2 mt-5 text-[12px] text-muted-foreground/80 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-primary/70" />
              <span>
                A análise acontece direto no seu navegador. A detecção de acordes é uma
                estimativa — você poderá ajustar tudo antes de sofisticar.
              </span>
            </div>
          </motion.div>
        )}

        {/* ── Analisando ─────────────────────────────────────────────────────── */}
        {phase === "analyzing" && (
          <motion.div
            key="analyzing"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="glass-card rounded-3xl border border-white/10 p-8 sm:p-10"
          >
            <div className="flex items-center gap-3 mb-6">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
              <div className="min-w-0">
                <p className="font-display font-bold text-white">Analisando sua música</p>
                <p className="text-xs text-muted-foreground truncate">{fileName}</p>
              </div>
            </div>

            <div className="space-y-3">
              {STEPS.map((s, i) => {
                const currentIdx = STEPS.findIndex((x) => x.key === step);
                const state =
                  i < currentIdx ? "done" : i === currentIdx ? "active" : "todo";
                return (
                  <div key={s.key} className="flex items-center gap-3">
                    <span
                      className={cn(
                        "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border transition-colors",
                        state === "done" && "bg-primary border-primary text-primary-foreground",
                        state === "active" && "border-primary text-primary",
                        state === "todo" && "border-white/15 text-white/30",
                      )}
                    >
                      {state === "active" ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        i + 1
                      )}
                    </span>
                    <span
                      className={cn(
                        "text-sm transition-colors",
                        state === "todo" ? "text-white/35" : "text-white/85",
                      )}
                    >
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* ── Resultado ──────────────────────────────────────────────────────── */}
        {phase === "result" && result && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-5"
          >
            {/* Resumo */}
            <div className="glass-card rounded-3xl border border-white/10 p-6">
              <div className="flex items-center justify-between gap-3 mb-5">
                <div className="flex items-center gap-2 min-w-0">
                  <FileAudio className="w-4 h-4 text-primary shrink-0" />
                  <p className="text-sm text-white/80 truncate">{fileName}</p>
                </div>
                <button
                  onClick={reset}
                  className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/80 transition-colors shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Nova música
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <SummaryCard icon={Music2} label="Tom" value={result.key.symbol} hint={result.key.ptLabel} />
                <SummaryCard
                  icon={Gauge}
                  label="BPM"
                  value={String(bpmOpt?.bpm ?? result.bpm.bpm)}
                  hint={altBpms.length ? `alt: ${altBpms.join(" / ")}` : undefined}
                />
                <SummaryCard
                  icon={AudioWaveform}
                  label="Compasso"
                  value={result.bpm.timeSignature ?? "—"}
                />
                <SummaryCard
                  icon={Clock}
                  label="Duração"
                  value={formatDuration(result.duration)}
                />
              </div>
            </div>

            {/* ── Buscar cifra pronta (CifraClub) — primário ──────────────── */}
            <div className="glass-card rounded-3xl border border-primary/20 bg-primary/5 p-6">
              <div className="flex items-center gap-2 mb-1">
                <ListMusic className="w-4 h-4 text-primary" />
                <h3 className="font-display font-bold text-white">
                  Buscar cifra pronta
                </h3>
              </div>
              <div className="flex items-start gap-2 mb-4 text-[12px] text-muted-foreground/80 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5">
                <Info className="w-4 h-4 shrink-0 mt-0.5 text-primary/70" />
                <span>
                  O Harmonic procura a cifra da música no CifraClub (feita por pessoas) e
                  traz a letra com os acordes já posicionados. Para encontrar certinho, use
                  o formato <span className="text-white/80">Artista - Música</span>.
                </span>
              </div>

              <label className="block text-sm font-medium text-white/80 mb-2">
                Nome da música
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={cifraQuery}
                  onChange={(e) => setCifraQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleFetchCifra();
                    }
                  }}
                  placeholder="Ex.: Gabriela Rocha - Atos 2"
                  className="flex-1 bg-secondary/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                />
                <button
                  onClick={handleFetchCifra}
                  disabled={cifraState === "running" || cifraQuery.trim().length === 0}
                  className={cn(
                    "inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm transition-all shrink-0",
                    cifraState === "running" || cifraQuery.trim().length === 0
                      ? "bg-white/5 text-white/30 cursor-not-allowed"
                      : "bg-primary text-primary-foreground hover:bg-primary/90",
                  )}
                >
                  {cifraState === "running" ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Buscando…
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" /> Buscar cifra
                    </>
                  )}
                </button>
              </div>

              {cifraNotice && (
                <div className="flex items-start gap-2 mt-4 text-sm text-amber-200/90 bg-amber-500/10 border border-amber-500/25 rounded-xl px-4 py-3">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{cifraNotice}</span>
                </div>
              )}

              {cifraMeta && chartOrigin === "cifra" && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-4 text-sm">
                  <span className="inline-flex items-center gap-1.5 text-emerald-300 shrink-0">
                    <Check className="w-4 h-4" /> Cifra encontrada
                  </span>
                  <span className="text-white/70 min-w-0 truncate">
                    {cifraMeta.title}
                    {cifraMeta.artist ? ` — ${cifraMeta.artist}` : ""}
                    {cifraMeta.key ? ` · Tom ${cifraMeta.key}` : ""}
                  </span>
                  {cifraMeta.url && (
                    <a
                      href={cifraMeta.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline shrink-0"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> ver original
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* ── Transcrição automática do áudio (alternativa) ────────────── */}
            <div className="glass-card rounded-3xl border border-white/10 p-6">
              <div className="flex items-center gap-2 mb-1">
                <Mic className="w-4 h-4 text-primary" />
                <h3 className="font-display font-bold text-white">
                  Transcrição automática do áudio
                </h3>
              </div>
              <div className="flex items-start gap-2 mb-4 text-[12px] text-muted-foreground/80 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5">
                <Info className="w-4 h-4 shrink-0 mt-0.5 text-primary/70" />
                <span>
                  Não achou a cifra pronta? O Harmonic pode transcrever a letra a partir do
                  áudio e posicionar os acordes detectados. É uma estimativa (funciona melhor
                  com vocal claro) e o posicionamento é aproximado — trechos incertos ficam
                  marcados com “?”.
                </span>
              </div>

              {autoAvailable === false ? (
                <div className="flex items-start gap-2 text-sm text-amber-200/90 bg-amber-500/10 border border-amber-500/25 rounded-xl px-4 py-3">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-amber-100">
                      Transcrição automática indisponível
                    </p>
                    <p className="mt-1 text-amber-200/80">
                      {autoMessage ||
                        "A transcrição automática não está ativa neste ambiente no momento."}
                    </p>
                    <p className="mt-2 text-amber-200/70">
                      Enquanto isso, você pode colar a letra manualmente logo abaixo.
                    </p>
                  </div>
                </div>
              ) : autoState === "running" || autoAvailable === null ? (
                <div className="flex items-center gap-2 text-sm text-white/70">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  {autoAvailable === null ? "Preparando…" : "Transcrevendo a letra…"}
                </div>
              ) : autoMessage ? (
                <div className="space-y-3">
                  <div className="flex items-start gap-2 text-sm text-rose-200/90 bg-rose-500/10 border border-rose-500/25 rounded-xl px-4 py-3">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{autoMessage}</span>
                  </div>
                  <button
                    onClick={generateAutoChart}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
                  >
                    <RotateCcw className="w-4 h-4" /> Tentar novamente
                  </button>
                </div>
              ) : chartOrigin === "auto" ? (
                <div className="flex items-center gap-2 text-sm text-emerald-300">
                  <Check className="w-4 h-4" /> Letra gerada — veja abaixo.
                </div>
              ) : (
                <button
                  onClick={generateAutoChart}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm bg-white/10 text-white hover:bg-white/15 border border-white/10 transition-all"
                >
                  <Mic className="w-4 h-4" /> Transcrever a letra do áudio
                </button>
              )}
            </div>

            {/* ── Ou cole a letra manualmente (alternativa) ────────────────── */}
            <div className="glass-card rounded-3xl border border-white/10 p-6">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-4 h-4 text-primary" />
                <h3 className="font-display font-bold text-white">
                  Ou cole a letra manualmente
                </h3>
              </div>
              <div className="flex items-start gap-2 mb-4 text-[12px] text-muted-foreground/80 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5">
                <Info className="w-4 h-4 shrink-0 mt-0.5 text-primary/70" />
                <span>
                  Se preferir, cole a letra da música e o Harmonic organiza a cifra com base
                  nos acordes detectados. Você pode ajustar tudo antes de usar.
                </span>
              </div>

              <label className="block text-sm font-medium text-white/80 mb-2">
                Cole a letra da música
              </label>
              <textarea
                value={lyrics}
                onChange={(e) => setLyrics(e.target.value)}
                placeholder={"Cole aqui a letra da música…"}
                className="w-full min-h-[140px] bg-secondary/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-y leading-relaxed"
              />

              {/* Seletor de acordes + ação */}
              <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground mr-1">Usar acordes:</span>
                  {(["detectados", "sofisticados"] as ChartSource[]).map((src) => {
                    const disabled =
                      src === "sofisticados" && sophisticatedChords.length === 0;
                    return (
                      <button
                        key={src}
                        onClick={() => !disabled && setChartSource(src)}
                        disabled={disabled}
                        className={cn(
                          "text-xs font-medium px-3 py-1.5 rounded-lg border transition-all capitalize",
                          chartSource === src
                            ? "bg-primary/20 border-primary/30 text-primary"
                            : disabled
                              ? "border-white/5 text-white/20 cursor-not-allowed"
                              : "border-white/10 text-white/50 hover:bg-white/5 hover:text-white",
                        )}
                      >
                        {src}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={buildChart}
                  disabled={lyrics.trim().length === 0}
                  className={cn(
                    "sm:ml-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all",
                    lyrics.trim().length === 0
                      ? "bg-white/5 text-white/30 cursor-not-allowed"
                      : "bg-primary text-primary-foreground hover:bg-primary/90",
                  )}
                >
                  <FileText className="w-4 h-4" /> Montar cifra com letra
                </button>
              </div>

            </div>

            {/* ── Cifra montada (compartilhada: automática ou manual) ──────── */}
            <AnimatePresence>
              {chartReady && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="glass-card rounded-3xl border border-white/10 p-6"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4 text-primary" />
                    <h4 className="font-display font-bold text-white">
                      {chartOrigin === "cifra" ? "Cifra encontrada" : "Letra + cifra organizada"}
                    </h4>
                  </div>
                  {chartOrigin === "cifra" ? (
                    <p className="text-[12px] text-muted-foreground/70 mb-3">
                      Cifra do CifraClub
                      {cifraMeta?.key ? ` (Tom ${cifraMeta.key})` : ""}. Você pode ajustar o
                      que quiser antes de usar.{" "}
                      {cifraMeta?.url && (
                        <a
                          href={cifraMeta.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline align-baseline"
                        >
                          <ExternalLink className="w-3 h-3" /> ver original
                        </a>
                      )}
                    </p>
                  ) : (
                    <p className="text-[12px] text-muted-foreground/70 mb-3">
                      Esta cifra foi organizada automaticamente. Revise a posição dos acordes
                      antes de usar.
                    </p>
                  )}
                  {chartHasUncertain && (
                    <div className="flex items-start gap-2 mb-3 text-[12px] text-amber-300/90 bg-amber-500/10 border border-amber-500/25 rounded-xl px-3 py-2.5">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>
                        Alguns trechos ficaram incertos (marcados com “?”). Confira a letra e
                        os acordes nesses pontos.
                      </span>
                    </div>
                  )}

                  {editingChart ? (
                    <textarea
                      value={chart}
                      onChange={(e) => {
                        chartClaimRef.current++; // edição do usuário tem prioridade
                        setChart(e.target.value);
                      }}
                      spellCheck={false}
                      className="w-full min-h-[260px] bg-secondary/40 border border-primary/30 rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-y leading-loose whitespace-pre"
                    />
                  ) : (
                    <pre className="w-full overflow-x-auto bg-secondary/40 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm leading-loose whitespace-pre notranslate" translate="no">
                      {chart}
                    </pre>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={() => setEditingChart((v) => !v)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border border-white/10 text-white/70 hover:bg-white/5 hover:text-white transition-all"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      {editingChart ? "Concluir edição" : "Editar"}
                    </button>
                    <button
                      onClick={copyChart}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border border-white/10 text-white/70 hover:bg-white/5 hover:text-white transition-all"
                    >
                      {copied ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      {copied ? "Copiado!" : "Copiar cifra"}
                    </button>
                    <button
                      onClick={sendChartToSofisticador}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
                    >
                      <Wand2 className="w-3.5 h-3.5" /> Sofisticar cifra
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1.5">
        <Icon className="w-3.5 h-3.5" />
        <span className="text-[11px] font-bold uppercase tracking-widest">{label}</span>
      </div>
      <p className="text-2xl font-display font-bold text-white notranslate" translate="no">
        {value}
      </p>
      {hint && <p className="text-[11px] text-muted-foreground/70 mt-0.5">{hint}</p>}
    </div>
  );
}
