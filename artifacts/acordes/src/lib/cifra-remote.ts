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
