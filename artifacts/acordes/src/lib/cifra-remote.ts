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
