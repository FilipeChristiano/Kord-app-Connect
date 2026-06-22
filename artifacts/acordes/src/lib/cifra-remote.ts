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

export type CifraOutcome =
  | { ok: true; found: true; cifra: FetchedCifra }
  | { ok: true; found: false }
  | { ok: false; reason: "unauthorized" | "empty" | "error" | "network" };

// Busca a cifra a partir de um texto livre (idealmente "Artista - Música").
export async function fetchCifra(query: string): Promise<CifraOutcome> {
  const q = query.trim();
  if (!q) return { ok: false, reason: "empty" };

  try {
    const r = await fetch(`${API_BASE}/cifra`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: q }),
    });

    if (r.status === 401) return { ok: false, reason: "unauthorized" };
    if (r.status === 400) return { ok: false, reason: "empty" };
    if (!r.ok) return { ok: false, reason: "error" };

    const data = (await r.json()) as
      | { found: false }
      | ({ found: true } & FetchedCifra);

    if (!data || data.found !== true) return { ok: true, found: false };
    if (typeof data.body !== "string" || data.body.trim().length === 0) {
      return { ok: true, found: false };
    }

    return {
      ok: true,
      found: true,
      cifra: {
        source: data.source ?? "cifraclub",
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
