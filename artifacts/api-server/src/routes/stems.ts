import express, { Router, type IRouter, type Request, type Response } from "express";
import { getAuth } from "@clerk/express";
import { spawn } from "node:child_process";
import { createReadStream, existsSync, mkdirSync, statSync } from "node:fs";
import { readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import os from "node:os";
import { join, resolve } from "node:path";
import { ensureYoutubeAudio } from "./yt-audio";

// ─────────────────────────────────────────────────────────────────────────────
// Estúdio de áudio — MÁXIMA QUALIDADE (separação no servidor).
//
// O modo "rápido" separa a voz dentro do navegador (instantâneo, qualidade boa).
// Este modo roda a inteligência de separação completa do estúdio no servidor:
// uma única passada gera as DUAS faixas — voz em destaque e sem voz — com
// isolamento muito superior. É mais lento (alguns minutos por música), então
// trabalhamos com um trabalho assíncrono: o app pede a preparação, consulta o
// status e, quando pronto, baixa/toca cada faixa.
//
// Fonte do áudio: id do YouTube (reaproveita o download em cache) OU arquivo
// enviado pelo usuário (identificado pelo hash do conteúdo). As faixas geradas
// ficam em cache em disco por chave, em MP3 (256 kbps) para entrega leve.
// ─────────────────────────────────────────────────────────────────────────────

const router: IRouter = Router();

const VIDEO_ID = /^[\w-]{11}$/;
const KEY_RE = /^[\w-]{6,80}$/;
const STEM_CACHE = join(os.tmpdir(), "harmonic-stems");
// Músicas de até 15 minutos precisam de mais tempo para separação em CPU.
const SEPARATE_TIMEOUT_MS = 30 * 60 * 1000;
const MAX_UPLOAD_BYTES = 60 * 1024 * 1024;
// Retenção do cache de faixas geradas: evita crescimento ilimitado no disco.
const STEM_TTL_MS = 24 * 60 * 60 * 1000;
const STEM_MAX_DIRS = 40;

type Mode = "vocals" | "instrumental";
type Status = "processing" | "ready" | "error";
interface JobState {
  status: Status;
  error?: string;
}

const jobs = new Map<string, JobState>();
const inFlight = new Map<string, Promise<void>>();

// ── Localização do Python/script (mesmo padrão da análise de acordes) ─────────
function findWorkspaceRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    if (existsSync(join(dir, "pnpm-workspace.yaml")) || existsSync(join(dir, ".pythonlibs"))) {
      return dir;
    }
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

const WORKSPACE_ROOT = findWorkspaceRoot();

function pythonBin(): string {
  const envBin = process.env.CHORD_PYTHON?.trim();
  if (envBin && existsSync(envBin)) return envBin;
  const venv = join(WORKSPACE_ROOT, ".pythonlibs", "bin", "python3");
  if (existsSync(venv)) return venv;
  return "python3";
}

function scriptPath(name: string): string {
  const candidates = [
    join(WORKSPACE_ROOT, "artifacts", "api-server", "scripts", name),
    resolve(process.cwd(), "scripts", name),
    resolve(process.cwd(), "..", "scripts", name),
  ];
  for (const c of candidates) if (existsSync(c)) return c;
  return candidates[0];
}

function keyDir(key: string): string {
  return join(STEM_CACHE, key);
}

function stemMp3(key: string, mode: Mode): string {
  return join(keyDir(key), `${mode}.mp3`);
}

function stemsReady(key: string): boolean {
  return existsSync(stemMp3(key, "vocals")) && existsSync(stemMp3(key, "instrumental"));
}

// ── Execução do separador (Demucs) + transcodificação para MP3 ────────────────
function runPythonSeparation(srcPath: string, outDir: string): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(pythonBin(), [scriptPath("separate_stems.py"), srcPath, outDir, "7"], {
      cwd: WORKSPACE_ROOT,
      env: {
        ...process.env,
        // Mantém os pesos do modelo em cache dentro do workspace (gravável).
        TORCH_HOME: join(WORKSPACE_ROOT, ".cache", "torch"),
        NUMBA_CACHE_DIR: join(WORKSPACE_ROOT, ".cache", "numba"),
        OMP_NUM_THREADS: String(Math.max(1, os.cpus().length)),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (d: Buffer) => {
      stdout += d.toString();
    });
    child.stderr?.on("data", (d: Buffer) => {
      stderr += d.toString();
    });
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("separation_timeout"));
    }, SEPARATE_TIMEOUT_MS);
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      try {
        const last = stdout.trim().split("\n").pop() ?? "{}";
        const parsed = JSON.parse(last) as { ok?: boolean; error?: string };
        if (code === 0 && parsed.ok) {
          resolvePromise();
          return;
        }
        reject(new Error(parsed.error || stderr.slice(-400) || `exit ${code}`));
      } catch {
        reject(new Error(stderr.slice(-400) || `exit ${code}`));
      }
    });
  });
}

// ffmpeg: normaliza qualquer entrada para WAV mono 22.05 kHz (o que o rastreador
// de batidas espera). Usado tanto para o instrumental do cache (HQ) quanto para
// o áudio enviado pelo navegador (modo rápido).
function transcodeToWavMono(srcPath: string, wavPath: string): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const p = spawn("ffmpeg", ["-y", "-i", srcPath, "-ac", "1", "-ar", "22050", "-f", "wav", wavPath]);
    let err = "";
    p.stderr?.on("data", (d: Buffer) => {
      err += d.toString();
    });
    p.on("error", reject);
    p.on("close", (code) => {
      if (code !== 0) reject(new Error(err.slice(-300) || `ffmpeg exit ${code}`));
      else resolvePromise();
    });
  });
}

// ── Rastreamento de batidas (beat tracking) ──────────────────────────────────
// Roda o detector profissional (librosa, programação dinâmica) sobre um WAV e
// devolve os instantes (s) de cada batida + o andamento estimado. O primeiro uso
// pode compilar kernels do numba (~min); os seguintes são rápidos (cache numba).
const BEAT_TIMEOUT_MS = 4 * 60 * 1000;

type Meter = "3/4" | "4/4" | "6/8";

interface BeatResult {
  bpm: number;
  beats: number[];
  meter?: Meter | null;
}

function runBeatDetection(wavPath: string, bpmHint: number): Promise<BeatResult> {
  return new Promise((resolvePromise, reject) => {
    const args = [scriptPath("detect_beats.py"), wavPath];
    if (bpmHint > 0) args.push(String(Math.round(bpmHint)));
    const child = spawn(pythonBin(), args, {
      cwd: WORKSPACE_ROOT,
      env: {
        ...process.env,
        NUMBA_CACHE_DIR: join(WORKSPACE_ROOT, ".cache", "numba"),
        OMP_NUM_THREADS: String(Math.max(1, os.cpus().length)),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (d: Buffer) => {
      stdout += d.toString();
    });
    child.stderr?.on("data", (d: Buffer) => {
      stderr += d.toString();
    });
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("beat_timeout"));
    }, BEAT_TIMEOUT_MS);
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      try {
        const last = stdout.trim().split("\n").pop() ?? "{}";
        const parsed = JSON.parse(last) as {
          ok?: boolean;
          bpm?: number;
          beats?: number[];
          meter?: string;
          error?: string;
        };
        if (code === 0 && parsed.ok && Array.isArray(parsed.beats)) {
          const meter =
            parsed.meter === "3/4" || parsed.meter === "4/4" || parsed.meter === "6/8"
              ? parsed.meter
              : null;
          resolvePromise({ bpm: typeof parsed.bpm === "number" ? parsed.bpm : 0, beats: parsed.beats, meter });
          return;
        }
        reject(new Error(parsed.error || stderr.slice(-300) || `exit ${code}`));
      } catch {
        reject(new Error(stderr.slice(-300) || `exit ${code}`));
      }
    });
  });
}

// O cache das batidas depende da DICA de BPM: a dica alimenta o start_bpm do
// rastreador, então uma dica diferente pode render uma grade diferente (meio/
// dobro do andamento). Por isso a dica entra na chave do cache — assim trocar a
// opção de BPM recalcula, em vez de reusar uma grade ruim.
function beatsJson(key: string, bpmHint: number): string {
  const tag = bpmHint > 0 ? Math.round(bpmHint) : "auto";
  return join(keyDir(key), `beats_${tag}.json`);
}

const beatsInFlight = new Map<string, Promise<BeatResult>>();

// Calcula (ou reaproveita do cache) as batidas do instrumental já preparado.
async function computeBeatsForKey(key: string, bpmHint: number): Promise<BeatResult> {
  const cacheFile = beatsJson(key, bpmHint);
  if (existsSync(cacheFile)) {
    try {
      const parsed = JSON.parse(await readFile(cacheFile, "utf8")) as BeatResult;
      if (Array.isArray(parsed.beats) && parsed.beats.length >= 2) return parsed;
    } catch {
      // cache corrompido: recalcula.
    }
  }
  const inst = stemMp3(key, "instrumental");
  if (!existsSync(inst)) throw new Error("not_ready");
  const wav = join(keyDir(key), "beats.wav");
  try {
    await transcodeToWavMono(inst, wav);
    const result = await runBeatDetection(wav, bpmHint);
    await writeFile(cacheFile, JSON.stringify(result)).catch(() => {});
    return result;
  } finally {
    await rm(wav, { force: true }).catch(() => {});
  }
}

function parseBpmHint(q: unknown): number {
  const n = Number(q);
  return Number.isFinite(n) && n >= 40 && n <= 240 ? n : 0;
}

function transcodeToMp3(wavPath: string, mp3Path: string): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const tmp = `${mp3Path}.part`;
    const p = spawn("ffmpeg", [
      "-y",
      "-i",
      wavPath,
      "-c:a",
      "libmp3lame",
      "-b:a",
      "256k",
      "-f",
      "mp3",
      tmp,
    ]);
    let err = "";
    p.stderr?.on("data", (d: Buffer) => {
      err += d.toString();
    });
    p.on("error", reject);
    p.on("close", async (code) => {
      if (code !== 0) {
        reject(new Error(err.slice(-300) || `ffmpeg exit ${code}`));
        return;
      }
      try {
        await rename(tmp, mp3Path);
        resolvePromise();
      } catch (e) {
        reject(e as Error);
      }
    });
  });
}

async function separate(key: string, srcPath: string): Promise<void> {
  const finalDir = keyDir(key);
  const workDir = `${finalDir}.work`;
  await rm(workDir, { recursive: true, force: true });
  mkdirSync(workDir, { recursive: true });
  try {
    await runPythonSeparation(srcPath, workDir);
    // Demucs gera WAV (estéreo 44.1k). Convertemos para MP3 leve para entrega.
    await transcodeToMp3(join(workDir, "vocals.wav"), join(workDir, "vocals.mp3"));
    await transcodeToMp3(join(workDir, "instrumental.wav"), join(workDir, "instrumental.mp3"));
    await rm(join(workDir, "vocals.wav"), { force: true });
    await rm(join(workDir, "instrumental.wav"), { force: true });
    await rm(finalDir, { recursive: true, force: true });
    await rename(workDir, finalDir);
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

// Limpa o cache de faixas: remove diretórios antigos (TTL) e mantém um limite
// máximo (LRU por data de modificação). Também remove fontes de upload órfãs.
async function pruneStemCache(): Promise<void> {
  try {
    const entries = await readdir(STEM_CACHE, { withFileTypes: true });
    const now = Date.now();
    const dirs: { path: string; mtime: number }[] = [];
    for (const e of entries) {
      const full = join(STEM_CACHE, e.name);
      let info;
      try {
        info = await stat(full);
      } catch {
        continue;
      }
      // Fontes de upload (.src) e diretórios de trabalho (.work) órfãos antigos.
      if (e.name.endsWith(".src") || e.name.endsWith(".work")) {
        if (now - info.mtimeMs > 60 * 60 * 1000) {
          await rm(full, { recursive: true, force: true }).catch(() => {});
        }
        continue;
      }
      if (e.isDirectory()) {
        if (now - info.mtimeMs > STEM_TTL_MS) {
          await rm(full, { recursive: true, force: true }).catch(() => {});
        } else {
          dirs.push({ path: full, mtime: info.mtimeMs });
        }
      }
    }
    if (dirs.length > STEM_MAX_DIRS) {
      dirs.sort((a, b) => a.mtime - b.mtime);
      for (const d of dirs.slice(0, dirs.length - STEM_MAX_DIRS)) {
        await rm(d.path, { recursive: true, force: true }).catch(() => {});
      }
    }
  } catch {
    // cache ainda não existe — nada a podar.
  }
}

// Inicia (ou reaproveita) a separação para uma chave. Não bloqueia a resposta:
// o cliente consulta /stems/status. `cleanupSource` apaga o arquivo de origem
// (uploads) após o término, com ou sem sucesso.
function ensureSeparation(
  key: string,
  getSource: () => Promise<string>,
  opts: { cleanupSource?: boolean } = {},
): JobState {
  if (stemsReady(key)) {
    const ready: JobState = { status: "ready" };
    jobs.set(key, ready);
    return ready;
  }
  if (inFlight.has(key)) {
    return jobs.get(key) ?? { status: "processing" };
  }
  void pruneStemCache();
  const state: JobState = { status: "processing" };
  jobs.set(key, state);
  const task = (async () => {
    const src = await getSource();
    try {
      await separate(key, src);
    } finally {
      if (opts.cleanupSource) await rm(src, { force: true }).catch(() => {});
    }
  })();
  inFlight.set(
    key,
    task
      .then(() => {
        jobs.set(key, { status: "ready" });
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[/api/stems] separação falhou (${key}):`, msg);
        jobs.set(key, { status: "error", error: msg.slice(0, 200) });
      })
      .finally(() => {
        inFlight.delete(key);
      }),
  );
  return state;
}

function requireAuth(req: Request, res: Response): boolean {
  const isDev = process.env.NODE_ENV === "development";
  const auth = getAuth(req);
  if (!auth?.userId && !isDev) {
    res.status(401).json({ status: "unauthorized", message: "Faça login para usar o estúdio." });
    return false;
  }
  return true;
}

// ── Preparação a partir do YouTube ────────────────────────────────────────────
router.post("/stems/prepare-yt", express.json({ limit: "1kb" }), (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;
  const id = String((req.body as { id?: unknown })?.id ?? "").trim();
  if (!VIDEO_ID.test(id)) {
    return res.status(400).json({ status: "bad_request", message: "Vídeo inválido." });
  }
  const key = `yt_${id}`;
  const state = ensureSeparation(key, () => ensureYoutubeAudio(id));
  return res.json({ key, status: state.status });
});

// ── Preparação a partir de arquivo enviado (corpo bruto) ──────────────────────
router.post(
  "/stems/prepare-upload",
  express.raw({ type: () => true, limit: "60mb" }),
  async (req: Request, res: Response) => {
    if (!requireAuth(req, res)) return;
    const body = req.body as Buffer;
    if (!Buffer.isBuffer(body) || body.length === 0) {
      return res.status(400).json({ status: "bad_request", message: "Arquivo vazio." });
    }
    if (body.length > MAX_UPLOAD_BYTES) {
      return res.status(413).json({ status: "too_large", message: "Arquivo muito grande." });
    }
    const key = `up_${createHash("sha1").update(body).digest("hex").slice(0, 32)}`;
    if (!stemsReady(key) && !inFlight.has(key)) {
      mkdirSync(STEM_CACHE, { recursive: true });
      const srcPath = join(STEM_CACHE, `${key}.src`);
      try {
        await writeFile(srcPath, body);
      } catch (err) {
        console.error("[/api/stems] falha ao salvar upload:", err);
        return res.status(500).json({ status: "error", message: "Não foi possível preparar." });
      }
      const state = ensureSeparation(key, async () => srcPath, { cleanupSource: true });
      return res.json({ key, status: state.status });
    }
    const state = jobs.get(key) ?? { status: stemsReady(key) ? "ready" : "processing" };
    return res.json({ key, status: state.status });
  },
);

// ── Status do trabalho ────────────────────────────────────────────────────────
router.get("/stems/status", (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;
  const key = String(req.query.key ?? "").trim();
  if (!KEY_RE.test(key)) {
    return res.status(400).json({ status: "bad_request" });
  }
  if (stemsReady(key)) return res.json({ status: "ready" });
  const state = jobs.get(key);
  if (!state) return res.json({ status: "unknown" });
  return res.json({ status: state.status, error: state.error });
});

// ── Entrega da faixa (voz ou sem voz) ─────────────────────────────────────────
router.get("/stems/file", (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;
  const key = String(req.query.key ?? "").trim();
  const mode = String(req.query.mode ?? "").trim() as Mode;
  if (!KEY_RE.test(key) || (mode !== "vocals" && mode !== "instrumental")) {
    return res.status(400).json({ status: "bad_request" });
  }
  const file = stemMp3(key, mode);
  if (!existsSync(file)) {
    return res.status(404).json({ status: "not_ready" });
  }
  const stat = statSync(file);
  const total = stat.size;
  res.setHeader("Content-Type", "audio/mpeg");
  res.setHeader("Cache-Control", "private, max-age=3600");
  // Aceita requisições parciais (Range) para o player poder adiantar/voltar
  // a música sem precisar baixar tudo antes.
  res.setHeader("Accept-Ranges", "bytes");

  const range = req.headers.range;
  const match = range ? /^bytes=(\d*)-(\d*)$/.exec(range) : null;
  if (match) {
    let start = match[1] === "" ? NaN : Number(match[1]);
    let end = match[2] === "" ? NaN : Number(match[2]);
    // Sufixo "bytes=-N": últimos N bytes.
    if (Number.isNaN(start) && !Number.isNaN(end)) {
      start = Math.max(0, total - end);
      end = total - 1;
    } else {
      if (Number.isNaN(start)) start = 0;
      if (Number.isNaN(end) || end >= total) end = total - 1;
    }
    if (start > end || start >= total) {
      res.status(416).setHeader("Content-Range", `bytes */${total}`);
      return res.end();
    }
    res.status(206);
    res.setHeader("Content-Range", `bytes ${start}-${end}/${total}`);
    res.setHeader("Content-Length", String(end - start + 1));
    const stream = createReadStream(file, { start, end });
    stream.on("error", () => {
      if (!res.headersSent) res.status(500).end();
      else res.destroy();
    });
    stream.pipe(res);
    return;
  }

  res.setHeader("Content-Length", String(total));
  const stream = createReadStream(file);
  stream.on("error", () => {
    if (!res.headersSent) res.status(500).end();
    else res.destroy();
  });
  stream.pipe(res);
  return;
});

// ── Batidas (beat tracking) de uma faixa já preparada (HQ) ────────────────────
// Reaproveita o instrumental do cache pela chave — sem reenviar o áudio. O
// resultado fica em cache (beats.json) para não recalcular.
router.get("/stems/beats", async (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;
  const key = String(req.query.key ?? "").trim();
  if (!KEY_RE.test(key)) return res.status(400).json({ ok: false, error: "bad_request" });
  if (!existsSync(stemMp3(key, "instrumental"))) {
    return res.status(404).json({ ok: false, error: "not_ready" });
  }
  const bpmHint = parseBpmHint(req.query.bpm);
  const inFlightKey = `${key}|${bpmHint > 0 ? Math.round(bpmHint) : "auto"}`;
  try {
    let p = beatsInFlight.get(inFlightKey);
    if (!p) {
      p = computeBeatsForKey(key, bpmHint).finally(() => beatsInFlight.delete(inFlightKey));
      beatsInFlight.set(inFlightKey, p);
    }
    const result = await p;
    return res.json({ ok: true, bpm: result.bpm, beats: result.beats, meter: result.meter ?? null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[/api/stems/beats] falhou (${key}):`, msg);
    return res.status(500).json({ ok: false, error: msg.slice(0, 200) });
  }
});

// ── Batidas (beat tracking) de um áudio enviado (modo rápido) ─────────────────
// O instrumental é gerado no navegador; aqui recebemos os bytes (corpo bruto,
// como o prepare-upload) e devolvemos as batidas. Sem cache (efêmero).
router.post(
  "/stems/beats",
  express.raw({ type: () => true, limit: "60mb" }),
  async (req: Request, res: Response) => {
    if (!requireAuth(req, res)) return;
    const body = req.body as Buffer;
    if (!Buffer.isBuffer(body) || body.length === 0) {
      return res.status(400).json({ ok: false, error: "empty" });
    }
    if (body.length > MAX_UPLOAD_BYTES) {
      return res.status(413).json({ ok: false, error: "too_large" });
    }
    const bpmHint = parseBpmHint(req.query.bpm);
    mkdirSync(STEM_CACHE, { recursive: true });
    const stamp = createHash("sha1").update(body).digest("hex").slice(0, 16);
    const srcPath = join(STEM_CACHE, `beats_${stamp}.src`);
    const wavPath = join(STEM_CACHE, `beats_${stamp}.wav`);
    try {
      await writeFile(srcPath, body);
      await transcodeToWavMono(srcPath, wavPath);
      const result = await runBeatDetection(wavPath, bpmHint);
      return res.json({ ok: true, bpm: result.bpm, beats: result.beats, meter: result.meter ?? null });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[/api/stems/beats POST] falhou:", msg);
      return res.status(500).json({ ok: false, error: msg.slice(0, 200) });
    } finally {
      await rm(srcPath, { force: true }).catch(() => {});
      await rm(wavPath, { force: true }).catch(() => {});
    }
  },
);

export default router;
