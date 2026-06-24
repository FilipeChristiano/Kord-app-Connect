import { Router, type IRouter, type Request, type Response } from "express";
import { getAuth } from "@clerk/express";
import { spawn } from "node:child_process";
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
} from "node:fs";
import { unlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// Extração do ÁUDIO da música (vídeo público do YouTube) para o Estúdio de áudio.
//
// O estúdio (versão sem voz / voz em destaque) processa as AMOSTRAS reais do som
// no navegador (Web Audio). O player embutido do YouTube não permite ler essas
// amostras (proteção/cross-origin), então quando o usuário pesquisa pelo título
// nós baixamos o áudio aqui no servidor e devolvemos o arquivo para o app tratar.
//
// Baixamos a melhor faixa de áudio e convertemos para MP3 (mantém o estéreo, que
// é necessário para o efeito de cancelamento de voz). O resultado fica em cache
// em disco por id, evitando baixar de novo a cada clique.
// ─────────────────────────────────────────────────────────────────────────────

const router: IRouter = Router();

const VIDEO_ID = /^[\w-]{11}$/;
const CACHE_DIR = path.join(os.tmpdir(), "harmonic-yt-audio");
const DOWNLOAD_TIMEOUT_MS = 90_000;
// Limite simples do cache em disco (descarta os arquivos mais antigos acima disso).
const MAX_CACHE_BYTES = 400 * 1024 * 1024;

// Mantém apenas o cache mais recente sob o limite, removendo os arquivos antigos.
async function pruneCache(): Promise<void> {
  try {
    const files = readdirSync(CACHE_DIR)
      .filter((f) => f.endsWith(".mp3"))
      .map((f) => {
        const full = path.join(CACHE_DIR, f);
        const st = statSync(full);
        return { full, size: st.size, mtime: st.mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime);
    let total = 0;
    for (const f of files) {
      total += f.size;
      if (total > MAX_CACHE_BYTES) {
        await unlink(f.full).catch(() => {});
      }
    }
  } catch {
    // cache é melhor-esforço: ignorar falhas de limpeza.
  }
}

// Evita baixar o mesmo vídeo em paralelo: requisições simultâneas para o mesmo
// id compartilham o mesmo download em andamento (e a mesma falha, se houver).
const inFlight = new Map<string, Promise<void>>();

function downloadAudioOnce(id: string, outPath: string): Promise<void> {
  const existing = inFlight.get(id);
  if (existing) return existing;
  const p = downloadAudio(id, outPath).finally(() => {
    inFlight.delete(id);
  });
  inFlight.set(id, p);
  return p;
}

// Baixa a melhor faixa de áudio do vídeo e converte para MP3 em `outPath`.
function downloadAudio(id: string, outPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = `https://www.youtube.com/watch?v=${id}`;
    // Template sem extensão: o yt-dlp baixa (webm/m4a) e o ffmpeg converte p/ mp3.
    const outTemplate = outPath.replace(/\.mp3$/, ".%(ext)s");
    const args = [
      "-f",
      "bestaudio/best",
      "-x",
      "--audio-format",
      "mp3",
      "--no-playlist",
      "--no-progress",
      "--no-cache-dir",
      "--quiet",
      "-o",
      outTemplate,
      url,
    ];
    const child = spawn("yt-dlp", args, {
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr?.on("data", (d: Buffer) => {
      stderr += d.toString();
    });
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("download_timeout"));
    }, DOWNLOAD_TIMEOUT_MS);
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0 && existsSync(outPath)) resolve();
      else reject(new Error(`yt-dlp exit ${code}: ${stderr.slice(0, 500)}`));
    });
  });
}

router.get("/yt-audio", async (req: Request, res: Response) => {
  // Mesmo bypass de login do preview de desenvolvimento usado em /api/cifra:
  // os cookies do Clerk são bloqueados no iframe, então liberamos em dev.
  const isDev = process.env.NODE_ENV === "development";
  const auth = getAuth(req);
  if (!auth?.userId && !isDev) {
    return res
      .status(401)
      .json({ status: "unauthorized", message: "Faça login para usar o estúdio." });
  }

  const id = String(req.query.id ?? "").trim();
  if (!VIDEO_ID.test(id)) {
    return res.status(400).json({ status: "bad_request", message: "Vídeo inválido." });
  }

  try {
    mkdirSync(CACHE_DIR, { recursive: true });
    const outPath = path.join(CACHE_DIR, `${id}.mp3`);
    if (!existsSync(outPath)) {
      await downloadAudioOnce(id, outPath);
      void pruneCache();
    }
    const stat = statSync(outPath);
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Length", String(stat.size));
    res.setHeader("Cache-Control", "private, max-age=3600");
    const stream = createReadStream(outPath);
    stream.on("error", (err) => {
      console.error("[/api/yt-audio] stream error:", err instanceof Error ? err.message : err);
      if (!res.headersSent) {
        res
          .status(502)
          .json({ status: "fetch_failed", message: "Não foi possível obter o áudio agora." });
      } else {
        res.destroy();
      }
    });
    stream.pipe(res);
    return;
  } catch (err) {
    console.error("[/api/yt-audio] error:", err instanceof Error ? err.message : err);
    return res
      .status(502)
      .json({ status: "fetch_failed", message: "Não foi possível obter o áudio agora." });
  }
});

export default router;
