import { useCallback, useEffect, useRef, useState } from "react";
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
  Copy,
  Check,
  Pencil,
  Mic,
  Square,
  Search,
  Sparkles,
  ChevronRight,
  Youtube,
  Headphones,
  Download,
  Music,
} from "lucide-react";
import { useLocation } from "wouter";
import {
  analyzeAudioBuffer,
  decodeAudioFile,
  formatDuration,
  type AnalysisStep,
  type AudioAnalysisResult,
} from "@/lib/audio-analysis";
import { transcribeAudio, type TranscribeOutcome } from "@/lib/transcription";
import { analyzeChordsRemote } from "@/lib/chord-remote";
import {
  fetchCifra,
  fetchCifraByLyrics,
  pickCifra,
  type FetchedCifra,
  type CifraCandidate,
} from "@/lib/cifra-remote";
import {
  fileToAudioBuffer,
  makeInstrumental,
  emphasizeVocals,
  encodeWav,
  MonoSourceError,
} from "@/lib/audio-stems";
import { cn } from "@/lib/utils";

const MAX_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_DURATION = 12 * 60; // 12 minutos (limita memória/CPU mesmo com arquivos comprimidos)
const MAX_RECORD_SECONDS = 30; // gravação de canto: um trecho curto já identifica a música
const ACCEPT = ".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/x-m4a,audio/mp4,audio/*";

const STEPS: { key: AnalysisStep; label: string }[] = [
  { key: "lendo", label: "Lendo o áudio" },
  { key: "tom", label: "Detectando o tom" },
  { key: "bpm", label: "Detectando o BPM" },
  { key: "acordes", label: "Refinando a análise" },
  { key: "finalizando", label: "Gerando o resultado" },
];

type Phase = "idle" | "analyzing" | "result" | "error";
type InputMode = "upload" | "record" | "search";
// Estado do pipeline que identifica a música pela letra e busca a cifra pronta.
type CifraStatus = "idle" | "transcribing" | "searching" | "done" | "failed";

// Chave usada para enviar a cifra montada ao Sofisticador de Cifras.
// O mesmo literal é lido em chord-substitutor.tsx.
const SOFISTICADOR_PREFILL_KEY = "harmonic:sofisticador:prefill";

function isAllowedFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return /\.(mp3|wav|m4a)$/.test(name) || file.type.startsWith("audio/");
}

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Mensagem amigável a partir de uma falha de transcrição.
function transcribeErrorMessage(outcome: Extract<TranscribeOutcome, { ok: false }>): string {
  switch (outcome.reason) {
    case "external_processing_required":
      return "A transcrição automática não está ativa neste ambiente no momento. Você pode ajustar o nome da música abaixo.";
    case "empty":
      return "Nenhum áudio para transcrever.";
    case "unauthorized":
      return "Sua sessão expirou. Atualize a página e entre novamente.";
    default:
      return (
        outcome.message ||
        "Não consegui entender a letra desse áudio. Tente um trecho mais limpo (voz clara) ou ajuste o nome da música abaixo."
      );
  }
}

// ── Renderização nativa da cifra (folha de cifra) ─────────────────────────────
// Classificamos cada linha e estilizamos: seções viram etiquetas, acordes ganham
// cor e a letra fica legível. O alinhamento acorde-sobre-letra é preservado com
// fonte monoespaçada e bastante respiro vertical para facilitar a leitura.

// Reconhece um token de acorde (raiz maiúscula A–G + sufixos/baixo).
function isChordToken(t: string): boolean {
  return /^[A-G][#b]?(?:[mM]|maj|min|dim|aug|sus|add|°|º|\+|\d|\(|\)|#|b|\/|[A-G])*$/.test(t);
}

type LineKind = "section" | "chords" | "tab" | "lyric" | "blank" | "annotation";

// Marcações de execução (não são letra nem acorde): "(2x)", "Solo", "Intro",
// "Instrumental", "repete 2x", "bis", "Final"…
const ANNOTATION_RE =
  /^\(?\s*(?:\d+\s*x|x\s*\d+|bis|solo|intro|instrumental|final|riff|coda|tutti|(?:repete|repetir)[a-zçãõéêáà0-9 ]*)\s*\)?\s*[:.\-–—]*\s*$/i;

function classifyLine(line: string): LineKind {
  const trimmed = line.trim();
  if (!trimmed) return "blank";
  if (/^\[[^\]]+\]$/.test(trimmed)) return "section";
  // Linhas de tablatura: corda + barra + traços (ex.: "E|--3--2--").
  if (/\|/.test(line) && /-{2,}/.test(line)) return "tab";
  // Marcação de execução isolada — tratada como não-letra.
  if (ANNOTATION_RE.test(trimmed)) return "annotation";
  // Ignora tokens que são só pontuação (ex.: parênteses de progressão "( Em7 C9 )").
  const tokens = trimmed.split(/\s+/).filter((t) => !/^[()|:.-]+$/.test(t));
  if (tokens.length === 0) return "lyric";
  const chordCount = tokens.filter(isChordToken).length;
  if (chordCount > 0 && chordCount / tokens.length >= 0.8) return "chords";
  return "lyric";
}

function SectionLabel({ text }: { text: string }) {
  return (
    <span className="inline-block font-sans text-xs font-semibold uppercase tracking-wider text-primary bg-primary/10 border border-primary/20 rounded-md px-2.5 py-1">
      {text}
    </span>
  );
}

// Quebra uma linha de acordes em tokens, ignorando separadores soltos.
function chordRowTokens(s: string): string[] {
  return s.trim().split(/\s+/).filter((t) => t && !/^[()|]+$/.test(t));
}

// Fileira de acordes com espaçamento uniforme (intro/solo/passagem sem letra).
function ChordRow({ source }: { source: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-primary font-semibold tracking-wide">
      {chordRowTokens(source).map((t, k) => (
        <span key={k}>{t}</span>
      ))}
    </div>
  );
}

function ChordSheet({ text }: { text: string }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const kinds = lines.map(classifyLine);

  // Uma linha de acordes é "instrumental" quando a próxima linha com conteúdo
  // NÃO é uma letra — aí os recuos enormes da fonte não alinham nada e podem
  // ser normalizados. Se houver letra embaixo, mantemos o alinhamento exato.
  const isInstrumental = (i: number): boolean => {
    for (let j = i + 1; j < lines.length; j++) {
      if (kinds[j] !== "blank") return kinds[j] !== "lyric";
    }
    return true;
  };

  return (
    <div className="w-full overflow-x-auto rounded-2xl border border-white/10 bg-secondary/30 px-5 py-5 sm:px-7 sm:py-6 font-mono text-[13px] sm:text-[15px] leading-[1.85] notranslate" translate="no">
      {lines.map((line, i) => {
        const kind = kinds[i];
        if (kind === "blank") return <div key={i} className="h-5" aria-hidden />;
        if (kind === "section") {
          return (
            <div key={i} className="mt-7 mb-2 first:mt-0">
              <SectionLabel text={line.trim().replace(/^\[|\]$/g, "")} />
            </div>
          );
        }
        // Linha que começa com [Seção] seguida de acordes na mesma linha. Se
        // houver letra logo abaixo, preserva o alinhamento; senão, fileira limpa.
        const inline = line.match(/^\s*\[([^\]]+)\]\s*(.*)$/);
        if (inline && inline[2].trim()) {
          return (
            <div key={i} className="mt-7 first:mt-0">
              <div className="mb-2">
                <SectionLabel text={inline[1]} />
              </div>
              {isInstrumental(i) ? (
                <ChordRow source={inline[2]} />
              ) : (
                <div className="whitespace-pre text-primary font-semibold tracking-wide">
                  {inline[2]}
                </div>
              )}
            </div>
          );
        }
        if (kind === "chords") {
          // Sem letra embaixo → normaliza; com letra embaixo → preserva a grade.
          if (isInstrumental(i)) {
            return <ChordRow key={i} source={line} />;
          }
          return (
            <div key={i} className="whitespace-pre text-primary font-semibold tracking-wide">
              {line || " "}
            </div>
          );
        }
        if (kind === "annotation") {
          return (
            <div key={i} className="whitespace-pre text-white/40 italic">
              {line || " "}
            </div>
          );
        }
        if (kind === "tab") {
          return (
            <div key={i} className="whitespace-pre text-white/40">
              {line || " "}
            </div>
          );
        }
        return (
          <div key={i} className="whitespace-pre text-white/90">
            {line || " "}
          </div>
        );
      })}
    </div>
  );
}

export default function AudioLab() {
  const [, navigate] = useLocation();

  const [phase, setPhase] = useState<Phase>("idle");
  const [inputMode, setInputMode] = useState<InputMode | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string>("");
  const [step, setStep] = useState<AnalysisStep>("lendo");
  const [error, setError] = useState<string>("");

  const [result, setResult] = useState<AudioAnalysisResult | null>(null);

  // ── Gravação (cantar) ──────────────────────────────────────────────────────
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);

  // ── Identificação da música + cifra pronta ─────────────────────────────────
  const [cifraStatus, setCifraStatus] = useState<CifraStatus>("idle");
  const [cifraNotice, setCifraNotice] = useState("");
  const [cifraMeta, setCifraMeta] = useState<FetchedCifra | null>(null);
  const [cifraQuery, setCifraQuery] = useState(""); // rede de segurança: ajustar nome
  const [searchTitle, setSearchTitle] = useState(""); // busca por título na tela inicial
  const [cifraVersions, setCifraVersions] = useState<CifraCandidate[]>([]); // versões sugeridas
  const [pickingId, setPickingId] = useState<string | null>(null); // versão sendo carregada

  // ── Cifra exibida ──────────────────────────────────────────────────────────
  const [chart, setChart] = useState("");
  const [chartReady, setChartReady] = useState(false);
  const [editingChart, setEditingChart] = useState(false);
  const [copied, setCopied] = useState(false);

  // Estúdio de áudio (separação voz/instrumental no navegador)
  const [stemKind, setStemKind] = useState<"instrumental" | "vocals" | null>(null);
  const [stemBusy, setStemBusy] = useState(false);
  const [stemProgress, setStemProgress] = useState(0);
  const [stemUrl, setStemUrl] = useState<string | null>(null);
  const [stemError, setStemError] = useState("");
  const [stemFileName, setStemFileName] = useState(""); // áudio carregado para o estúdio
  const stemUrlRef = useRef<string | null>(null);
  const stemRunIdRef = useRef(0);
  const studioInputRef = useRef<HTMLInputElement | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioFileRef = useRef<File | null>(null);
  const runIdRef = useRef(0); // análise local
  const pipelineRunIdRef = useRef(0); // transcrição + identificação
  const chartClaimRef = useRef(0); // última escrita em `chart` vence
  const busyRef = useRef(false);

  // Gravação
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      runIdRef.current++;
      pipelineRunIdRef.current++;
      stemRunIdRef.current++;
      if (stemUrlRef.current) {
        URL.revokeObjectURL(stemUrlRef.current);
        stemUrlRef.current = null;
      }
      stopStream();
    };
  }, [stopStream]);

  // Limpa qualquer resultado do estúdio de áudio (ao recomeçar/enviar outro áudio).
  const clearStems = useCallback(() => {
    stemRunIdRef.current++;
    if (stemUrlRef.current) {
      URL.revokeObjectURL(stemUrlRef.current);
      stemUrlRef.current = null;
    }
    setStemKind(null);
    setStemBusy(false);
    setStemProgress(0);
    setStemUrl(null);
    setStemError("");
    setStemFileName("");
  }, []);

  const reset = useCallback(() => {
    runIdRef.current++;
    pipelineRunIdRef.current++;
    chartClaimRef.current++;
    busyRef.current = false;
    stopStream();
    setPhase("idle");
    setInputMode(null);
    setFileName("");
    setError("");
    setResult(null);
    setIsRecording(false);
    setRecordSeconds(0);
    setCifraStatus("idle");
    setCifraNotice("");
    setCifraMeta(null);
    setCifraQuery("");
    setSearchTitle("");
    setChart("");
    setChartReady(false);
    setEditingChart(false);
    setCopied(false);
    clearStems();
    audioFileRef.current = null;
    setStep("lendo");
  }, [stopStream, clearStems]);

  // Gera a versão sem voz / com voz em destaque DO ÁUDIO ENVIADO, no navegador.
  const generateStem = useCallback(async (kind: "instrumental" | "vocals") => {
    const file = audioFileRef.current;
    if (!file || stemBusy) return;
    const runId = ++stemRunIdRef.current;
    setStemBusy(true);
    setStemKind(kind);
    setStemError("");
    setStemProgress(0);
    if (stemUrlRef.current) {
      URL.revokeObjectURL(stemUrlRef.current);
      stemUrlRef.current = null;
      setStemUrl(null);
    }
    try {
      const buffer = await fileToAudioBuffer(file);
      const stem =
        kind === "instrumental"
          ? makeInstrumental(buffer)
          : await emphasizeVocals(buffer, (p) => {
              if (stemRunIdRef.current === runId) setStemProgress(p);
            });
      // Outro run começou (reset/novo áudio/desmontagem): descarta este resultado.
      if (stemRunIdRef.current !== runId) return;
      const blob = encodeWav(stem);
      const url = URL.createObjectURL(blob);
      stemUrlRef.current = url;
      setStemUrl(url);
    } catch (err) {
      if (stemRunIdRef.current !== runId) return;
      setStemUrl(null);
      setStemError(
        err instanceof MonoSourceError
          ? "Esse áudio é mono (um canal só), então não dá para separar a voz. Envie a faixa estéreo original da música."
          : "Não consegui processar esse áudio agora. Tente enviar a música em MP3 ou WAV.",
      );
    } finally {
      if (stemRunIdRef.current === runId) setStemBusy(false);
    }
  }, [stemBusy]);

  // ── Pipeline: transcreve a letra do áudio/canto → identifica a música →
  //    busca a cifra pronta na internet. Nunca inventa letra nem acordes.
  const identifyFromAudio = useCallback(async (file: File) => {
    const runId = ++pipelineRunIdRef.current;
    const claim = ++chartClaimRef.current;
    setCifraStatus("transcribing");
    setCifraNotice("");
    setCifraMeta(null);
    setCifraVersions([]);
    setChartReady(false);

    const t = await transcribeAudio(file);
    if (runId !== pipelineRunIdRef.current) return;

    if (!t.ok) {
      setCifraStatus("failed");
      setCifraNotice(transcribeErrorMessage(t));
      return;
    }

    const lyrics = (t.result.text || t.result.lines.map((l) => l.text).join(" ")).trim();
    if (!lyrics) {
      setCifraStatus("failed");
      setCifraNotice(
        "Não consegui entender a letra desse áudio. Tente um trecho mais limpo ou ajuste o nome da música abaixo.",
      );
      return;
    }

    setCifraStatus("searching");
    const out = await fetchCifraByLyrics(lyrics);
    if (runId !== pipelineRunIdRef.current) return;

    if (!out.ok) {
      setCifraStatus("failed");
      setCifraNotice(
        out.reason === "unauthorized"
          ? "Sua sessão expirou. Atualize a página e entre novamente."
          : "Não consegui acessar a cifra agora. Verifique sua conexão e tente de novo.",
      );
      return;
    }

    if (!out.found) {
      setCifraVersions(out.candidates);
      setCifraStatus("failed");
      setCifraNotice(
        out.candidates.length > 0
          ? "Detectei a letra e encontrei algumas versões dessa música. Escolha a sua abaixo."
          : "Detectei a letra, mas não consegui reconhecer a cifra dessa música. Ajuste o nome (ex.: “Artista - Música”) abaixo.",
      );
      return;
    }

    // Se uma busca/identificação mais recente já reivindicou a escrita, não sobrescreve.
    if (claim !== chartClaimRef.current) {
      setCifraMeta(out.cifra);
      return;
    }

    setCifraVersions([]);
    setCifraMeta(out.cifra);
    setChart(out.cifra.body);
    setChartReady(true);
    setEditingChart(false);
    setCopied(false);
    setCifraQuery(
      out.cifra.artist ? `${out.cifra.artist} - ${out.cifra.title}` : out.cifra.title,
    );
    setCifraStatus("done");
  }, []);

  // ── Enviar áudio (Opção A) ─────────────────────────────────────────────────
  const handleFile = useCallback(
    async (file: File) => {
      if (busyRef.current) return;
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
      audioFileRef.current = file;
      clearStems();
      setInputMode("upload");
      setFileName(file.name);
      setError("");
      setResult(null);
      setCifraStatus("idle");
      setCifraNotice("");
      setCifraMeta(null);
      setChart("");
      setChartReady(false);
      setStep("lendo");
      setPhase("analyzing");

      try {
        const data = await file.arrayBuffer();
        if (runId !== runIdRef.current) return;
        const buffer = await decodeAudioFile(data);
        if (runId !== runIdRef.current) return;

        if (buffer.duration > MAX_DURATION) {
          setPhase("error");
          setError("Esse áudio é muito longo. Envie uma música ou um trecho de até 12 minutos.");
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

        // Refino harmônico no servidor (tom mais preciso). Best-effort: em falha
        // fica com o detector local.
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
          // mantém local
        }

        setResult(finalAnalysis);
        setPhase("result");
        // Identifica a música pela letra e busca a cifra pronta.
        void identifyFromAudio(file);
      } catch {
        if (runId !== runIdRef.current) return;
        setPhase("error");
        setError(
          "Não foi possível analisar esse áudio. O formato pode não ser suportado neste navegador (tente MP3 ou WAV).",
        );
      } finally {
        if (runId === runIdRef.current) busyRef.current = false;
      }
    },
    [identifyFromAudio, clearStems],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  // ── Cantar / gravar (Opção B) ──────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const type = chunksRef.current[0]?.type || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        stopStream();
        setIsRecording(false);
        if (blob.size === 0) {
          setError("A gravação ficou vazia. Tente novamente.");
          return;
        }
        const file = new File([blob], "gravacao.webm", { type });
        audioFileRef.current = file;
        setInputMode("record");
        setFileName("Sua gravação");
        setResult(null);
        setPhase("result");
        void identifyFromAudio(file);
      };

      recorder.start();
      setIsRecording(true);
      setRecordSeconds(0);
      timerRef.current = window.setInterval(() => {
        setRecordSeconds((prev) => {
          const next = prev + 1;
          if (next >= MAX_RECORD_SECONDS) {
            mediaRecorderRef.current?.stop();
          }
          return next;
        });
      }, 1000);
    } catch {
      setError("Não foi possível acessar o microfone. Verifique a permissão do navegador.");
      stopStream();
      setIsRecording(false);
    }
  }, [identifyFromAudio, stopStream]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const cancelRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      recorder.stop();
    }
    stopStream();
    setIsRecording(false);
    setRecordSeconds(0);
  }, [stopStream]);

  // ── Busca da cifra pronta a partir de um título ────────────────────────────
  const runCifraSearch = useCallback(async (rawQuery: string) => {
    const q = rawQuery.trim();
    if (!q) return;
    // Uma nova busca SEMPRE cancela a anterior: incrementamos os tokens
    // (pipelineRunIdRef/chartClaimRef) para que um resultado antigo, que ainda
    // esteja chegando, seja descartado e nunca sobrescreva a busca mais recente.
    const runId = ++pipelineRunIdRef.current;
    const claim = ++chartClaimRef.current;
    setCifraStatus("searching");
    setCifraNotice("");

    const out = await fetchCifra(q);
    if (runId !== pipelineRunIdRef.current) return;

    if (!out.ok) {
      setCifraStatus("failed");
      setCifraNotice(
        out.reason === "unauthorized"
          ? "Sua sessão expirou. Atualize a página e entre novamente."
          : out.reason === "empty"
            ? "Digite o nome da música (de preferência: Artista - Música)."
            : "Não consegui acessar a cifra agora. Verifique sua conexão e tente de novo.",
      );
      return;
    }
    if (!out.found) {
      setCifraVersions(out.candidates);
      setCifraStatus("failed");
      setCifraNotice(
        out.candidates.length > 0
          ? "Encontrei algumas versões dessa música. Escolha a sua abaixo."
          : "Não reconheci a cifra dessa música. Confira o nome (ex.: “Artista - Música”).",
      );
      setCifraMeta(null);
      return;
    }
    if (claim !== chartClaimRef.current) {
      setCifraMeta(out.cifra);
      return;
    }
    setCifraVersions([]);
    setCifraMeta(out.cifra);
    setChart(out.cifra.body);
    setChartReady(true);
    setEditingChart(false);
    setCopied(false);
    setCifraStatus("done");
  }, []);

  // ── Rede de segurança: ajustar o nome e buscar de novo ─────────────────────
  const handleFetchCifraByName = useCallback(() => {
    void runCifraSearch(cifraQuery);
  }, [cifraQuery, runCifraSearch]);

  // ── Pesquisar pelo título na tela inicial → player do YouTube + cifra ──────
  const handleSearchByTitle = useCallback(() => {
    const q = searchTitle.trim();
    if (!q) return;
    runIdRef.current++;
    busyRef.current = false;
    stopStream();
    clearStems();
    setInputMode("search");
    setFileName(q);
    setError("");
    setResult(null);
    setCifraVersions([]);
    setCifraMeta(null);
    setChart("");
    setChartReady(false);
    setEditingChart(false);
    setCopied(false);
    setCifraQuery(q);
    audioFileRef.current = null;
    setPhase("result");
    void runCifraSearch(q);
  }, [searchTitle, stopStream, clearStems, runCifraSearch]);

  // ── Carregar o áudio da música para usar o estúdio (modo pesquisa) ─────────
  const loadStudioFile = useCallback(
    (file: File) => {
      if (!isAllowedFile(file)) {
        setStemError("Envie um arquivo MP3, WAV ou M4A.");
        return;
      }
      if (file.size > MAX_SIZE) {
        setStemError("Esse arquivo é muito grande. Tente enviar um áudio menor (até 50MB).");
        return;
      }
      clearStems();
      audioFileRef.current = file;
      setStemFileName(file.name);
    },
    [clearStems],
  );

  // ── Carregar uma das versões sugeridas ─────────────────────────────────────
  const handlePickVersion = useCallback(async (cand: CifraCandidate) => {
    if (pickingId) return;
    const runId = ++pipelineRunIdRef.current;
    const claim = ++chartClaimRef.current;
    setPickingId(cand.id);
    setCifraNotice("");

    const out = await pickCifra(cand.id);
    if (runId !== pipelineRunIdRef.current) {
      setPickingId(null);
      return;
    }

    if (!out.ok || !out.found) {
      setPickingId(null);
      setCifraStatus("failed");
      setCifraNotice(
        "Não consegui carregar essa versão agora. Tente outra versão ou ajuste o nome abaixo.",
      );
      return;
    }
    if (claim !== chartClaimRef.current) {
      setPickingId(null);
      setCifraMeta(out.cifra);
      return;
    }
    setPickingId(null);
    setCifraVersions([]);
    setCifraMeta(out.cifra);
    setChart(out.cifra.body);
    setChartReady(true);
    setEditingChart(false);
    setCopied(false);
    setCifraQuery(
      out.cifra.artist ? `${out.cifra.artist} - ${out.cifra.title}` : out.cifra.title,
    );
    setCifraStatus("done");
  }, [pickingId]);

  const copyChart = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(chart);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard indisponível — ignora
    }
  }, [chart]);

  const sendChartToSofisticador = useCallback(() => {
    try {
      sessionStorage.setItem(SOFISTICADOR_PREFILL_KEY, chart);
    } catch {
      // sessionStorage indisponível — segue mesmo assim
    }
    navigate("/sofisticador");
  }, [chart, navigate]);

  const bpmOpt = result?.bpm.options[result.bpm.recommendedIndex];

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
          Envie a música ou cante um trecho. O Harmonic descobre a música pela letra e
          entrega a cifra pronta — depois é só ajustar e mandar para o Sofisticador.
        </p>
      </div>

      <AnimatePresence mode="wait">
        {/* ── Início: escolher como obter a cifra ──────────────────────────── */}
        {(phase === "idle" || phase === "error") && (
          <motion.div
            key="idle"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            {isRecording ? (
              <RecordingPanel
                seconds={recordSeconds}
                onStop={stopRecording}
                onCancel={cancelRecording}
              />
            ) : (
              <>
              {/* Pesquisar pelo título → ouvir no YouTube + cifra */}
              <div className="glass-card rounded-3xl border border-white/15 p-6 mb-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <Search className="w-4 h-4 text-primary" />
                  <h2 className="font-display text-lg font-bold text-white">
                    Pesquisar pelo título
                  </h2>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Já sabe a música? Digite o nome e o Harmonic abre o player para você ouvir e
                  entrega a cifra pronta.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={searchTitle}
                    onChange={(e) => setSearchTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleSearchByTitle();
                      }
                    }}
                    placeholder="Ex.: Gabriela Rocha - Atos 2"
                    className="flex-1 bg-secondary/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  />
                  <button
                    onClick={handleSearchByTitle}
                    disabled={searchTitle.trim().length === 0}
                    className={cn(
                      "inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm transition-all shrink-0",
                      searchTitle.trim().length === 0
                        ? "bg-white/5 text-white/30 cursor-not-allowed"
                        : "bg-primary text-primary-foreground hover:bg-primary/90",
                    )}
                  >
                    <Search className="w-4 h-4" /> Pesquisar
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3 my-4">
                <div className="h-px flex-1 bg-white/10" />
                <span className="text-xs uppercase tracking-wider text-white/30">ou</span>
                <div className="h-px flex-1 bg-white/10" />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {/* Opção A: enviar áudio */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "glass-card rounded-3xl border-2 border-dashed p-8 text-center cursor-pointer transition-all flex flex-col items-center",
                    dragOver
                      ? "border-primary bg-primary/10"
                      : "border-white/15 hover:border-primary/50 hover:bg-white/[0.03]",
                  )}
                >
                  <div className="w-14 h-14 rounded-2xl bg-primary/15 border border-primary/20 flex items-center justify-center text-primary mb-4">
                    <UploadCloud className="w-7 h-7" />
                  </div>
                  <h2 className="font-display text-lg font-bold text-white mb-1.5">
                    Enviar o áudio da música
                  </h2>
                  <p className="text-sm text-muted-foreground mb-5">
                    O Harmonic detecta o tom, descobre a música pela letra e entrega a cifra.
                    Arraste o arquivo ou clique para escolher.
                  </p>
                  <span className="mt-auto inline-flex items-center gap-2 px-5 py-3 rounded-2xl font-semibold text-white bg-primary hover:bg-primary/90 transition-all">
                    <FileAudio className="w-5 h-5" />
                    Escolher áudio
                  </span>
                  <p className="text-xs text-muted-foreground/60 mt-4">
                    MP3, WAV ou M4A • até 50MB
                  </p>
                </div>

                {/* Opção B: cantar */}
                <div className="glass-card rounded-3xl border border-white/15 p-8 text-center flex flex-col items-center">
                  <div className="w-14 h-14 rounded-2xl bg-primary/15 border border-primary/20 flex items-center justify-center text-primary mb-4">
                    <Mic className="w-7 h-7" />
                  </div>
                  <h2 className="font-display text-lg font-bold text-white mb-1.5">
                    Cantar a música
                  </h2>
                  <p className="text-sm text-muted-foreground mb-5">
                    Cante um trecho e o Harmonic identifica a música pela letra e entrega a
                    cifra. Funciona melhor com voz clara e pouca música ao fundo.
                  </p>
                  <button
                    onClick={startRecording}
                    className="mt-auto inline-flex items-center gap-2 px-5 py-3 rounded-2xl font-semibold text-white bg-primary hover:bg-primary/90 transition-all"
                  >
                    <Mic className="w-5 h-5" />
                    Gravar canto
                  </button>
                  <p className="text-xs text-muted-foreground/60 mt-4">
                    Até {MAX_RECORD_SECONDS}s • precisa de microfone
                  </p>
                </div>
              </div>
              </>
            )}

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

            {!isRecording && (
              <div className="flex items-start gap-2 mt-5 text-[12px] text-muted-foreground/80 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5">
                <Info className="w-4 h-4 shrink-0 mt-0.5 text-primary/70" />
                <span>
                  A cifra é detectada automaticamente por inteligência a partir da letra — e
                  pode errar. Se não for a versão certa, você poderá escolher outra versão,
                  ajustar o nome da música e a cifra antes de sofisticar.
                </span>
              </div>
            )}
          </motion.div>
        )}

        {/* ── Analisando o áudio enviado ───────────────────────────────────── */}
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
                const state = i < currentIdx ? "done" : i === currentIdx ? "active" : "todo";
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
                      {state === "active" ? <Loader2 className="w-3 h-3 animate-spin" /> : i + 1}
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

        {/* ── Resultado ────────────────────────────────────────────────────── */}
        {phase === "result" && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-5"
          >
            {/* Resumo (só quando há análise do áudio enviado) */}
            {result ? (
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
                  />
                  <SummaryCard
                    icon={AudioWaveform}
                    label="Compasso"
                    value={result.bpm.timeSignature ?? "—"}
                  />
                  <SummaryCard icon={Clock} label="Duração" value={formatDuration(result.duration)} />
                </div>
              </div>
            ) : (
              <div className="glass-card rounded-3xl border border-white/10 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {inputMode === "search" ? (
                      <Search className="w-4 h-4 text-primary shrink-0" />
                    ) : (
                      <Mic className="w-4 h-4 text-primary shrink-0" />
                    )}
                    <p className="text-sm text-white/80 truncate">{fileName}</p>
                  </div>
                  <button
                    onClick={reset}
                    className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/80 transition-colors shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Nova música
                  </button>
                </div>
              </div>
            )}

            {/* ── Cifra da música ──────────────────────────────────────────── */}
            <div className="glass-card rounded-3xl border border-primary/20 bg-primary/5 p-6">
              {/* Status do pipeline */}
              {(cifraStatus === "transcribing" || cifraStatus === "searching") && (
                <div className="flex items-center gap-2 text-sm text-white/70">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  {cifraStatus === "transcribing"
                    ? inputMode === "record"
                      ? "Ouvindo o que você cantou…"
                      : "Lendo a letra do áudio…"
                    : "Detectando a cifra dessa música…"}
                </div>
              )}

              {cifraStatus === "done" && cifraMeta && (
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-display font-bold text-white text-lg leading-tight">
                        {cifraMeta.title || "Cifra"}
                      </h3>
                      {cifraMeta.artist && (
                        <p className="text-sm text-white/50 mt-0.5">{cifraMeta.artist}</p>
                      )}
                    </div>
                    {cifraMeta.key && (
                      <span className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary">
                        <Music2 className="w-3.5 h-3.5" /> Tom {cifraMeta.key}
                      </span>
                    )}
                  </div>
                  <p className="flex items-center gap-1.5 text-[12px] text-emerald-300 mt-2">
                    <Check className="w-3.5 h-3.5 shrink-0" /> Cifra encontrada — veja abaixo.
                  </p>

                  {/* Áudio da música para ouvir enquanto toca */}
                  {(cifraMeta.youtubeId || cifraMeta.youtubeUrl) && (
                    <div className="mt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Youtube className="w-4 h-4 text-primary" />
                        <p className="text-sm font-semibold text-white/90">Ouça a música</p>
                      </div>
                      {cifraMeta.youtubeId ? (
                        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black aspect-video">
                          <iframe
                            key={cifraMeta.youtubeId}
                            src={`https://www.youtube-nocookie.com/embed/${cifraMeta.youtubeId}`}
                            title={`${cifraMeta.title} — ${cifraMeta.artist}`}
                            className="w-full h-full"
                            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        </div>
                      ) : (
                        <a
                          href={cifraMeta.youtubeUrl ?? undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-white/10 text-white/80 hover:border-primary/50 hover:bg-primary/[0.06] transition-all"
                        >
                          <Youtube className="w-4 h-4" /> Ouvir no YouTube
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )}

              {cifraStatus === "failed" && cifraNotice && (
                <div className="flex items-start gap-2 text-sm text-amber-200/90 bg-amber-500/10 border border-amber-500/25 rounded-xl px-4 py-3">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{cifraNotice}</span>
                </div>
              )}

              {/* Versões detectadas — o usuário escolhe a sua */}
              {cifraVersions.length > 0 && (
                <div className="mt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <p className="text-sm font-semibold text-white/90">
                      Versões que o Harmonic detectou
                    </p>
                  </div>
                  <div className="grid gap-2.5">
                    {cifraVersions.map((v) => {
                      const loading = pickingId === v.id;
                      const disabled = pickingId !== null && !loading;
                      return (
                        <button
                          key={v.id}
                          onClick={() => handlePickVersion(v)}
                          disabled={pickingId !== null}
                          className={cn(
                            "group flex items-center justify-between gap-3 text-left rounded-2xl border px-4 py-3 transition-all",
                            disabled
                              ? "border-white/5 bg-white/[0.02] opacity-50 cursor-not-allowed"
                              : "border-white/10 bg-secondary/40 hover:border-primary/50 hover:bg-primary/[0.06]",
                          )}
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-white truncate">{v.title}</p>
                            {v.artist && (
                              <p className="text-[13px] text-white/50 truncate">{v.artist}</p>
                            )}
                          </div>
                          {loading ? (
                            <Loader2 className="w-4 h-4 shrink-0 animate-spin text-primary" />
                          ) : (
                            <span className="shrink-0 inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary/80 group-hover:text-primary">
                              Usar esta <ChevronRight className="w-4 h-4" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Rede de segurança: ajustar o nome e buscar de novo */}
              {cifraStatus !== "transcribing" && cifraStatus !== "searching" && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    {cifraStatus === "done"
                      ? "Não é essa música? Ajuste o nome e detecte de novo"
                      : "Ajuste o nome da música e tente de novo"}
                  </label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      value={cifraQuery}
                      onChange={(e) => setCifraQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void handleFetchCifraByName();
                        }
                      }}
                      placeholder="Ex.: Gabriela Rocha - Atos 2"
                      className="flex-1 bg-secondary/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    />
                    <button
                      onClick={handleFetchCifraByName}
                      disabled={cifraQuery.trim().length === 0}
                      className={cn(
                        "inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm transition-all shrink-0",
                        cifraQuery.trim().length === 0
                          ? "bg-white/5 text-white/30 cursor-not-allowed"
                          : "bg-primary text-primary-foreground hover:bg-primary/90",
                      )}
                    >
                      <Sparkles className="w-4 h-4" /> Detectar cifra
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ── Cifra exibida ────────────────────────────────────────────── */}
            <AnimatePresence>
              {chartReady && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="glass-card rounded-3xl border border-white/10 p-6"
                >
                  <p className="text-[12px] text-muted-foreground/70 mb-4">
                    Você pode ajustar o que quiser antes de usar.
                  </p>

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
                    <ChordSheet text={chart} />
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

            {/* ── Estúdio de áudio: sem voz / voz em destaque ───────────────── */}
            {(inputMode === "upload" || inputMode === "search") && (
              <div className="glass-card rounded-3xl border border-white/10 p-6">
                <div className="flex items-center gap-2 mb-1">
                  <Headphones className="w-4 h-4 text-primary" />
                  <h3 className="font-display font-bold text-white text-base">Estúdio de áudio</h3>
                </div>
                <p className="text-[12px] text-muted-foreground/70 mb-4">
                  Gere uma versão da música <strong className="text-white/80">sem a voz</strong>{" "}
                  (para cantar/tocar por cima) ou com a{" "}
                  <strong className="text-white/80">voz em destaque</strong>. É um efeito feito no
                  seu navegador — funciona melhor em gravações de estúdio em estéreo e não fica
                  perfeito como uma separação profissional.
                </p>

                <input
                  ref={studioInputRef}
                  type="file"
                  accept={ACCEPT}
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) loadStudioFile(f);
                    e.target.value = "";
                  }}
                />

                {inputMode === "search" && !stemFileName ? (
                  <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-5 text-center">
                    <p className="text-sm text-white/70 mb-1">
                      Para criar a versão sem voz ou destacar o vocal, envie o arquivo de áudio
                      desta música.
                    </p>
                    <p className="text-[12px] text-muted-foreground/60 mb-4">
                      O som do player não pode ser editado — o estúdio trabalha no arquivo que você
                      enviar.
                    </p>
                    <button
                      onClick={() => studioInputRef.current?.click()}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
                    >
                      <UploadCloud className="w-4 h-4" /> Enviar áudio (MP3, WAV)
                    </button>
                    {stemError && (
                      <div className="mt-4 flex items-start gap-2 text-left text-sm text-amber-200/90 bg-amber-500/10 border border-amber-500/25 rounded-xl px-4 py-3">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{stemError}</span>
                      </div>
                    )}
                  </div>
                ) : (
                <>
                {stemFileName && (
                  <div className="flex items-center gap-2 mb-3 text-[12px] text-white/50">
                    <FileAudio className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="truncate">{stemFileName}</span>
                  </div>
                )}
                <div className="grid sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => generateStem("instrumental")}
                    disabled={stemBusy}
                    className={cn(
                      "flex items-center gap-3 text-left rounded-2xl border px-4 py-3 transition-all",
                      stemBusy
                        ? "border-white/5 bg-white/[0.02] opacity-60 cursor-not-allowed"
                        : "border-white/10 bg-secondary/40 hover:border-primary/50 hover:bg-primary/[0.06]",
                    )}
                  >
                    <Music className="w-5 h-5 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="font-semibold text-white text-sm">Sem voz (instrumental)</p>
                      <p className="text-[12px] text-white/50">Modo karaokê</p>
                    </div>
                    {stemBusy && stemKind === "instrumental" && (
                      <Loader2 className="w-4 h-4 ml-auto shrink-0 animate-spin text-primary" />
                    )}
                  </button>

                  <button
                    onClick={() => generateStem("vocals")}
                    disabled={stemBusy}
                    className={cn(
                      "flex items-center gap-3 text-left rounded-2xl border px-4 py-3 transition-all",
                      stemBusy
                        ? "border-white/5 bg-white/[0.02] opacity-60 cursor-not-allowed"
                        : "border-white/10 bg-secondary/40 hover:border-primary/50 hover:bg-primary/[0.06]",
                    )}
                  >
                    <Mic className="w-5 h-5 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="font-semibold text-white text-sm">Voz em destaque</p>
                      <p className="text-[12px] text-white/50">Realça o vocal</p>
                    </div>
                    {stemBusy && stemKind === "vocals" && (
                      <Loader2 className="w-4 h-4 ml-auto shrink-0 animate-spin text-primary" />
                    )}
                  </button>
                </div>

                {stemBusy && stemKind === "vocals" && (
                  <div className="mt-4">
                    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${Math.round(stemProgress * 100)}%` }}
                      />
                    </div>
                    <p className="text-[12px] text-white/50 mt-2">
                      Processando o áudio… {Math.round(stemProgress * 100)}%
                    </p>
                  </div>
                )}

                {stemError && (
                  <div className="mt-4 flex items-start gap-2 text-sm text-amber-200/90 bg-amber-500/10 border border-amber-500/25 rounded-xl px-4 py-3">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{stemError}</span>
                  </div>
                )}

                {stemUrl && !stemBusy && (
                  <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 p-4">
                    <p className="text-sm font-semibold text-white/90 mb-3">
                      {stemKind === "instrumental"
                        ? "Versão sem voz pronta"
                        : "Voz em destaque pronta"}
                    </p>
                    <audio src={stemUrl} controls className="w-full" />
                    <a
                      href={stemUrl}
                      download={`harmonic-${
                        stemKind === "instrumental" ? "instrumental" : "voz"
                      }.wav`}
                      className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
                    >
                      <Download className="w-4 h-4" /> Baixar (WAV)
                    </a>
                  </div>
                )}
                </>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function RecordingPanel({
  seconds,
  onStop,
  onCancel,
}: {
  seconds: number;
  onStop: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="glass-card rounded-3xl border border-primary/30 bg-primary/5 p-10 text-center flex flex-col items-center">
      <div className="relative mb-5">
        <span className="absolute inset-0 rounded-full bg-rose-500/30 animate-ping" />
        <div className="relative w-16 h-16 rounded-full bg-rose-500/20 border border-rose-400/40 flex items-center justify-center text-rose-300">
          <Mic className="w-8 h-8" />
        </div>
      </div>
      <p className="font-display text-xl font-bold text-white mb-1">Gravando…</p>
      <p className="text-sm text-muted-foreground mb-1">
        Cante o trecho da música com clareza.
      </p>
      <p className="font-mono text-2xl text-white tabular-nums mb-6">
        {formatClock(seconds)}{" "}
        <span className="text-sm text-muted-foreground/60">/ {formatClock(MAX_RECORD_SECONDS)}</span>
      </p>
      <div className="flex flex-wrap gap-3 justify-center">
        <button
          onClick={onStop}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold text-white bg-primary hover:bg-primary/90 transition-all"
        >
          <Square className="w-4 h-4" /> Parar e identificar
        </button>
        <button
          onClick={onCancel}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl font-medium text-white/70 border border-white/10 hover:bg-white/5 hover:text-white transition-all"
        >
          Cancelar
        </button>
      </div>
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
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-xl font-bold text-white leading-none">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground/70 mt-1.5 truncate">{hint}</p>}
    </div>
  );
}
