import express, { Router, type IRouter, type Request, type Response } from "express";
import { getAuth } from "@clerk/express";

// ─────────────────────────────────────────────────────────────────────────────
// Transcrição automática de letra (plugável).
//
// O processamento pesado (Demucs para separar voz/instrumental + Faster-Whisper
// para transcrever a letra com timestamps) NÃO roda neste ambiente: exige um
// worker externo com GPU/CPU dedicada e modelos grandes.
//
// Este endpoint é o ponto de plug: quando a variável de ambiente
// TRANSCRIPTION_WORKER_URL estiver configurada, o áudio é encaminhado para o
// worker; caso contrário, respondemos um status honesto (503) — nunca simulamos
// nem inventamos letra.
//
// Contrato esperado do worker (futuro):
//   POST {TRANSCRIPTION_WORKER_URL}/transcribe
//     - corpo: bytes do áudio (Content-Type do arquivo original)
//     - resposta 200 JSON:
//       {
//         "language": "pt",
//         "text": "letra completa…",
//         "lines": [
//           {
//             "text": "Senhor, eu me rendo",
//             "start": 12.3, "end": 15.1,
//             "words": [{ "text": "Senhor,", "start": 12.3, "end": 12.7, "confidence": 0.94 }]
//           }
//         ]
//       }
// ─────────────────────────────────────────────────────────────────────────────

const router: IRouter = Router();

function workerUrl(): string | undefined {
  const raw = process.env.TRANSCRIPTION_WORKER_URL;
  const trimmed = raw?.trim();
  return trimmed ? trimmed.replace(/\/+$/, "") : undefined;
}

// Disponibilidade do serviço — usado pela UI para mostrar o estado correto
// antes de o usuário enviar o áudio.
router.get("/transcribe/status", (_req: Request, res: Response) => {
  res.json({ available: Boolean(workerUrl()) });
});

// Recebe os bytes do áudio e encaminha ao worker externo, se configurado.
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

    const worker = workerUrl();
    if (!worker) {
      return res.status(503).json({
        status: "external_processing_required",
        message:
          "Transcrição automática exige processamento externo (worker com Demucs + Faster-Whisper).",
      });
    }

    const body = req.body as Buffer | undefined;
    if (!body || body.length === 0) {
      return res.status(400).json({ status: "empty_audio", message: "Nenhum áudio recebido." });
    }

    try {
      const contentType = req.headers["content-type"] ?? "application/octet-stream";
      // Timeout explícito: a transcrição pode ser lenta, mas uma request pendurada
      // indefinidamente trava o servidor. 5 min cobre faixas longas com folga.
      const upstream = await fetch(`${worker}/transcribe`, {
        method: "POST",
        headers: { "content-type": String(contentType) },
        body,
        signal: AbortSignal.timeout(5 * 60 * 1000),
      });
      const text = await upstream.text();

      if (!upstream.ok) {
        res.status(upstream.status);
        res.type(upstream.headers.get("content-type") ?? "application/json");
        return res.send(text);
      }

      // Falha cedo se o worker devolver algo fora do contrato (texto da letra +
      // linhas com palavras), em vez de propagar uma resposta inválida ao cliente.
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
  },
);

export default router;
