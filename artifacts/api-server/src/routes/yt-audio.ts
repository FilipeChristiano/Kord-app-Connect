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
// (no navegador, no modo rápido; no servidor, no modo máxima qualidade). O player
// embutido do YouTube não permite ler essas amostras (proteção/cross-origin),
// então quando o usuário pesquisa pelo título nós baixamos o áudio aqui no
// servidor e devolvemos/reaproveitamos o arquivo.
//
// Para deixar a preparação RÁPIDA, baixamos a faixa de áudio M4A (AAC) já pronta
// do YouTube e apenas a remuxamos para o contêiner .m4a — SEM recodificar (o
// passo de recodificar para MP3 era o gargalo). O AAC/M4A toca em todos os
// navegadores (inclusive iOS/Safari) e mantém o estéreo, necessário para a
// separação. O resultado fica em cache em disco por id.
// ─────────────────────────────────────────────────────────────────────────────

const router: IRouter = Router();

const VIDEO_ID = /^[\w-]{11}$/;
const CACHE_DIR = path.join(os.tmpdir(), "harmonic-yt-audio");
const DOWNLOAD_TIMEOUT_MS = 90_000;
// Limite simples do cache em disco (descarta os arquivos mais antigos acima disso).
const MAX_CACHE_BYTES = 400 * 1024 * 1024;

function cachePath(id: string): string {
  return path.join(CACHE_DIR, `${id}.m4a`);
}

// Mantém apenas o cache mais recente sob o limite, removendo os arquivos antigos.
async function pruneCache(): Promise<void> {
  try {
    const files = readdirSync(CACHE_DIR)
      .filter((f) => f.endsWith(".m4a"))
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

// Gerador de PO tokens (prova de origem) do YouTube — necessário no servidor
// publicado, cujo IP de datacenter é barrado com "Sign in to confirm you're
// not a bot" em TODOS os clientes. O plugin bgutil-ytdlp-pot-provider (pip)
// chama este script Node para gerar o token. Vendorizado em vendor/bgutil-pot;
// as dependências dele estão no package.json do api-server.
function findPotScript(): string | null {
  const dir = typeof __dirname !== "undefined" ? __dirname : process.cwd();
  const candidates = [
    path.resolve(dir, "..", "vendor", "bgutil-pot", "generate_once.js"),
    path.resolve(dir, "..", "..", "vendor", "bgutil-pot", "generate_once.js"),
    path.resolve(process.cwd(), "artifacts", "api-server", "vendor", "bgutil-pot", "generate_once.js"),
    path.resolve(process.cwd(), "vendor", "bgutil-pot", "generate_once.js"),
  ];
  for (const c of candidates) if (existsSync(c)) return c;
  return null;
}
const POT_SCRIPT = findPotScript();
if (!POT_SCRIPT) {
  console.warn(
    "[yt-audio] gerador de PO token não encontrado; downloads podem ser bloqueados em produção",
  );
}

// Uma tentativa de download com os argumentos extras informados.
function runYtDlp(id: string, outPath: string, extraArgs: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = `https://www.youtube.com/watch?v=${id}`;
    // Template sem extensão: o yt-dlp resolve a extensão e remuxa para .m4a.
    const outTemplate = outPath.replace(/\.m4a$/, ".%(ext)s");
    const args = [
      // O YouTube passou a exigir um runtime JavaScript para extração (EJS).
      // O padrão do yt-dlp é só o deno, que não existe no ambiente publicado;
      // habilitamos o Node (sempre presente, é o runtime do próprio servidor).
      "--js-runtimes",
      "node",
      // Habilita o gerador de PO tokens (contorna o bloqueio de bot do
      // YouTube em IPs de datacenter, como o do servidor publicado).
      ...(POT_SCRIPT
        ? ["--extractor-args", `youtubepot-bgutilscript:script_path=${POT_SCRIPT}`]
        : []),
      ...extraArgs,
      "-f",
      "bestaudio[ext=m4a]/bestaudio",
      "--remux-video",
      "m4a",
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

// Clientes alternativos do YouTube tentados em sequência quando o servidor é
// barrado com "Sign in to confirm you're not a bot" ou 403 (comum em IPs de
// datacenter, como o do app publicado). O cliente "tv" e o "web_embedded"
// costumam passar sem login onde o cliente padrão é bloqueado.
const CLIENT_FALLBACKS: string[][] = [
  [],
  ["--extractor-args", "youtube:player_client=web_embedded"],
  ["--extractor-args", "youtube:player_client=tv"],
];

function isBlockedError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /sign in to confirm|not a bot|403|429/i.test(msg);
}

// Baixa a melhor faixa de áudio M4A e remuxa (sem recodificar) para `outPath`.
async function downloadAudio(id: string, outPath: string): Promise<void> {
  let lastErr: unknown = null;
  for (const extra of CLIENT_FALLBACKS) {
    try {
      await runYtDlp(id, outPath, extra);
      return;
    } catch (err) {
      lastErr = err;
      // Timeout ou erro que não é de bloqueio: não adianta trocar de cliente.
      if (!isBlockedError(err)) throw err;
      console.warn(
        `[yt-audio] bloqueado (${extra.join(" ") || "cliente padrão"}), tentando próximo cliente...`,
      );
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

// Garante que o áudio do vídeo está no cache e devolve o caminho do arquivo.
// Reutilizado pelo estúdio de máxima qualidade (separação no servidor).
export async function ensureYoutubeAudio(id: string): Promise<string> {
  mkdirSync(CACHE_DIR, { recursive: true });
  const outPath = cachePath(id);
  if (!existsSync(outPath)) {
    await downloadAudioOnce(id, outPath);
    void pruneCache();
  }
  return outPath;
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
    const outPath = await ensureYoutubeAudio(id);
    const stat = statSync(outPath);
    res.setHeader("Content-Type", "audio/mp4");
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
