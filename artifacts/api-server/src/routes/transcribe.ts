import express, { Router, type IRouter, type Request, type Response } from "express";
import { getAuth } from "@clerk/express";
import { toFile } from "openai";
import { spawn } from "node:child_process";
import { writeFile, readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { getOpenAI, isOpenAIConfigured } from "../lib/openai-client";

// ─────────────────────────────────────────────────────────────────────────────
// Transcrição automática de letra.
//
// Dois caminhos, nesta ordem de prioridade:
//
// 1) Worker externo (TRANSCRIPTION_WORKER_URL): separação de voz (Demucs) +
//    transcrição com timestamps por palavra (Faster-Whisper). Mais preciso, mas
//    exige hospedagem própria. Mantido plugável para o futuro.
//
// 2) OpenAI (integração gerenciada pelo Replit, gpt-4o-transcribe): transcrição
//    hospedada, sem chave nem servidor. Devolve só o TEXTO da letra (sem tempo
//    por palavra). Para posicionar os acordes, estimamos o tempo de cada linha
//    pela duração real do áudio (alinhamento aproximado).
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
// ─────────────────────────────────────────────────────────────────────────────

const router: IRouter = Router();

// OpenAI (gpt-4o-transcribe) aceita arquivos de até 25MB.
const OPENAI_MAX_BYTES = 25 * 1024 * 1024;

function workerUrl(): string | undefined {
  const raw = process.env.TRANSCRIPTION_WORKER_URL;
  const trimmed = raw?.trim();
  return trimmed ? trimmed.replace(/\/+$/, "") : undefined;
}

// Extensão de arquivo a partir do content-type (ajuda o modelo e o ffprobe).
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

// Mede a duração do áudio (em segundos) com ffprobe. Necessária para distribuir
// as linhas no tempo, já que o gpt-4o-transcribe não devolve timestamps.
async function probeDurationFile(path: string): Promise<number | undefined> {
  const dur = await new Promise<number>((resolve) => {
    const p = spawn("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      path,
    ]);
    let out = "";
    p.stdout.on("data", (d) => (out += d.toString()));
    p.on("close", () => resolve(parseFloat(out.trim())));
    p.on("error", () => resolve(NaN));
  });
  return Number.isFinite(dur) && dur > 0 ? dur : undefined;
}

// Converte o áudio para MP3 mono 16kHz (formato ideal para reconhecimento de
// fala) antes de enviar ao modelo. Isso reduz MUITO o tamanho — o proxy de IA
// gerenciado rejeita arquivos grandes com 413 — e melhora a transcrição. A
// duração é medida no mesmo passo. Se o ffmpeg não estiver disponível, usa o
// arquivo original como fallback.
async function prepareForStt(
  buffer: Buffer,
  ext: string,
): Promise<{ audio: Buffer; contentType: string; filename: string; duration?: number }> {
  const inPath = join(tmpdir(), `tr-in-${randomUUID()}.${ext}`);
  const outPath = join(tmpdir(), `tr-out-${randomUUID()}.mp3`);
  await writeFile(inPath, buffer);
  try {
    const ok = await new Promise<boolean>((resolve) => {
      const p = spawn("ffmpeg", [
        "-y",
        "-i",
        inPath,
        "-ac",
        "1",
        "-ar",
        "16000",
        "-b:a",
        "64k",
        "-f",
        "mp3",
        outPath,
      ]);
      p.on("close", (code) => resolve(code === 0));
      p.on("error", () => resolve(false));
    });
    if (ok) {
      const [audio, duration] = await Promise.all([
        readFile(outPath),
        probeDurationFile(outPath),
      ]);
      return { audio, contentType: "audio/mpeg", filename: "audio.mp3", duration };
    }
    const duration = await probeDurationFile(inPath);
    return { audio: buffer, contentType: `audio/${ext}`, filename: `audio.${ext}`, duration };
  } finally {
    await unlink(inPath).catch(() => {});
    await unlink(outPath).catch(() => {});
  }
}

// Quebra o texto transcrito em linhas no estilo de letra (sem inventar nada,
// apenas reorganizando o que veio). Respeita quebras/pontuação e parte linhas
// muito longas em trechos menores.
function segmentText(text: string): string[] {
  const byNewline = text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  let base: string[];
  if (byNewline.length > 1) {
    base = byNewline;
  } else {
    const oneLine = text.replace(/\s+/g, " ").trim();
    const sentences = oneLine
      .split(/(?<=[.!?…])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    base = sentences.length ? sentences : oneLine ? [oneLine] : [];
  }

  const out: string[] = [];
  for (const line of base) {
    const words = line.split(/\s+/).filter(Boolean);
    if (words.length <= 10) {
      out.push(line);
      continue;
    }
    for (let i = 0; i < words.length; i += 8) {
      out.push(words.slice(i, i + 8).join(" "));
    }
  }
  return out;
}

// Monta o contrato a partir do texto transcrito, distribuindo as linhas e
// palavras ao longo da duração do áudio (proporcional ao número de caracteres).
// O tempo é ESTIMADO — usado só para posicionar os acordes de forma aproximada.
function buildResultFromText(
  text: string,
  duration: number | undefined,
): { language?: string; text: string; lines: OutLine[] } {
  const lineTexts = segmentText(text);
  if (lineTexts.length === 0) {
    return { text: text.trim(), lines: [] };
  }

  const totalChars = lineTexts.reduce((a, l) => a + Math.max(l.length, 1), 0);
  const dur = duration && duration > 0 ? duration : Math.max(lineTexts.length * 2.5, 4);

  let cursor = 0;
  const lines: OutLine[] = lineTexts.map((lt) => {
    const share = Math.max(lt.length, 1) / totalChars;
    const start = cursor;
    const end = Math.min(dur, start + share * dur);
    cursor = end;

    const words = lt.split(/\s+/).filter(Boolean);
    const wTotalChars = words.reduce((a, w) => a + Math.max(w.length, 1), 0) || 1;
    const span = Math.max(end - start, 0);
    let wCursor = start;
    const wordObjs: OutWord[] = words.map((w) => {
      const wShare = Math.max(w.length, 1) / wTotalChars;
      const ws = wCursor;
      const we = Math.min(end, ws + wShare * span);
      wCursor = we;
      return { text: w, start: ws, end: we };
    });

    return { text: lt, start, end, words: wordObjs };
  });

  return { text: text.trim(), lines };
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

    // ── Caminho 2: OpenAI (gpt-4o-transcribe, integração gerenciada) ────────
    const openai = getOpenAI();
    if (openai) {
      const ext = extFromContentType(contentType);
      try {
        const prepared = await prepareForStt(body, ext);
        if (prepared.audio.length > OPENAI_MAX_BYTES) {
          return res.status(422).json({
            status: "audio_too_large",
            message:
              "O áudio é grande demais para a transcrição automática. Tente um arquivo mais curto.",
          });
        }

        const transcription = await openai.audio.transcriptions.create(
          {
            file: await toFile(prepared.audio, prepared.filename, {
              type: prepared.contentType,
            }),
            model: "gpt-4o-transcribe",
            response_format: "json",
          },
          { timeout: 5 * 60 * 1000 },
        );

        const rawText = (transcription.text ?? "").trim();
        const result = buildResultFromText(rawText, prepared.duration);
        if (result.lines.length === 0) {
          return res.status(422).json({
            status: "no_speech",
            message: "Não foi possível identificar letra cantada neste áudio.",
          });
        }
        return res.status(200).json(result);
      } catch (err) {
        const status = (err as { status?: number })?.status;
        console.error(
          "[/api/transcribe] openai error:",
          status,
          (err as { message?: string })?.message,
          (err as { error?: unknown })?.error,
        );
        if (status === 413) {
          return res.status(422).json({
            status: "audio_too_large",
            message:
              "O áudio é grande demais para a transcrição automática. Tente um arquivo mais curto.",
          });
        }
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
