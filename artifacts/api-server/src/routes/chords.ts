import express, { Router, type IRouter, type Request, type Response } from "express";
import { getAuth } from "@clerk/express";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";

// ─────────────────────────────────────────────────────────────────────────────
// Análise harmônica profissional (acordes) no servidor.
//
// O detector do navegador (DSP feito à mão) tem teto baixo. Aqui rodamos um
// script Python com librosa: separação harmônico/percussiva (remove bateria),
// correção de afinação, cromagrama por CQT, sincronização por batida, detecção
// de tom, casamento com tríades + bônus do campo harmônico, suavização Viterbi
// (sequência coerente) e enriquecimento com baixo invertido e sétimas.
//
// O cliente envia o áudio (mesmo formato do /transcribe) e, opcionalmente, um
// palpite de BPM. Respondemos { key, bpm, timeline, chords }. Se o Python não
// estiver disponível, devolvemos 503 e o cliente cai no detector local.
// ─────────────────────────────────────────────────────────────────────────────

const router: IRouter = Router();

// Localiza a raiz do workspace (onde ficam .pythonlibs e o cache do numba)
// subindo a partir do diretório atual.
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

function scriptPath(): string {
  // Em dev roda via tsx (src); resolvemos a partir da raiz do workspace.
  const candidates = [
    join(WORKSPACE_ROOT, "artifacts", "api-server", "scripts", "chord_analyze.py"),
    resolve(process.cwd(), "scripts", "chord_analyze.py"),
    resolve(process.cwd(), "..", "scripts", "chord_analyze.py"),
  ];
  for (const c of candidates) if (existsSync(c)) return c;
  return candidates[0];
}

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

// Transcoda para WAV mono 22050 Hz (formato que o librosa lê rápido via
// soundfile, sem depender do audioread/ffmpeg dentro do Python).
function transcodeToWav(inPath: string, outPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const p = spawn("ffmpeg", [
      "-y", "-i", inPath, "-ac", "1", "-ar", "22050", "-f", "wav", outPath,
    ]);
    p.on("close", (code) => resolve(code === 0));
    p.on("error", () => resolve(false));
  });
}

interface ChordResult {
  key: {
    symbol: string;
    tonic: number;
    isMinor: boolean;
    confidence: number;
    ptLabel: string;
  } | null;
  bpm: number;
  timeline: { symbol: string; start: number; end: number; confidence: number }[];
  chords: string[];
}

function runAnalyzer(wavPath: string, bpm?: number): Promise<ChordResult> {
  return new Promise((resolvePromise, reject) => {
    const args = [scriptPath(), wavPath];
    if (bpm && Number.isFinite(bpm) && bpm > 0) args.push("--bpm", String(bpm));
    const p = spawn(pythonBin(), args, {
      cwd: WORKSPACE_ROOT,
      env: {
        ...process.env,
        NUMBA_CACHE_DIR: join(WORKSPACE_ROOT, ".cache", "numba"),
        MPLCONFIGDIR: join(WORKSPACE_ROOT, ".cache", "mpl"),
      },
    });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      p.kill("SIGKILL");
      reject(new Error("timeout"));
    }, 4 * 60 * 1000);
    p.stdout.on("data", (d) => (out += d.toString()));
    p.stderr.on("data", (d) => (err += d.toString()));
    p.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    p.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        return reject(new Error(`analyzer exited ${code}: ${err.slice(0, 400)}`));
      }
      try {
        resolvePromise(JSON.parse(out) as ChordResult);
      } catch {
        reject(new Error("invalid analyzer output"));
      }
    });
  });
}

router.post(
  "/chords",
  express.raw({ type: () => true, limit: "60mb" }),
  async (req: Request, res: Response) => {
    const auth = getAuth(req);
    if (!auth?.userId) {
      return res
        .status(401)
        .json({ status: "unauthorized", message: "Faça login para analisar os acordes." });
    }

    const body = req.body as Buffer | undefined;
    if (!body || body.length === 0) {
      return res.status(400).json({ status: "empty_audio", message: "Nenhum áudio recebido." });
    }

    const contentType = String(req.headers["content-type"] ?? "application/octet-stream");
    const bpmHeader = Number(req.query.bpm ?? req.headers["x-bpm-hint"]);
    const ext = extFromContentType(contentType);

    const inPath = join(tmpdir(), `ch-in-${randomUUID()}.${ext}`);
    const wavPath = join(tmpdir(), `ch-out-${randomUUID()}.wav`);
    try {
      await writeFile(inPath, body);
      const ok = await transcodeToWav(inPath, wavPath);
      const target = ok ? wavPath : inPath;
      const result = await runAnalyzer(target, Number.isFinite(bpmHeader) ? bpmHeader : undefined);
      return res.status(200).json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const missing =
        msg.includes("ENOENT") || msg.includes("No module") || msg.includes("python");
      console.error("[/api/chords] error:", msg);
      return res.status(missing ? 503 : 502).json({
        status: missing ? "chord_engine_unavailable" : "analysis_error",
        message: "Não foi possível analisar os acordes no servidor.",
      });
    } finally {
      await unlink(inPath).catch(() => {});
      await unlink(wavPath).catch(() => {});
    }
  },
);

export default router;
