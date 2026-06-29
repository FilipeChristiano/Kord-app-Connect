// ─────────────────────────────────────────────────────────────────────────────
// Cliente da busca de CIFRA PRONTA no servidor.
//
// Em vez de adivinhar os acordes do áudio (impreciso), buscamos uma cifra já
// transcrita por pessoas no CifraClub. O servidor (api-server) faz a busca e o
// download (evita CORS) e devolve um texto editável com acordes sobre a letra.
//
// Nunca inventamos cifra: quando não há resultado, devolvemos { found: false } e
// a tela mostra um aviso e deixa o usuário digitar/ajustar manualmente.
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE = "/api";

export interface FetchedCifra {
  source: string;
  url: string;
  title: string;
  artist: string;
  key: string | null;
  body: string;
  // Áudio da música para ouvir (vídeo público do YouTube). `youtubeId` alimenta o
  // player embed; `youtubeUrl` é o link de reserva (busca quando não há id).
  youtubeId: string | null;
  youtubeUrl: string | null;
}

// Uma versão sugerida da música. `id` é um token opaco — o app nunca expõe a
// origem; apenas mostra título e artista para o usuário escolher.
export interface CifraCandidate {
  id: string;
  title: string;
  artist: string;
}

export type CifraOutcome =
  | { ok: true; found: true; cifra: FetchedCifra }
  | { ok: true; found: false; candidates: CifraCandidate[] }
  | { ok: false; reason: "unauthorized" | "empty" | "error" | "network" };

// Envia a requisição ao servidor e normaliza a resposta. Compartilhado pela
// busca por NOME e pela identificação por LETRA.
async function postCifra(payload: {
  query?: string;
  lyrics?: string;
  pick?: string;
}): Promise<CifraOutcome> {
  try {
    const r = await fetch(`${API_BASE}/cifra`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (r.status === 401) return { ok: false, reason: "unauthorized" };
    if (r.status === 400) return { ok: false, reason: "empty" };
    if (!r.ok) return { ok: false, reason: "error" };

    const data = (await r.json()) as
      | { found: false; candidates?: CifraCandidate[] }
      | ({ found: true } & FetchedCifra);

    if (!data || data.found !== true) {
      const raw = (data as { candidates?: unknown })?.candidates;
      const candidates = Array.isArray(raw)
        ? (raw.filter(
            (c) =>
              c &&
              typeof (c as CifraCandidate).id === "string" &&
              typeof (c as CifraCandidate).title === "string",
          ) as CifraCandidate[])
        : [];
      return { ok: true, found: false, candidates };
    }
    if (typeof data.body !== "string" || data.body.trim().length === 0) {
      return { ok: true, found: false, candidates: [] };
    }

    return {
      ok: true,
      found: true,
      cifra: {
        source: data.source ?? "harmonic",
        url: data.url ?? "",
        title: data.title ?? "",
        artist: data.artist ?? "",
        key: data.key ?? null,
        body: data.body,
        youtubeId:
          typeof data.youtubeId === "string" && data.youtubeId ? data.youtubeId : null,
        youtubeUrl:
          typeof data.youtubeUrl === "string" && data.youtubeUrl ? data.youtubeUrl : null,
      },
    };
  } catch {
    return { ok: false, reason: "network" };
  }
}

// Busca a cifra a partir de um texto livre (idealmente "Artista - Música").
export async function fetchCifra(query: string): Promise<CifraOutcome> {
  const q = query.trim();
  if (!q) return { ok: false, reason: "empty" };
  return postCifra({ query: q });
}

// Identifica a música a partir de um trecho da LETRA (transcrita do áudio/canto)
// e devolve a cifra pronta correspondente.
export async function fetchCifraByLyrics(lyrics: string): Promise<CifraOutcome> {
  const l = lyrics.trim().slice(0, 2000);
  if (!l) return { ok: false, reason: "empty" };
  return postCifra({ lyrics: l });
}

// Carrega a cifra de uma das VERSÕES sugeridas que o usuário escolheu.
export async function pickCifra(id: string): Promise<CifraOutcome> {
  const p = id.trim();
  if (!p) return { ok: false, reason: "empty" };
  return postCifra({ pick: p });
}

export type YoutubeAudioOutcome =
  | { ok: true; blob: Blob }
  | { ok: false; reason: "unauthorized" | "error" | "network" };

// Extrai o áudio da música (vídeo público do YouTube) para usar no estúdio.
// O player embutido não deixa ler as amostras do som, então o servidor baixa a
// faixa de áudio e devolve o arquivo para o app processar localmente.
export async function fetchYoutubeAudio(youtubeId: string): Promise<YoutubeAudioOutcome> {
  const id = youtubeId.trim();
  if (!id) return { ok: false, reason: "error" };
  try {
    const r = await fetch(`${API_BASE}/yt-audio?id=${encodeURIComponent(id)}`, {
      credentials: "include",
    });
    if (r.status === 401) return { ok: false, reason: "unauthorized" };
    if (!r.ok) return { ok: false, reason: "error" };
    const blob = await r.blob();
    if (!blob.size) return { ok: false, reason: "error" };
    return { ok: true, blob };
  } catch {
    return { ok: false, reason: "network" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Estúdio — máxima qualidade (separação completa no servidor).
//
// Fluxo assíncrono: pede a preparação (por id do YouTube ou arquivo enviado),
// consulta o status até ficar pronto e então toca/baixa cada faixa direto da URL
// do arquivo. Uma única preparação gera as DUAS faixas (voz e sem voz).
// ─────────────────────────────────────────────────────────────────────────────
export type StemsPrepareOutcome =
  | { ok: true; key: string; status: "processing" | "ready" }
  | { ok: false; reason: "unauthorized" | "error" | "network" };

export type StemsStatus = "processing" | "ready" | "error" | "unknown";

// Inicia a preparação de máxima qualidade a partir de um vídeo do YouTube.
export async function prepareStemsYoutube(youtubeId: string): Promise<StemsPrepareOutcome> {
  const id = youtubeId.trim();
  if (!id) return { ok: false, reason: "error" };
  try {
    const r = await fetch(`${API_BASE}/stems/prepare-yt`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (r.status === 401) return { ok: false, reason: "unauthorized" };
    if (!r.ok) return { ok: false, reason: "error" };
    const data = (await r.json()) as { key?: string; status?: string };
    if (!data.key) return { ok: false, reason: "error" };
    return { ok: true, key: data.key, status: data.status === "ready" ? "ready" : "processing" };
  } catch {
    return { ok: false, reason: "network" };
  }
}

// Inicia a preparação de máxima qualidade a partir de um arquivo enviado.
export async function prepareStemsUpload(file: File): Promise<StemsPrepareOutcome> {
  try {
    const r = await fetch(`${API_BASE}/stems/prepare-upload`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });
    if (r.status === 401) return { ok: false, reason: "unauthorized" };
    if (!r.ok) return { ok: false, reason: "error" };
    const data = (await r.json()) as { key?: string; status?: string };
    if (!data.key) return { ok: false, reason: "error" };
    return { ok: true, key: data.key, status: data.status === "ready" ? "ready" : "processing" };
  } catch {
    return { ok: false, reason: "network" };
  }
}

// Consulta o andamento da preparação de máxima qualidade.
export async function pollStemsStatus(key: string): Promise<StemsStatus> {
  try {
    const r = await fetch(`${API_BASE}/stems/status?key=${encodeURIComponent(key)}`, {
      credentials: "include",
    });
    if (!r.ok) return "error";
    const data = (await r.json()) as { status?: string };
    if (data.status === "ready") return "ready";
    if (data.status === "error") return "error";
    if (data.status === "unknown") return "unknown";
    return "processing";
  } catch {
    return "error";
  }
}

// URL do arquivo de uma faixa pronta (voz ou sem voz) para tocar/baixar.
export function stemsFileUrl(key: string, mode: "vocals" | "instrumental"): string {
  return `${API_BASE}/stems/file?key=${encodeURIComponent(key)}&mode=${mode}`;
}

// ── Batidas (beat tracking) — rastreamento profissional no servidor ───────────
// Devolve os INSTANTES (s) de cada batida da música, para o metrônomo clicar
// exatamente em cima de cada batida real (em vez de uma grade estimada).
export interface StemBeats {
  bpm: number;
  beats: number[];
  meter: "3/4" | "4/4" | "6/8" | null;
}

function parseBeats(data: unknown): StemBeats | null {
  const d = data as { ok?: boolean; bpm?: number; beats?: unknown; meter?: unknown };
  if (!d?.ok || !Array.isArray(d.beats) || d.beats.length < 2) return null;
  const beats = d.beats.filter((t): t is number => typeof t === "number" && Number.isFinite(t));
  if (beats.length < 2) return null;
  const meter = d.meter === "3/4" || d.meter === "4/4" || d.meter === "6/8" ? d.meter : null;
  return { bpm: typeof d.bpm === "number" && d.bpm > 0 ? d.bpm : 0, beats, meter };
}

// Faixa já preparada (máxima qualidade): reaproveita o instrumental do servidor
// pela chave — não reenvia o áudio.
export async function fetchStemBeats(key: string, bpmHint?: number | null): Promise<StemBeats | null> {
  try {
    const qs = bpmHint && bpmHint > 0 ? `&bpm=${Math.round(bpmHint)}` : "";
    const r = await fetch(`${API_BASE}/stems/beats?key=${encodeURIComponent(key)}${qs}`, {
      credentials: "include",
    });
    if (!r.ok) return null;
    return parseBeats(await r.json());
  } catch {
    return null;
  }
}

// Áudio gerado no navegador (modo rápido): envia os bytes do instrumental.
export async function analyzeBeatsBlob(blob: Blob, bpmHint?: number | null): Promise<StemBeats | null> {
  try {
    const qs = bpmHint && bpmHint > 0 ? `?bpm=${Math.round(bpmHint)}` : "";
    const r = await fetch(`${API_BASE}/stems/beats${qs}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": blob.type || "application/octet-stream" },
      body: blob,
    });
    if (!r.ok) return null;
    return parseBeats(await r.json());
  } catch {
    return null;
  }
}
