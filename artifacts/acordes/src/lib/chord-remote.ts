// ─────────────────────────────────────────────────────────────────────────────
// Cliente da análise harmônica profissional (acordes) no servidor.
//
// O detector local (DSP no navegador) tem teto baixo. Quando o usuário está
// logado, mandamos o áudio para o api-server, que roda librosa (HPSS, CQT,
// Krumhansl, Viterbi, baixo invertido e sétimas) e devolve uma cifra muito mais
// precisa. Em qualquer falha, o chamador mantém o resultado local — nunca
// inventamos acordes nem letra.
//
// Base da API: caminho relativo "/api", roteado para o api-server pela
// plataforma em dev e em produção (mesmo padrão da transcrição).
// ─────────────────────────────────────────────────────────────────────────────

import type { DetectedKey, TimedChord } from "./audio-analysis";

const API_BASE = "/api";

interface ServerKey {
  symbol: string;
  tonic: number;
  isMinor: boolean;
  confidence: number;
  ptLabel: string;
}

interface ServerChordResult {
  key: ServerKey | null;
  bpm: number;
  timeline: { symbol: string; start: number; end: number; confidence: number }[];
  chords: string[];
}

export interface RemoteChords {
  key: DetectedKey | null;
  chords: string[];
  chordTimeline: TimedChord[];
}

export type RemoteChordsOutcome =
  | { ok: true; result: RemoteChords }
  | { ok: false; reason: "unauthorized" | "unavailable" | "error" | "network" | "empty" };

// Envia o áudio para análise remota. `bpmHint` (do detector local) ajuda a
// sincronização por batida do servidor. Retorna acordes prontos para substituir
// os locais, ou um motivo de falha para o chamador manter o fallback.
export async function analyzeChordsRemote(
  file: File | Blob,
  bpmHint?: number,
): Promise<RemoteChordsOutcome> {
  try {
    const qs =
      bpmHint && Number.isFinite(bpmHint) && bpmHint > 0
        ? `?bpm=${Math.round(bpmHint)}`
        : "";
    const r = await fetch(`${API_BASE}/chords${qs}`, {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type":
          (file as File).type || "application/octet-stream",
      },
      body: file,
    });

    if (r.status === 401) return { ok: false, reason: "unauthorized" };
    if (r.status === 503) return { ok: false, reason: "unavailable" };
    if (r.status === 400) return { ok: false, reason: "empty" };
    if (!r.ok) return { ok: false, reason: "error" };

    const data = (await r.json()) as ServerChordResult;
    if (!data || !Array.isArray(data.timeline) || !Array.isArray(data.chords)) {
      return { ok: false, reason: "error" };
    }

    const chordTimeline: TimedChord[] = data.timeline.map((t) => ({
      symbol: t.symbol,
      start: t.start,
      end: t.end,
      confidence: t.confidence,
    }));

    return {
      ok: true,
      result: {
        key: data.key,
        chords: data.chords,
        chordTimeline,
      },
    };
  } catch {
    return { ok: false, reason: "network" };
  }
}
