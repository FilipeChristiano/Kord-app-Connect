import express, { Router, type IRouter, type Request, type Response } from "express";
import { getAuth } from "@clerk/express";
import { toFile } from "openai";
import { getOpenAI, isOpenAIConfigured } from "../lib/openai-client";

// ─────────────────────────────────────────────────────────────────────────────
// Transcrição automática de letra.
//
// Dois caminhos, nesta ordem de prioridade:
//
// 1) Worker externo (TRANSCRIPTION_WORKER_URL): separação de voz (Demucs) +
//    transcrição (Faster-Whisper). Mais preciso para mixagens densas, mas exige
//    hospedagem própria. Mantido plugável para o futuro.
//
// 2) OpenAI Whisper (integração gerenciada pelo Replit): transcrição hospedada,
//    sem precisar de chave nem servidor. Transcreve a mixagem completa (sem
//    separar voz), o que funciona bem para a maioria das músicas com vocal claro.
//
// Se nenhum estiver disponível, respondemos um status honesto (503) — nunca
// simulamos nem inventamos letra.
//
// Contrato devolvido ao cliente (igual nos dois caminhos):
//   {
//     "language": "pt",
//     "text": "letra completa…",
//     "lines": [
//       {
//         "text": "Senhor, eu me rendo",
//         "start": 12.3, "end": 15.1,
//         "words": [{ "text": "Senhor,", "start": 12.3, "end": 12.7, "confidence": 0.94 }]
//       }
//     ]
//   }
//
// Contrato esperado do worker externo (caminho 1):
//   POST {TRANSCRIPTION_WORKER_URL}/transcribe  (bytes do áudio → JSON acima)
// ─────────────────────────────────────────────────────────────────────────────

const router: IRouter = Router();

// Whisper (OpenAI) aceita arquivos de até 25MB.
const OPENAI_MAX_BYTES = 25 * 1024 * 1024;

function workerUrl(): string | undefined {
  const raw = process.env.TRANSCRIPTION_WORKER_URL;
  const trimmed = raw?.trim();
  return trimmed ? trimmed.replace(/\/+$/, "") : undefined;
}

// Extensão de arquivo a partir do content-type (Whisper usa para inferir o formato).
function extFromContentType(ct: string): string {
  const t = ct.toLowerCase();
  if (t.includes("mpeg") || t.includes("mp3")) return "mp3";
  if (t.includes("wav")) return "wav";
  if (t.includes("m4a") || t.includes("mp4") || t.includes("aac")) return "m4a";
  if (t.includes("ogg")) return "ogg";
  if (t.includes("flac")) return "flac";
  if (t.includes("webm")) return "webm";
  return "mp3";
}

interface OutWord {
  text: string;
  start: number;
  end: number;
  confidence?: number;
}
interface OutLine {
  text: string;
  start: number;
  end: number;
  words: OutWord[];
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

// Converte a resposta verbose_json do Whisper no nosso contrato (linhas + palavras
// com tempo e confiança). A confiança é derivada do avg_logprob/no_speech_prob do
// segmento (o Whisper não fornece confiança por palavra).
function mapWhisperVerbose(v: {
  language?: string;
  text?: string;
  segments?: Array<{
    start: number;
    end: number;
    text: string;
    avg_logprob?: number;
    no_speech_prob?: number;
  }>;
  words?: Array<{ word: string; start: number; end: number }>;
}): { language?: string; text: string; lines: OutLine[] } {
  const segments = Array.isArray(v.segments) ? v.segments : [];
  const allWords = Array.isArray(v.words) ? v.words : [];

  const lines: OutLine[] = segments.map((seg) => {
    const segConf = clamp01(
      Math.exp(seg.avg_logprob ?? -0.7) * (1 - (seg.no_speech_prob ?? 0)),
    );
    const words: OutWord[] = allWords
      .filter((w) => w.start >= seg.start - 0.01 && w.start < seg.end)
      .map((w) => ({
        text: w.word.trim(),
        start: w.start,
        end: w.end,
        confidence: segConf,
      }));
    return {
      text: seg.text.trim(),
      start: seg.start,
      end: seg.end,
      words:
        words.length > 0
          ? words
          : [{ text: seg.text.trim(), start: seg.start, end: seg.end, confidence: segConf }],
    };
  });

  return { language: v.language, text: (v.text ?? "").trim(), lines };
}

// Disponibilidade do serviço — usado pela UI para mostrar o estado correto
// antes de o usuário enviar o áudio.
router.get("/transcribe/status", (_req: Request, res: Response) => {
  res.json({ available: Boolean(workerUrl()) || isOpenAIConfigured() });
});

router.post(
  "/transcribe",
  express.raw({ type: () => true, limit: "60mb" }),
  async (req: Request, res: Response) => {
    const auth = getAuth(req);
    if (!auth?.userId) {
      return res
        .status(401)
        .json({ status: "unauthorized", message: "Faça login para usar a transcrição automática." });
    }

    const body = req.body as Buffer | undefined;
    if (!body || body.length === 0) {
      return res.status(400).json({ status: "empty_audio", message: "Nenhum áudio recebido." });
    }

    const contentType = String(req.headers["content-type"] ?? "application/octet-stream");
    const worker = workerUrl();

    // ── Caminho 1: worker externo (prioritário) ─────────────────────────────
    if (worker) {
      try {
        const upstream = await fetch(`${worker}/transcribe`, {
          method: "POST",
          headers: { "content-type": contentType },
          body,
          signal: AbortSignal.timeout(5 * 60 * 1000),
        });
        const text = await upstream.text();

        if (!upstream.ok) {
          res.status(upstream.status);
          res.type(upstream.headers.get("content-type") ?? "application/json");
          return res.send(text);
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          console.error("[/api/transcribe] worker returned non-JSON body");
          return res.status(502).json({
            status: "worker_error",
            message: "O serviço de transcrição retornou uma resposta inválida.",
          });
        }
        const p = parsed as { text?: unknown; lines?: unknown };
        if (typeof p?.text !== "string" || !Array.isArray(p?.lines)) {
          console.error("[/api/transcribe] worker response failed schema check");
          return res.status(502).json({
            status: "worker_error",
            message: "O serviço de transcrição retornou um formato inesperado.",
          });
        }
        res.status(200);
        res.type("application/json");
        return res.send(text);
      } catch (err) {
        const aborted = err instanceof Error && err.name === "TimeoutError";
        console.error("[/api/transcribe] worker error:", err);
        return res.status(aborted ? 504 : 502).json({
          status: "worker_error",
          message: aborted
            ? "O serviço de transcrição demorou demais para responder. Tente novamente."
            : "Não foi possível contatar o serviço de transcrição.",
        });
      }
    }

    // ── Caminho 2: OpenAI Whisper (integração gerenciada) ───────────────────
    const openai = getOpenAI();
    if (openai) {
      if (body.length > OPENAI_MAX_BYTES) {
        return res.status(422).json({
          status: "audio_too_large",
          message:
            "O áudio é grande demais para a transcrição automática (limite de 25MB). Tente um arquivo mais curto ou mais comprimido (ex.: MP3 128kbps).",
        });
      }
      try {
        const file = await toFile(body, `audio.${extFromContentType(contentType)}`, {
          type: contentType,
        });
        const v = await openai.audio.transcriptions.create(
          {
            file,
            model: "whisper-1",
            response_format: "verbose_json",
            timestamp_granularities: ["word", "segment"],
          },
          { timeout: 5 * 60 * 1000 },
        );
        const mapped = mapWhisperVerbose(v as Parameters<typeof mapWhisperVerbose>[0]);
        if (mapped.lines.length === 0) {
          return res.status(422).json({
            status: "no_speech",
            message: "Não foi possível identificar letra cantada neste áudio.",
          });
        }
        return res.status(200).json(mapped);
      } catch (err) {
        console.error("[/api/transcribe] openai error:", err);
        return res.status(502).json({
          status: "worker_error",
          message: "Não foi possível concluir a transcrição automática. Tente novamente.",
        });
      }
    }

    // ── Nenhum caminho disponível ───────────────────────────────────────────
    return res.status(503).json({
      status: "external_processing_required",
      message:
        "Transcrição automática exige processamento externo (worker com Demucs + Faster-Whisper) ou a integração de IA configurada.",
    });
  },
);

export default router;
