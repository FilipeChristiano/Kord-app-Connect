// ─────────────────────────────────────────────────────────────────────────────
// Cliente da transcrição automática de letra.
//
// O processamento pesado (Demucs + Faster-Whisper) roda num worker externo
// plugável. Aqui só falamos com o nosso api-server, que encaminha para o worker
// quando ele estiver configurado. Se não houver worker, recebemos um status
// honesto — nunca simulamos nem inventamos letra.
//
// A base da API é a mesma do cliente gerado (Orval): caminho relativo "/api",
// roteado para o api-server pela plataforma tanto em dev quanto em produção.
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE = "/api";

// Palavra transcrita com tempo (em segundos) — base para alinhar acordes.
export interface TranscriptionWord {
  text: string;
  start: number;
  end: number;
  confidence?: number; // 0..1 (opcional; usado para marcar trechos incertos)
}

// Linha/segmento da letra.
export interface TranscriptionLine {
  text: string;
  start: number;
  end: number;
  words: TranscriptionWord[];
}

export interface TranscriptionResult {
  language?: string;
  text: string;
  lines: TranscriptionLine[];
}

export type TranscribeOutcome =
  | { ok: true; result: TranscriptionResult }
  | {
      ok: false;
      reason: "external_processing_required" | "worker_error" | "network" | "unauthorized" | "empty";
      message: string;
    };

// Verifica se o worker de transcrição está disponível neste ambiente.
export async function getTranscriptionStatus(): Promise<{ available: boolean }> {
  try {
    const r = await fetch(`${API_BASE}/transcribe/status`, { credentials: "include" });
    if (!r.ok) return { available: false };
    const data = (await r.json()) as { available?: boolean };
    return { available: Boolean(data.available) };
  } catch {
    return { available: false };
  }
}

// Envia o áudio para transcrição. Retorna um resultado tipado ou um motivo claro
// de indisponibilidade (sem inventar letra).
export async function transcribeAudio(file: File): Promise<TranscribeOutcome> {
  try {
    const r = await fetch(`${API_BASE}/transcribe`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": file.type || "application/octet-stream" },
      body: file,
    });

    if (r.status === 401) {
      return { ok: false, reason: "unauthorized", message: "Faça login para usar a transcrição automática." };
    }
    if (r.status === 503) {
      const j = (await r.json().catch(() => ({}))) as { message?: string };
      return {
        ok: false,
        reason: "external_processing_required",
        message: j.message ?? "Transcrição automática exige processamento externo.",
      };
    }
    if (r.status === 400) {
      return { ok: false, reason: "empty", message: "Nenhum áudio para transcrever." };
    }
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { message?: string };
      return { ok: false, reason: "worker_error", message: j.message ?? "Falha no serviço de transcrição." };
    }

    const result = (await r.json()) as TranscriptionResult;
    if (!result || !Array.isArray(result.lines)) {
      return { ok: false, reason: "worker_error", message: "Resposta de transcrição inválida." };
    }
    return { ok: true, result };
  } catch {
    return { ok: false, reason: "network", message: "Não foi possível contatar o serviço de transcrição." };
  }
}
