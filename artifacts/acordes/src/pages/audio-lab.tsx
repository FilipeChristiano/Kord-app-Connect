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
  Play,
  Pause,
  Volume2,
  Minus,
  Plus,
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
  fetchYoutubeAudio,
  pickCifra,
  prepareStemsYoutube,
  prepareStemsUpload,
  pollStemsStatus,
  stemsFileUrl,
  type FetchedCifra,
  type CifraCandidate,
} from "@/lib/cifra-remote";
import {
  fileToAudioBuffer,
  makeInstrumentalViaWorker,
  emphasizeVocalsViaWorker,
  encodeWav,
  MonoSourceError,
} from "@/lib/audio-stems";
import { LiveStudioPlayer } from "@/lib/audio-live";
import {
  classifyLine,
  transposeChart,
  parseKeyName,
  keyName,
  keyOptions,
  preferFlatsForKey,
  detectKeyFromChart,
} from "@/lib/chord-transpose";
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

// A classificação de linhas e a transposição vivem em "@/lib/chord-transpose"
// para que a renderização da cifra e a mudança de tom usem a mesma lógica.

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

  // ── Mudar o tom (transposição) ─────────────────────────────────────────────
  // `transpose` é o deslocamento em semitons sobre o tom-base da cifra exibida.
  // `baseKeyName` é o tom da cifra quando transpose = 0 (vem do tom marcado na
  // cifra ou, quando ausente, é detectado pelos próprios acordes).
  const [transpose, setTranspose] = useState(0);
  const [baseKeyName, setBaseKeyName] = useState<string | null>(null);

  // Estúdio de áudio
  const [stemFileName, setStemFileName] = useState(""); // áudio carregado para o estúdio

  // ── "Sem voz" AO VIVO (cancelamento de centro em tempo real) ───────────────
  const [liveStarted, setLiveStarted] = useState(false); // já começou a tocar
  const [liveLoading, setLiveLoading] = useState(false); // preparando o áudio para tocar
  const [liveActive, setLiveActive] = useState(true); // efeito "sem voz" ligado
  const [liveError, setLiveError] = useState("");
  const liveAudioRef = useRef<HTMLAudioElement | null>(null);
  const livePlayerRef = useRef<LiveStudioPlayer | null>(null);
  const liveBlobUrlRef = useRef<string | null>(null); // blob do arquivo enviado (revogar)

  // ── "Voz em destaque" (STFT pesado, fora da thread principal) ──────────────
  const [vocalsBusy, setVocalsBusy] = useState(false);
  const [vocalsFetching, setVocalsFetching] = useState(false); // baixando o áudio do YouTube
  const [vocalsProgress, setVocalsProgress] = useState(0);
  const [vocalsUrl, setVocalsUrl] = useState<string | null>(null);
  const [vocalsError, setVocalsError] = useState("");
  const vocalsUrlRef = useRef<string | null>(null);
  const stemRunIdRef = useRef(0);
  const vocalsCancelRef = useRef<(() => void) | null>(null);

  // ── Download do "sem voz" (gerado offline sob demanda) ─────────────────────
  const [instDownloadBusy, setInstDownloadBusy] = useState(false);

  // ── Máxima qualidade: separação completa no servidor (gera as duas faixas) ──
  const [studioQuality, setStudioQuality] = useState<"fast" | "max">("fast");
  const [hqStatus, setHqStatus] = useState<"idle" | "preparing" | "ready" | "error">("idle");
  const [hqKey, setHqKey] = useState<string | null>(null);
  const [hqError, setHqError] = useState("");
  const hqPollTimerRef = useRef<number | null>(null);

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
      vocalsCancelRef.current?.();
      vocalsCancelRef.current = null;
      if (vocalsUrlRef.current) {
        URL.revokeObjectURL(vocalsUrlRef.current);
        vocalsUrlRef.current = null;
      }
      if (hqPollTimerRef.current !== null) {
        clearTimeout(hqPollTimerRef.current);
        hqPollTimerRef.current = null;
      }
      livePlayerRef.current?.dispose();
      livePlayerRef.current = null;
      if (liveBlobUrlRef.current) {
        URL.revokeObjectURL(liveBlobUrlRef.current);
        liveBlobUrlRef.current = null;
      }
      stopStream();
    };
  }, [stopStream]);

  // Limpa qualquer resultado do estúdio de áudio (ao recomeçar/enviar outro áudio).
  const clearStems = useCallback(() => {
    stemRunIdRef.current++;
    vocalsCancelRef.current?.();
    vocalsCancelRef.current = null;
    if (vocalsUrlRef.current) {
      URL.revokeObjectURL(vocalsUrlRef.current);
      vocalsUrlRef.current = null;
    }
    // Não descartamos o LiveStudioPlayer: o nó MediaElementSource só pode ser
    // criado uma vez por elemento <audio>; recriá-lo no mesmo elemento lança erro.
    // Apenas paramos e limpamos a fonte para que o próximo "Ouvir" resolva um
    // áudio novo. O player é descartado de fato só ao desmontar a tela.
    const liveEl = liveAudioRef.current;
    if (liveEl) {
      try {
        liveEl.pause();
      } catch {
        // ignore
      }
      liveEl.removeAttribute("src");
      try {
        liveEl.load();
      } catch {
        // ignore
      }
    }
    if (liveBlobUrlRef.current) {
      URL.revokeObjectURL(liveBlobUrlRef.current);
      liveBlobUrlRef.current = null;
    }
    setStemFileName("");
    setLiveStarted(false);
    setLiveLoading(false);
    setLiveActive(true);
    setLiveError("");
    setVocalsBusy(false);
    setVocalsFetching(false);
    setVocalsProgress(0);
    setVocalsUrl(null);
    setVocalsError("");
    setInstDownloadBusy(false);
    if (hqPollTimerRef.current !== null) {
      clearTimeout(hqPollTimerRef.current);
      hqPollTimerRef.current = null;
    }
    setHqStatus("idle");
    setHqKey(null);
    setHqError("");
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
    setTranspose(0);
    setBaseKeyName(null);
    clearStems();
    audioFileRef.current = null;
    setStep("lendo");
  }, [stopStream, clearStems]);

  // Define a fonte de áudio (URL) para o player ao vivo, sem baixar o arquivo
  // inteiro: arquivo enviado vira um blob; no modo pesquisa, tocamos em streaming
  // direto do servidor (que extrai o áudio do YouTube).
  const resolveLiveSrc = useCallback((): string | null => {
    if (liveBlobUrlRef.current) return liveBlobUrlRef.current;
    if (audioFileRef.current) {
      const url = URL.createObjectURL(audioFileRef.current);
      liveBlobUrlRef.current = url;
      return url;
    }
    const ytId = cifraMeta?.youtubeId;
    if (inputMode === "search" && ytId) {
      return `/api/yt-audio?id=${encodeURIComponent(ytId)}`;
    }
    return null;
  }, [inputMode, cifraMeta]);

  // ── "Sem voz" AO VIVO: começa a tocar com o cancelamento de centro ligado ──
  // O efeito é aplicado em tempo real (nós nativos do Web Audio), então começa
  // quase instantâneo e não pesa no aparelho.
  const startLive = useCallback(async () => {
    const el = liveAudioRef.current;
    if (!el) return;
    setLiveError("");

    if (!el.getAttribute("src")) {
      const src = resolveLiveSrc();
      if (!src) {
        setLiveError("Envie o arquivo de áudio da música para usar o estúdio.");
        return;
      }
      if (inputMode === "search" && !audioFileRef.current) {
        setStemFileName(
          cifraMeta?.title ? `${cifraMeta.title} — áudio do YouTube` : "Áudio do YouTube",
        );
      }
      setLiveLoading(true);
      el.src = src;
    }
    setLiveStarted(true);

    try {
      // O elemento <audio> pode ser remontado (troca de tela/estado). Como o nó
      // MediaElementSource fica preso ao elemento original, recriamos o player só
      // quando o elemento muda; caso contrário reaproveitamos o mesmo.
      if (livePlayerRef.current && livePlayerRef.current.element !== el) {
        livePlayerRef.current.dispose();
        livePlayerRef.current = null;
      }
      if (!livePlayerRef.current) livePlayerRef.current = new LiveStudioPlayer(el);
      await livePlayerRef.current.resume();
      await livePlayerRef.current.setMode(liveActive ? "instrumental" : "original");
      await el.play();
    } catch {
      // A reprodução pode ser bloqueada até o áudio carregar; os controles
      // nativos (play) seguem disponíveis para o usuário tentar de novo.
    }
  }, [resolveLiveSrc, inputMode, cifraMeta, liveActive]);

  // Liga/desliga o efeito "sem voz" durante a reprodução (instantâneo).
  const toggleLive = useCallback(async () => {
    const next = !liveActive;
    setLiveActive(next);
    if (livePlayerRef.current) {
      await livePlayerRef.current.setMode(next ? "instrumental" : "original");
    }
  }, [liveActive]);

  // ── "Voz em destaque": processa fora da thread principal (Web Worker) ──────
  // O áudio é decodificado aqui e o cálculo pesado (STFT) roda no Worker, então
  // a interface não trava. No modo pesquisa, baixamos o áudio do YouTube antes.
  const prepareVocals = useCallback(async () => {
    if (vocalsBusy || vocalsFetching) return;
    const runId = ++stemRunIdRef.current;
    setVocalsError("");

    let file = audioFileRef.current;
    if (!file) {
      const ytId = cifraMeta?.youtubeId;
      if (inputMode === "search" && ytId) {
        setVocalsFetching(true);
        try {
          const res = await fetchYoutubeAudio(ytId);
          if (stemRunIdRef.current !== runId) return;
          if (!res.ok) {
            setVocalsError(
              res.reason === "unauthorized"
                ? "Sua sessão expirou. Atualize a página e entre novamente."
                : "Não consegui obter o áudio dessa música agora. Você pode enviar o arquivo manualmente.",
            );
            return;
          }
          file = new File([res.blob], "audio.mp3", { type: "audio/mpeg" });
          audioFileRef.current = file;
          setStemFileName(
            cifraMeta?.title ? `${cifraMeta.title} — áudio do YouTube` : "Áudio do YouTube",
          );
        } finally {
          if (stemRunIdRef.current === runId) setVocalsFetching(false);
        }
      } else {
        setVocalsError("Envie o arquivo de áudio da música para usar o estúdio.");
        return;
      }
    }
    if (!file || stemRunIdRef.current !== runId) return;

    setVocalsBusy(true);
    setVocalsProgress(0);
    if (vocalsUrlRef.current) {
      URL.revokeObjectURL(vocalsUrlRef.current);
      vocalsUrlRef.current = null;
      setVocalsUrl(null);
    }
    try {
      const buffer = await fileToAudioBuffer(file);
      if (stemRunIdRef.current !== runId) return;
      const { promise, cancel } = emphasizeVocalsViaWorker(buffer, (p) => {
        if (stemRunIdRef.current === runId) setVocalsProgress(p);
      });
      vocalsCancelRef.current = cancel;
      const stem = await promise;
      vocalsCancelRef.current = null;
      // Outro run começou (reset/novo áudio/desmontagem): descarta este resultado.
      if (stemRunIdRef.current !== runId) return;
      const blob = encodeWav(stem);
      const url = URL.createObjectURL(blob);
      vocalsUrlRef.current = url;
      setVocalsUrl(url);
    } catch (err) {
      vocalsCancelRef.current = null;
      if (stemRunIdRef.current !== runId) return;
      setVocalsUrl(null);
      setVocalsError(
        err instanceof MonoSourceError
          ? "Esse áudio é mono (um canal só), então não dá para separar a voz. Envie a faixa estéreo original da música."
          : "Não consegui processar esse áudio agora. Tente enviar a música em MP3 ou WAV.",
      );
    } finally {
      if (stemRunIdRef.current === runId) setVocalsBusy(false);
    }
  }, [vocalsBusy, vocalsFetching, inputMode, cifraMeta]);

  // ── Máxima qualidade: prepara as DUAS faixas no servidor (voz + sem voz) ────
  // Uma única preparação gera tudo. É mais lenta (alguns minutos), então o app
  // pede a preparação, acompanha o status e libera as faixas quando prontas.
  const prepareHq = useCallback(async () => {
    if (hqStatus === "preparing") return;
    const runId = ++stemRunIdRef.current;
    setHqError("");
    setHqStatus("preparing");

    // Descobre a fonte: arquivo enviado tem prioridade; senão, vídeo da pesquisa.
    let outcome: Awaited<ReturnType<typeof prepareStemsYoutube>>;
    const file = audioFileRef.current;
    if (file) {
      outcome = await prepareStemsUpload(file);
    } else {
      const ytId = cifraMeta?.youtubeId;
      if (inputMode === "search" && ytId) {
        if (!stemFileName) {
          setStemFileName(
            cifraMeta?.title ? `${cifraMeta.title} — áudio do YouTube` : "Áudio do YouTube",
          );
        }
        outcome = await prepareStemsYoutube(ytId);
      } else {
        setHqStatus("error");
        setHqError("Envie o arquivo de áudio da música para usar a máxima qualidade.");
        return;
      }
    }
    if (stemRunIdRef.current !== runId) return;

    if (!outcome.ok) {
      setHqStatus("error");
      setHqError(
        outcome.reason === "unauthorized"
          ? "Sua sessão expirou. Atualize a página e entre novamente."
          : "Não consegui preparar a máxima qualidade agora. Tente novamente em instantes.",
      );
      return;
    }

    const key = outcome.key;
    setHqKey(key);
    if (outcome.status === "ready") {
      setHqStatus("ready");
      return;
    }

    // Acompanha o status até concluir. A separação completa pode levar alguns
    // minutos; consultamos a cada 3s com um teto generoso (~12 min).
    const startedAt = Date.now();
    const MAX_WAIT_MS = 12 * 60 * 1000;
    const tick = async () => {
      if (stemRunIdRef.current !== runId) return;
      const status = await pollStemsStatus(key);
      if (stemRunIdRef.current !== runId) return;
      if (status === "ready") {
        setHqStatus("ready");
        return;
      }
      if (status === "error") {
        setHqStatus("error");
        setHqError("Não consegui preparar a máxima qualidade dessa música. Tente outra vez.");
        return;
      }
      if (Date.now() - startedAt > MAX_WAIT_MS) {
        setHqStatus("error");
        setHqError("A preparação está demorando mais que o esperado. Tente novamente.");
        return;
      }
      hqPollTimerRef.current = window.setTimeout(() => void tick(), 3000);
    };
    hqPollTimerRef.current = window.setTimeout(() => void tick(), 3000);
  }, [hqStatus, inputMode, cifraMeta, stemFileName]);

  // ── Baixar a versão "sem voz" (gerada offline sob demanda) ─────────────────
  // O efeito ao vivo não gera arquivo; quando o usuário quer baixar, calculamos
  // o instrumental no momento e disparamos o download (WAV).
  const downloadInstrumental = useCallback(async () => {
    if (instDownloadBusy) return;
    setLiveError("");

    let file = audioFileRef.current;
    if (!file) {
      const ytId = cifraMeta?.youtubeId;
      if (inputMode === "search" && ytId) {
        setInstDownloadBusy(true);
        try {
          const res = await fetchYoutubeAudio(ytId);
          if (!res.ok) {
            setLiveError(
              res.reason === "unauthorized"
                ? "Sua sessão expirou. Atualize a página e entre novamente."
                : "Não consegui obter o áudio dessa música agora. Você pode enviar o arquivo manualmente.",
            );
            return;
          }
          file = new File([res.blob], "audio.mp3", { type: "audio/mpeg" });
          audioFileRef.current = file;
        } finally {
          setInstDownloadBusy(false);
        }
      } else {
        setLiveError("Envie o arquivo de áudio da música para baixar a versão sem voz.");
        return;
      }
    }
    if (!file) return;

    setInstDownloadBusy(true);
    try {
      const buffer = await fileToAudioBuffer(file);
      const stem = await makeInstrumentalViaWorker(buffer).promise;
      const blob = encodeWav(stem);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "harmonic-instrumental.wav";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (err) {
      setLiveError(
        err instanceof MonoSourceError
          ? "Esse áudio é mono (um canal só), então não dá para separar a voz. Envie a faixa estéreo original da música."
          : "Não consegui gerar o arquivo agora. Tente enviar a música em MP3 ou WAV.",
      );
    } finally {
      setInstDownloadBusy(false);
    }
  }, [instDownloadBusy, inputMode, cifraMeta]);

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
    setTranspose(0);
    setBaseKeyName(out.cifra.key ?? detectKeyFromChart(out.cifra.body));
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
    setTranspose(0);
    setBaseKeyName(out.cifra.key ?? detectKeyFromChart(out.cifra.body));
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
        setLiveError("Envie um arquivo MP3, WAV ou M4A.");
        return;
      }
      if (file.size > MAX_SIZE) {
        setLiveError("Esse arquivo é muito grande. Tente enviar um áudio menor (até 50MB).");
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
    setTranspose(0);
    setBaseKeyName(out.cifra.key ?? detectKeyFromChart(out.cifra.body));
    setCopied(false);
    setCifraQuery(
      out.cifra.artist ? `${out.cifra.artist} - ${out.cifra.title}` : out.cifra.title,
    );
    setCifraStatus("done");
  }, [pickingId]);

  // ── Transposição: valores derivados ────────────────────────────────────────
  const baseKeyParsed = useMemo(() => parseKeyName(baseKeyName), [baseKeyName]);
  // Grafia (sustenidos/bemóis) que combina com o tom atual depois de transpor.
  const transposePreferFlats = baseKeyParsed
    ? preferFlatsForKey(baseKeyParsed.pc + transpose, baseKeyParsed.isMinor)
    : transpose < 0; // sem tom conhecido: descer tende a bemóis, subir a sustenidos
  // Tom atual (após transpor) para mostrar no selo.
  const currentKeyName = baseKeyParsed
    ? keyName(baseKeyParsed.pc + transpose, baseKeyParsed.isMinor)
    : null;
  // Cifra como deve aparecer/ser copiada (já no tom escolhido).
  const displayChart = useMemo(
    () => transposeChart(chart, transpose, transposePreferFlats),
    [chart, transpose, transposePreferFlats],
  );
  // Opções do seletor "tom específico" (12 tons no mesmo modo do tom-base).
  const keySelectOptions = useMemo(
    () => (baseKeyParsed ? keyOptions(baseKeyParsed.isMinor) : []),
    [baseKeyParsed],
  );
  const currentKeyPc = baseKeyParsed
    ? (((baseKeyParsed.pc + transpose) % 12) + 12) % 12
    : null;

  const stepSemitone = useCallback((delta: number) => {
    setTranspose((t) => t + delta);
  }, []);

  // Selecionar um tom específico: ajusta o deslocamento para chegar nele.
  const selectKeyPc = useCallback(
    (targetPc: number) => {
      if (!baseKeyParsed) return;
      const diff = (((targetPc - baseKeyParsed.pc) % 12) + 12) % 12;
      setTranspose(diff);
    },
    [baseKeyParsed],
  );

  // Entrar em edição com o tom mudado: fixa o tom atual no texto para que o
  // usuário edite exatamente o que vê (e a base passa a ser o tom atual).
  const toggleEditChart = useCallback(() => {
    setEditingChart((v) => {
      const next = !v;
      if (next && transpose !== 0) {
        setChart(displayChart);
        if (currentKeyName) setBaseKeyName(currentKeyName);
        setTranspose(0);
      }
      return next;
    });
  }, [transpose, displayChart, currentKeyName]);

  const copyChart = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(displayChart);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard indisponível — ignora
    }
  }, [displayChart]);

  const sendChartToSofisticador = useCallback(() => {
    try {
      sessionStorage.setItem(SOFISTICADOR_PREFILL_KEY, displayChart);
    } catch {
      // sessionStorage indisponível — segue mesmo assim
    }
    navigate("/sofisticador");
  }, [displayChart, navigate]);

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
                    {currentKeyName && (
                      <span className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary">
                        <Music2 className="w-3.5 h-3.5" /> Tom {currentKeyName}
                        {transpose !== 0 && (
                          <span className="text-primary/60">
                            ({transpose > 0 ? "+" : ""}
                            {transpose})
                          </span>
                        )}
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

                  {/* ── Mudar o tom ──────────────────────────────────────── */}
                  {!editingChart && (
                    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-secondary/30 px-3 py-2.5">
                      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/80 mr-1">
                        <Music2 className="w-4 h-4 text-primary" /> Mudar o tom
                      </span>
                      <button
                        onClick={() => stepSemitone(-1)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium border border-white/10 text-white/80 hover:border-primary/50 hover:bg-primary/[0.06] transition-all"
                        title="Descer meio tom"
                      >
                        <Minus className="w-3.5 h-3.5" /> Descer ½ tom
                      </button>
                      <button
                        onClick={() => stepSemitone(1)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium border border-white/10 text-white/80 hover:border-primary/50 hover:bg-primary/[0.06] transition-all"
                        title="Subir meio tom"
                      >
                        <Plus className="w-3.5 h-3.5" /> Subir ½ tom
                      </button>

                      {currentKeyName ? (
                        <span className="inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary">
                          {currentKeyName}
                          {transpose !== 0 && (
                            <span className="text-primary/60">
                              ({transpose > 0 ? "+" : ""}
                              {transpose})
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm font-medium text-white/50">
                          Tom não detectado
                          {transpose !== 0 && (
                            <span>
                              ({transpose > 0 ? "+" : ""}
                              {transpose})
                            </span>
                          )}
                        </span>
                      )}

                      {keySelectOptions.length > 0 && currentKeyPc !== null && (
                        <label className="inline-flex items-center gap-1.5 text-sm text-white/60">
                          <span className="hidden sm:inline">Tom específico:</span>
                          <select
                            value={currentKeyPc}
                            onChange={(e) => selectKeyPc(Number(e.target.value))}
                            className="bg-secondary/60 border border-white/10 rounded-xl px-2.5 py-1.5 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-primary"
                          >
                            {keySelectOptions.map((o) => (
                              <option key={o.pc} value={o.pc}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}

                      {transpose !== 0 && (
                        <button
                          onClick={() => setTranspose(0)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 transition-all"
                          title="Voltar ao tom original"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Original
                        </button>
                      )}
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
                    <ChordSheet text={displayChart} />
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={toggleEditChart}
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
                  Ouça a música <strong className="text-white/80">sem a voz</strong> na hora (para
                  cantar/tocar por cima) ou realce a{" "}
                  <strong className="text-white/80">voz em destaque</strong>. É um efeito do próprio
                  app — funciona melhor em gravações de estúdio em estéreo e não fica perfeito como
                  uma separação profissional.
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

                {inputMode === "search" && !stemFileName && !cifraMeta?.youtubeId ? (
                  <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-5 text-center">
                    <p className="text-sm text-white/70 mb-1">
                      Para ouvir a versão sem voz ou destacar o vocal, envie o arquivo de áudio
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
                    {liveError && (
                      <div className="mt-4 flex items-start gap-2 text-left text-sm text-amber-200/90 bg-amber-500/10 border border-amber-500/25 rounded-xl px-4 py-3">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{liveError}</span>
                      </div>
                    )}
                  </div>
                ) : (
                <>
                {stemFileName ? (
                  <div className="flex items-center gap-2 mb-3 text-[12px] text-white/50">
                    <FileAudio className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="truncate">{stemFileName}</span>
                  </div>
                ) : (
                  inputMode === "search" && (
                    <p className="text-[12px] text-muted-foreground/70 mb-3">
                      Vamos usar o áudio desta música do YouTube — é só escolher uma opção abaixo.{" "}
                      <button
                        onClick={() => studioInputRef.current?.click()}
                        className="text-primary/90 hover:text-primary underline underline-offset-2"
                      >
                        ou envie seu próprio arquivo
                      </button>
                    </p>
                  )
                )}

                {/* ── Qualidade da separação (escolha por música) ─────────── */}
                <div className="mb-3 rounded-2xl border border-white/10 bg-secondary/40 p-3">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-semibold text-white/80">Qualidade</p>
                      <p className="text-[11px] text-white/45">
                        {studioQuality === "fast"
                          ? "Rápido — toca na hora, direto no seu aparelho"
                          : "Máxima qualidade — separa muito melhor, leva alguns minutos"}
                      </p>
                    </div>
                    <div className="inline-flex rounded-xl border border-white/10 bg-white/[0.03] p-1 shrink-0">
                      <button
                        onClick={() => setStudioQuality("fast")}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all",
                          studioQuality === "fast"
                            ? "bg-primary text-primary-foreground"
                            : "text-white/60 hover:text-white",
                        )}
                      >
                        Rápido
                      </button>
                      <button
                        onClick={() => setStudioQuality("max")}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all",
                          studioQuality === "max"
                            ? "bg-primary text-primary-foreground"
                            : "text-white/60 hover:text-white",
                        )}
                      >
                        Máxima
                      </button>
                    </div>
                  </div>
                </div>

                {studioQuality === "fast" && (
                <>
                {/* ── Sem voz AO VIVO ─────────────────────────────────────── */}
                <div className="rounded-2xl border border-white/10 bg-secondary/40 p-4">
                  <div className="flex items-center gap-3">
                    <Music className="w-5 h-5 text-primary shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-white text-sm">Sem voz (ao vivo)</p>
                      <p className="text-[12px] text-white/50">
                        Modo karaokê — toca na hora, sem espera
                      </p>
                    </div>
                    {!liveStarted && (
                      <button
                        onClick={() => void startLive()}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shrink-0"
                      >
                        <Play className="w-4 h-4" /> Ouvir
                      </button>
                    )}
                  </div>

                  {/* O elemento de áudio fica sempre montado para o player ao
                      vivo funcionar; só aparece depois que o usuário inicia. */}
                  <div className={cn("mt-3", liveStarted ? "block" : "hidden")}>
                    {liveLoading && (
                      <div className="mb-3 flex items-center gap-2 text-[12px] text-white/60">
                        <Loader2 className="w-4 h-4 shrink-0 animate-spin text-primary" />
                        Preparando o áudio…
                      </div>
                    )}
                    <audio
                      ref={liveAudioRef}
                      controls
                      className="w-full"
                      onCanPlay={() => setLiveLoading(false)}
                      onPlaying={() => setLiveLoading(false)}
                      onError={() => {
                        setLiveLoading(false);
                        setLiveError(
                          "Não consegui tocar o áudio dessa música agora. Você pode enviar o arquivo manualmente.",
                        );
                      }}
                    />
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <button
                        onClick={() => void toggleLive()}
                        role="switch"
                        aria-checked={liveActive}
                        className={cn(
                          "inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all border",
                          liveActive
                            ? "bg-primary/15 border-primary/40 text-primary"
                            : "bg-white/[0.03] border-white/10 text-white/60 hover:text-white",
                        )}
                      >
                        <span
                          className={cn(
                            "relative inline-block w-9 h-5 rounded-full transition-colors",
                            liveActive ? "bg-primary" : "bg-white/20",
                          )}
                        >
                          <span
                            className={cn(
                              "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform",
                              liveActive && "translate-x-4",
                            )}
                          />
                        </span>
                        Sem voz {liveActive ? "ligado" : "desligado"}
                      </button>
                      <button
                        onClick={() => void downloadInstrumental()}
                        disabled={instDownloadBusy}
                        className={cn(
                          "inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium border transition-all",
                          instDownloadBusy
                            ? "border-white/5 text-white/40 cursor-not-allowed"
                            : "border-white/10 text-white/70 hover:text-white hover:bg-white/5",
                        )}
                      >
                        {instDownloadBusy ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                        Baixar (WAV)
                      </button>
                    </div>
                  </div>

                  {liveError && (
                    <div className="mt-3 flex items-start gap-2 text-sm text-amber-200/90 bg-amber-500/10 border border-amber-500/25 rounded-xl px-4 py-3">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{liveError}</span>
                    </div>
                  )}
                </div>

                {/* ── Voz em destaque (processada fora da thread principal) ── */}
                <div className="mt-3 rounded-2xl border border-white/10 bg-secondary/40 p-4">
                  <div className="flex items-center gap-3">
                    <Mic className="w-5 h-5 text-primary shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-white text-sm">Voz em destaque</p>
                      <p className="text-[12px] text-white/50">
                        Realça o vocal — processa sem travar seu aparelho
                      </p>
                    </div>
                    {!vocalsUrl && (
                      <button
                        onClick={() => void prepareVocals()}
                        disabled={vocalsBusy || vocalsFetching}
                        className={cn(
                          "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all shrink-0",
                          vocalsBusy || vocalsFetching
                            ? "bg-white/[0.04] text-white/40 cursor-not-allowed"
                            : "bg-primary text-primary-foreground hover:bg-primary/90",
                        )}
                      >
                        {vocalsBusy || vocalsFetching ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Sparkles className="w-4 h-4" />
                        )}
                        Preparar
                      </button>
                    )}
                  </div>

                  {vocalsFetching && (
                    <div className="mt-3 flex items-center gap-2 text-[12px] text-white/60">
                      <Loader2 className="w-4 h-4 shrink-0 animate-spin text-primary" />
                      Baixando o áudio da música do YouTube…
                    </div>
                  )}

                  {vocalsBusy && (
                    <div className="mt-3">
                      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${Math.round(vocalsProgress * 100)}%` }}
                        />
                      </div>
                      <p className="text-[12px] text-white/50 mt-2">
                        Preparando a voz em destaque… {Math.round(vocalsProgress * 100)}%
                      </p>
                    </div>
                  )}

                  {vocalsError && (
                    <div className="mt-3 flex items-start gap-2 text-sm text-amber-200/90 bg-amber-500/10 border border-amber-500/25 rounded-xl px-4 py-3">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{vocalsError}</span>
                    </div>
                  )}

                  {vocalsUrl && !vocalsBusy && (
                    <div className="mt-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
                      <p className="text-sm font-semibold text-white/90 mb-3">
                        Voz em destaque pronta
                      </p>
                      <audio src={vocalsUrl} controls className="w-full" />
                      <a
                        href={vocalsUrl}
                        download="harmonic-voz.wav"
                        className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
                      >
                        <Download className="w-4 h-4" /> Baixar (WAV)
                      </a>
                    </div>
                  )}
                </div>
                </>
                )}

                {/* ── Máxima qualidade: separação completa (voz + sem voz) ──── */}
                {studioQuality === "max" && (
                <div className="rounded-2xl border border-white/10 bg-secondary/40 p-4">
                  <div className="flex items-center gap-3">
                    <Sparkles className="w-5 h-5 text-primary shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-white text-sm">Máxima qualidade</p>
                      <p className="text-[12px] text-white/50">
                        Separa a voz e o instrumental com o máximo de isolamento
                      </p>
                    </div>
                    {hqStatus !== "ready" && (
                      <button
                        onClick={() => void prepareHq()}
                        disabled={hqStatus === "preparing"}
                        className={cn(
                          "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all shrink-0",
                          hqStatus === "preparing"
                            ? "bg-white/[0.04] text-white/40 cursor-not-allowed"
                            : "bg-primary text-primary-foreground hover:bg-primary/90",
                        )}
                      >
                        {hqStatus === "preparing" ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Sparkles className="w-4 h-4" />
                        )}
                        {hqStatus === "preparing" ? "Preparando…" : "Preparar"}
                      </button>
                    )}
                  </div>

                  {hqStatus === "preparing" && (
                    <div className="mt-3 flex items-start gap-2 text-[12px] text-white/60">
                      <Loader2 className="w-4 h-4 shrink-0 animate-spin text-primary mt-0.5" />
                      <span>
                        Preparando a separação de máxima qualidade. Isso pode levar
                        alguns minutos — pode deixar esta tela aberta e voltar daqui a
                        pouco.
                      </span>
                    </div>
                  )}

                  {hqError && (
                    <div className="mt-3 flex items-start gap-2 text-sm text-amber-200/90 bg-amber-500/10 border border-amber-500/25 rounded-xl px-4 py-3">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{hqError}</span>
                    </div>
                  )}

                  {hqStatus === "ready" && hqKey && (
                    <div className="mt-3 space-y-3">
                      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <Headphones className="w-4 h-4 text-primary shrink-0" />
                          <p className="text-sm font-semibold text-white/90">Mesa de mistura</p>
                        </div>
                        <p className="text-[11px] text-white/45 mb-3">
                          Toque a música e ajuste a voz e o instrumental como quiser
                        </p>
                        <StemMixer
                          key={`mixer-${hqKey}`}
                          vocalsUrl={stemsFileUrl(hqKey, "vocals")}
                          instrumentalUrl={stemsFileUrl(hqKey, "instrumental")}
                        />
                      </div>
                    </div>
                  )}
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

// ── Mesa de mistura ───────────────────────────────────────────────────────────
// Toca a voz e o instrumental juntos (streaming, sem baixar/decodificar tudo
// antes) e cada um tem seu próprio controle de volume. O instrumental é o relógio
// mestre; a voz é mantida alinhada com uma correção de sincronia leve.
const SYNC_THRESHOLD = 0.12; // segundos de defasagem antes de re-sincronizar

function StemFader({
  icon: Icon,
  label,
  value,
  onChange,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
      <div className="flex items-center justify-between mb-1.5">
        <span className="inline-flex items-center gap-1.5 text-[12px] text-white/70">
          <Icon className="w-3.5 h-3.5 text-primary" /> {label}
        </span>
        <span className="text-[12px] font-mono text-primary tabular-nums">
          {Math.round(value * 100)}%
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 accent-primary cursor-pointer"
        aria-label={`Quantidade de ${label}`}
      />
    </div>
  );
}

function StemMixer({
  vocalsUrl,
  instrumentalUrl,
}: {
  vocalsUrl: string;
  instrumentalUrl: string;
}) {
  const instRef = useRef<HTMLAudioElement | null>(null);
  const vocalRef = useRef<HTMLAudioElement | null>(null);
  const vocalVolRef = useRef(1);
  const instVolRef = useRef(1);

  const [loadState, setLoadState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [vocalVol, setVocalVol] = useState(1);
  const [instVol, setInstVol] = useState(1);

  // Cria os dois elementos de áudio uma única vez por par de faixas.
  useEffect(() => {
    const inst = new Audio();
    inst.src = instrumentalUrl;
    inst.preload = "auto";
    inst.volume = 1;
    const vocal = new Audio();
    vocal.src = vocalsUrl;
    vocal.preload = "auto";
    vocal.volume = 1;
    instRef.current = inst;
    vocalRef.current = vocal;

    const onMeta = () => setDuration(inst.duration || 0);
    const onTime = () => {
      setPosition(inst.currentTime);
      // Correção de sincronia: mantém a voz alinhada ao instrumental (mestre).
      const v = vocalRef.current;
      if (v && !inst.paused && Math.abs(v.currentTime - inst.currentTime) > SYNC_THRESHOLD) {
        v.currentTime = inst.currentTime;
      }
    };
    const onCanPlay = () => setLoadState((s) => (s === "error" ? s : "ready"));
    const onWaiting = () => setLoadState((s) => (s === "ready" ? "loading" : s));
    const onPlaying = () => setLoadState("ready");
    const onEnded = () => {
      const v = vocalRef.current;
      inst.pause();
      inst.currentTime = 0;
      if (v) {
        v.pause();
        v.currentTime = 0;
      }
      setIsPlaying(false);
      setPosition(0);
    };
    const onError = () => setLoadState("error");

    inst.addEventListener("loadedmetadata", onMeta);
    inst.addEventListener("timeupdate", onTime);
    inst.addEventListener("canplay", onCanPlay);
    inst.addEventListener("waiting", onWaiting);
    inst.addEventListener("playing", onPlaying);
    inst.addEventListener("ended", onEnded);
    inst.addEventListener("error", onError);
    vocal.addEventListener("error", onError);

    return () => {
      inst.removeEventListener("loadedmetadata", onMeta);
      inst.removeEventListener("timeupdate", onTime);
      inst.removeEventListener("canplay", onCanPlay);
      inst.removeEventListener("waiting", onWaiting);
      inst.removeEventListener("playing", onPlaying);
      inst.removeEventListener("ended", onEnded);
      inst.removeEventListener("error", onError);
      vocal.removeEventListener("error", onError);
      inst.pause();
      vocal.pause();
      inst.src = "";
      vocal.src = "";
      inst.load();
      vocal.load();
      instRef.current = null;
      vocalRef.current = null;
    };
  }, [vocalsUrl, instrumentalUrl]);

  const togglePlay = useCallback(async () => {
    const inst = instRef.current;
    const vocal = vocalRef.current;
    if (!inst || !vocal) return;
    if (!inst.paused) {
      inst.pause();
      vocal.pause();
      setIsPlaying(false);
      return;
    }
    setLoadState((s) => (s === "ready" ? s : "loading"));
    vocal.currentTime = inst.currentTime;
    inst.volume = instVolRef.current;
    vocal.volume = vocalVolRef.current;
    try {
      await Promise.all([inst.play(), vocal.play()]);
      setIsPlaying(true);
    } catch {
      inst.pause();
      vocal.pause();
      setIsPlaying(false);
      setLoadState("error");
    }
  }, []);

  const seek = useCallback((t: number) => {
    const inst = instRef.current;
    const vocal = vocalRef.current;
    if (!inst || !vocal) return;
    const clamped = Math.max(0, Math.min(t, inst.duration || t));
    inst.currentTime = clamped;
    vocal.currentTime = clamped;
    setPosition(clamped);
  }, []);

  const changeVocal = useCallback((v: number) => {
    vocalVolRef.current = v;
    setVocalVol(v);
    const el = vocalRef.current;
    if (el) el.volume = v;
  }, []);

  const changeInst = useCallback((v: number) => {
    instVolRef.current = v;
    setInstVol(v);
    const el = instRef.current;
    if (el) el.volume = v;
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void togglePlay()}
          disabled={loadState === "loading"}
          className={cn(
            "shrink-0 w-11 h-11 rounded-full flex items-center justify-center transition-all",
            loadState === "loading"
              ? "bg-white/[0.06] text-white/40"
              : "bg-primary text-primary-foreground hover:bg-primary/90",
          )}
          aria-label={isPlaying ? "Pausar" : "Tocar"}
        >
          {loadState === "loading" ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : isPlaying ? (
            <Pause className="w-5 h-5" />
          ) : (
            <Play className="w-5 h-5 ml-0.5" />
          )}
        </button>
        <input
          type="range"
          min={0}
          max={duration || 0.0001}
          step={0.05}
          value={position}
          onChange={(e) => seek(Number(e.target.value))}
          disabled={loadState !== "ready"}
          className="flex-1 h-1.5 accent-primary cursor-pointer disabled:cursor-not-allowed"
          aria-label="Posição da música"
        />
        <span className="text-[11px] font-mono text-white/50 tabular-nums w-[88px] text-right">
          {formatClock(position)} / {formatClock(duration)}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <StemFader icon={Mic} label="Voz" value={vocalVol} onChange={changeVocal} />
        <StemFader icon={Music} label="Instrumental" value={instVol} onChange={changeInst} />
      </div>

      {loadState === "error" && (
        <p className="text-[12px] text-amber-200/90">
          Não foi possível carregar o áudio para a mistura. Tente novamente.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <a
          href={instrumentalUrl}
          download="harmonic-sem-voz.mp3"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-white/[0.06] text-white/90 hover:bg-white/10 transition-all"
        >
          <Download className="w-4 h-4" /> Sem voz
        </a>
        <a
          href={vocalsUrl}
          download="harmonic-voz.mp3"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-white/[0.06] text-white/90 hover:bg-white/10 transition-all"
        >
          <Download className="w-4 h-4" /> Só a voz
        </a>
      </div>
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
