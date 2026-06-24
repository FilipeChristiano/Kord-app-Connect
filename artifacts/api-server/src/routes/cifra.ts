import express, { Router, type IRouter, type Request, type Response } from "express";
import { getAuth } from "@clerk/express";

// ─────────────────────────────────────────────────────────────────────────────
// Busca de CIFRA PRONTA (feita por humanos) no CifraClub.
//
// Em vez de tentar adivinhar os acordes do áudio (impreciso), buscamos uma
// cifra já transcrita por pessoas. Como os buscadores públicos bloqueiam
// scraping de forma agressiva, usamos uma CADEIA de estratégias, da mais
// confiável para a reserva:
//
// 1) URL direta: as páginas do CifraClub seguem /<artista>/<musica>/. A partir
//    de "Artista - Música" montamos o slug e tentamos as duas ordens.
// 2) Página do artista: se o artista existe mas o slug da música variou, a
//    página do artista lista as músicas — casamos por aproximação.
// 3) DuckDuckGo HTML (reserva, melhor esforço) para casos sem separador.
//
// Sempre lemos a página de impressão `.../imprimir.html` (traz TOM + um <pre>
// com os acordes sobre a letra). Nunca inventamos: se nada resolver, devolvemos
// { found: false } e o cliente mostra um aviso e deixa editar manualmente.
// ─────────────────────────────────────────────────────────────────────────────

const router: IRouter = Router();

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// Segundos segmentos de URL que NÃO são músicas.
const NON_SONG = new Set([
  "discografia", "perfil", "album", "letra", "letras", "aprenda", "videoaulas",
  "fotos", "noticias", "playlist", "mais-acessadas", "musico", "palheta",
  "novidades", "tons", "simplificada", "imprimir",
]);

interface CifraHit {
  artist: string;
  song: string;
}

interface Parsed {
  url: string;
  title: string;
  artist: string;
  key: string | null;
  body: string;
}

// Slug no padrão do CifraClub: minúsculo, sem acentos, separado por hífen.
function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " e ")
    .replace(/['\u2019]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Tokens de "ruído" que costumam aparecer em títulos copiados do YouTube/etc.,
// mas NÃO fazem parte do nome da música ("Jó - COM LETRA - MK MUSIC" → "Jó").
const NOISE_TOKENS = new Set([
  "com", "letra", "letras", "legendado", "legendada", "oficial", "official",
  "video", "videoclipe", "clipe", "lyric", "lyrics", "lyricvideo", "ao", "vivo",
  "aovivo", "live", "playback", "cover", "acustico", "acustica", "hd", "hq",
  "4k", "audio", "mk", "music", "gospel", "original", "feat", "ft",
]);

// Remove tokens de ruído do FINAL de um slug, preservando o nome real da música.
// Só corta no fim para não estragar nomes que contenham essas palavras no meio.
function stripTrailingNoise(slug: string): string {
  const toks = slug.split("-").filter(Boolean);
  while (toks.length > 1 && NOISE_TOKENS.has(toks[toks.length - 1])) toks.pop();
  return toks.join("-");
}

// Decodifica entidades HTML mais comuns + numéricas.
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_m, d: string) => {
      const code = Number(d);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _m;
    })
    .replace(/&#x([0-9a-f]+);/gi, (_m, h: string) => String.fromCodePoint(parseInt(h, 16)));
}

// Lê o TOM a partir de "tom:" (pode ter tags no meio).
function parseKey(html: string): string | null {
  const idx = html.toLowerCase().indexOf("tom:");
  if (idx === -1) return null;
  const window = html.slice(idx + 4, idx + 120).replace(/<[^>]+>/g, " ");
  const m = window.match(/([A-G][#b]?m?)\b/);
  return m ? m[1] : null;
}

// Converte o bloco <pre> em texto limpo, preservando o alinhamento monoespaçado
// (acordes sobre a letra) e descartando linhas de TABLATURA (riffs).
function parseBody(html: string): string | null {
  const m = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
  if (!m) return null;
  let body = m[1].replace(/<[^>]+>/g, "");
  body = decodeEntities(body);
  const isTabLine = (l: string) =>
    /^\s*[EADGBe]\|/.test(l) ||
    /^\s*\[tab\b/i.test(l) ||
    /^\s*parte\s+\d+\s+de\s+\d+\s*$/i.test(l);
  body = body
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/[ \t]+$/g, ""))
    .filter((l) => !isTabLine(l))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return body || null;
}

function prettySlug(slug: string): string {
  return slug
    .split("-")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

// Conectores que ficam em minúsculo no meio de um título.
const LOWER_WORDS = new Set([
  "a", "e", "o", "as", "os", "de", "da", "do", "das", "dos", "em", "no", "na",
  "nos", "nas", "com", "para", "pra", "por", "ao", "aos", "à", "às", "que",
]);

// Transforma um slug em texto legível, deixando conectores em minúsculo
// (exceto a primeira palavra). Ex.: "celebrai-a-cristo" → "Celebrai a Cristo".
function humanizeSlug(slug: string): string {
  const words = slug.split("-").filter(Boolean);
  return words
    .map((w, i) => {
      if (i > 0 && LOWER_WORDS.has(w)) return w;
      return w[0].toUpperCase() + w.slice(1);
    })
    .join(" ");
}

// Extrai "Música" e "Artista" legíveis (com acentos) do og:title quando houver.
function parseTitleArtist(html: string, hit: CifraHit): { title: string; artist: string } {
  let title = prettySlug(hit.song);
  let artist = prettySlug(hit.artist);
  const og = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i);
  const raw = og ? decodeEntities(og[1]) : "";
  const cleaned = raw.replace(/\s*-\s*Cifra\s*Club.*$/i, "").trim();
  const dash = cleaned.split(/\s+-\s+/);
  if (dash.length >= 2) {
    title = dash[0].trim() || title;
    artist = dash[1].trim() || artist;
  } else if (cleaned) {
    title = cleaned;
  }
  return { title, artist };
}

async function fetchText(url: string, timeoutMs: number): Promise<{ ok: boolean; status: number; text: string }> {
  try {
    const r = await fetch(url, {
      headers: {
        "user-agent": UA,
        "accept-language": "pt-BR,pt;q=0.9,en;q=0.8",
        accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    return { ok: r.ok, status: r.status, text: await r.text() };
  } catch {
    return { ok: false, status: 0, text: "" };
  }
}

// Tenta a página de impressão de uma música; só conta se tiver o <pre> da cifra.
async function fetchPrint(artist: string, song: string): Promise<Parsed | null> {
  if (!artist || !song) return null;
  const printUrl = `https://www.cifraclub.com.br/${artist}/${song}/imprimir.html`;
  const page = await fetchText(printUrl, 18000);
  if (!page.ok || !page.text) return null;
  const body = parseBody(page.text);
  if (!body) return null;
  const { title, artist: a } = parseTitleArtist(page.text, { artist, song });
  return {
    url: `https://www.cifraclub.com.br/${artist}/${song}/`,
    title,
    artist: a,
    key: parseKey(page.text),
    body,
  };
}

// Lista os slugs de músicas de um artista a partir da página dele.
function artistSongSlugs(html: string, artist: string): string[] {
  const re = new RegExp(
    `href="(?:https://www\\.cifraclub\\.com\\.br)?/${artist}/([a-z0-9][a-z0-9-]*)/?"`,
    "gi",
  );
  const set = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const s = m[1].toLowerCase();
    if (!NON_SONG.has(s)) set.add(s);
  }
  return [...set];
}

// Escolhe o melhor slug de música entre os candidatos, por sobreposição de
// tokens com o que o usuário pediu.
function bestSongMatch(wantSlug: string, candidates: string[]): string | null {
  if (candidates.includes(wantSlug)) return wantSlug;
  // Ignora tokens de ruído ao pontuar, para o limiar não ser inflado por eles.
  const want = new Set(
    wantSlug.split("-").filter((t) => t && !NOISE_TOKENS.has(t)),
  );
  if (want.size === 0) return null;
  let best: string | null = null;
  let bestScore = 0;
  for (const c of candidates) {
    if (c.startsWith(wantSlug) || wantSlug.startsWith(c)) return c;
    const toks = c.split("-").filter(Boolean);
    const shared = toks.filter((t) => want.has(t)).length;
    if (shared > bestScore) {
      bestScore = shared;
      best = c;
    }
  }
  // Exige casar pelo menos metade dos tokens pedidos (mínimo 1).
  return bestScore >= Math.max(1, Math.ceil(want.size / 2)) ? best : null;
}

// Resultados /artista/musica/ no HTML do DuckDuckGo (distintos, em ordem).
function ddgHits(html: string, max = 8): CifraHit[] {
  const re = /cifraclub\.com\.br(?:%2F|\/)([a-z0-9][a-z0-9-]*)(?:%2F|\/)([a-z0-9][a-z0-9-]*)/gi;
  const out: CifraHit[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null && out.length < max) {
    const artist = m[1].toLowerCase();
    const song = m[2].toLowerCase();
    if (NON_SONG.has(song) || NON_SONG.has(artist) || artist === "www" || artist === "img") continue;
    const key = `${artist}/${song}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ artist, song });
  }
  return out;
}

function ddgFirstHit(html: string): CifraHit | null {
  return ddgHits(html, 1)[0] ?? null;
}

// ─── Versões sugeridas (candidatos) ──────────────────────────────────────────
// Um "candidato" é uma versão da música que o usuário pode escolher. Para o app
// transmitir uma INTELIGÊNCIA que detecta a cifra, o cliente recebe apenas
// { id, title, artist } — nunca a origem nem a URL. O `id` é um token opaco que
// guarda internamente o par artista/música para resolver a cifra na escolha.
export interface Candidate {
  id: string;
  title: string;
  artist: string;
}

function encodePick(hit: CifraHit): string {
  return Buffer.from(`${hit.artist}/${hit.song}`, "utf8").toString("base64url");
}

function decodePick(id: string): CifraHit | null {
  try {
    const raw = Buffer.from(id, "base64url").toString("utf8");
    const slash = raw.indexOf("/");
    if (slash <= 0) return null;
    const artist = raw.slice(0, slash);
    const song = raw.slice(slash + 1);
    if (!/^[a-z0-9-]+$/.test(artist) || !/^[a-z0-9-]+$/.test(song)) return null;
    return { artist, song };
  } catch {
    return null;
  }
}

function hitToCandidate(hit: CifraHit): Candidate {
  return {
    id: encodePick(hit),
    title: humanizeSlug(hit.song),
    artist: humanizeSlug(hit.artist),
  };
}

// Reúne algumas versões da música a partir do nome e/ou de um trecho da letra.
// Combina a página do artista (quando há "Artista - Música") com os resultados
// do DuckDuckGo. Devolve candidatos distintos, sem fazer download de cada cifra
// (a cifra só é baixada quando o usuário escolhe uma versão).
async function gatherCandidates(opts: { query?: string; lyrics?: string }): Promise<Candidate[]> {
  const hits: CifraHit[] = [];
  const seen = new Set<string>();
  const add = (h: CifraHit) => {
    const k = `${h.artist}/${h.song}`;
    if (!seen.has(k)) {
      seen.add(k);
      hits.push(h);
    }
  };

  // 1) Quando há "Artista - Música", lista músicas próximas na página do artista.
  if (opts.query) {
    const { a, b } = splitQuery(opts.query);
    if (a && b) {
      const sa = slugify(a);
      const sb = slugify(b);
      for (const [artistSlug, songSlug] of [
        [sa, stripTrailingNoise(sb) || sb],
        [sb, stripTrailingNoise(sa) || sa],
      ]) {
        const ap = await fetchText(`https://www.cifraclub.com.br/${artistSlug}/`, 12000);
        if (!ap.ok || !ap.text) continue;
        const cands = artistSongSlugs(ap.text, artistSlug);
        const wantToks = new Set(songSlug.split("-").filter((t) => t && !NOISE_TOKENS.has(t)));
        for (const c of cands) {
          const toks = c.split("-").filter(Boolean);
          const shared = toks.filter((t) => wantToks.has(t)).length;
          if (shared >= 1) add({ artist: artistSlug, song: c });
        }
      }
    }
  }

  // 2) DuckDuckGo (várias ocorrências) pelo nome e/ou pela letra.
  const ddgQueries: string[] = [];
  if (opts.query) ddgQueries.push(`site:cifraclub.com.br ${opts.query}`);
  if (opts.lyrics) {
    const snippet = lyricsSnippet(opts.lyrics);
    if (snippet) {
      ddgQueries.push(`site:cifraclub.com.br "${snippet}"`);
      ddgQueries.push(`site:cifraclub.com.br ${snippet}`);
    }
  }
  for (const q of ddgQueries) {
    if (hits.length >= 6) break;
    const ddg = await fetchText(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`,
      15000,
    );
    if (!ddg.text || ddg.text.toLowerCase().includes("anomaly")) continue;
    for (const h of ddgHits(ddg.text, 8)) add(h);
  }

  return hits.slice(0, 5).map(hitToCandidate);
}

// Separa "Artista - Música" (vários tipos de traço).
function splitQuery(q: string): { a?: string; b?: string } {
  const parts = q.split(/\s+[-–—]\s+/);
  if (parts.length >= 2) {
    return { a: parts[0].trim(), b: parts.slice(1).join(" - ").trim() };
  }
  return {};
}

// Extrai um trecho distintivo da letra (transcrita do áudio/canto) para buscar
// a música. Remove marcações de seção e excesso de espaços, e pega as primeiras
// palavras — o bastante para um buscador identificar a música sem ruído.
function lyricsSnippet(lyrics: string): string {
  const clean = lyrics
    .replace(/\[[^\]]*\]/g, " ") // tira [Intro], [Refrão] etc.
    .replace(/[“”"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = clean.split(" ").filter(Boolean);
  return words.slice(0, 10).join(" ");
}

// Identifica a música a partir de um trecho da LETRA (não do nome). Pesquisa no
// DuckDuckGo restringindo ao CifraClub e segue o primeiro resultado /artista/musica/.
async function resolveCifraByLyrics(lyrics: string): Promise<Parsed | null> {
  const snippet = lyricsSnippet(lyrics);
  if (!snippet) return null;
  const queries = [
    `site:cifraclub.com.br "${snippet}"`,
    `site:cifraclub.com.br ${snippet}`,
    `${snippet} cifra cifraclub`,
  ];
  for (const q of queries) {
    const ddg = await fetchText(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`,
      18000,
    );
    if (!ddg.text || ddg.text.toLowerCase().includes("anomaly")) continue;
    const hit = ddgFirstHit(ddg.text);
    if (hit) {
      const got = await fetchPrint(hit.artist, hit.song);
      if (got) return got;
    }
  }
  return null;
}

async function resolveCifra(query: string): Promise<Parsed | null> {
  const { a, b } = splitQuery(query);

  // 1) URL direta nas duas ordens (Artista-Música e Música-Artista).
  if (a && b) {
    const sa = slugify(a);
    const sb = slugify(b);
    // Versões sem ruído ("jo-com-letra-mk-music" → "jo"). Usadas como FALLBACK,
    // depois do slug bruto, para não estragar títulos que tenham esses tokens.
    const saClean = stripTrailingNoise(sa) || sa;
    const sbClean = stripTrailingNoise(sb) || sb;
    const direct =
      (await fetchPrint(sa, sb)) ||
      (sbClean !== sb ? await fetchPrint(sa, sbClean) : null) ||
      (await fetchPrint(sb, sa)) ||
      (saClean !== sa ? await fetchPrint(sb, saClean) : null);
    if (direct) return direct;

    // 2) Página do artista + casamento aproximado, nas duas ordens reais
    //    (a como artista / b como artista). bestSongMatch já ignora ruído.
    for (const [artistSlug, songSlug] of [
      [sa, sbClean],
      [sb, saClean],
    ]) {
      const ap = await fetchText(`https://www.cifraclub.com.br/${artistSlug}/`, 15000);
      if (!ap.ok || !ap.text) continue;
      const cands = artistSongSlugs(ap.text, artistSlug);
      const best = bestSongMatch(songSlug, cands);
      if (best) {
        const got = await fetchPrint(artistSlug, best);
        if (got) return got;
      }
    }
  }

  // 3) DuckDuckGo (reserva, melhor esforço).
  const ddg = await fetchText(
    `https://html.duckduckgo.com/html/?q=${encodeURIComponent("site:cifraclub.com.br " + query)}`,
    18000,
  );
  if (ddg.text && !ddg.text.toLowerCase().includes("anomaly")) {
    const hit = ddgFirstHit(ddg.text);
    if (hit) {
      const got = await fetchPrint(hit.artist, hit.song);
      if (got) return got;
    }
  }

  return null;
}

router.post("/cifra", express.json({ limit: "16kb" }), async (req: Request, res: Response) => {
  // No preview de desenvolvimento o app roda dentro de um iframe e os cookies de
  // login do Clerk são bloqueados por serem de "terceiros" — então getAuth() não
  // enxerga a sessão e toda busca cairia em 401. Espelhamos o PREVIEW_MODE do
  // frontend e liberamos a busca em dev. Em produção (NODE_ENV=production) o
  // acesso continua exigindo login.
  const isDev = process.env.NODE_ENV === "development";
  const auth = getAuth(req);
  if (!auth?.userId && !isDev) {
    return res
      .status(401)
      .json({ status: "unauthorized", message: "Faça login para buscar a cifra." });
  }

  const body = (req.body ?? {}) as { query?: unknown; lyrics?: unknown; pick?: unknown };
  const query = String(body.query ?? "").trim();
  const lyrics = String(body.lyrics ?? "").trim();
  const pick = String(body.pick ?? "").trim();
  if (!query && !lyrics && !pick) {
    return res
      .status(400)
      .json({ status: "empty_query", message: "Informe o nome da música ou um trecho da letra." });
  }

  // Resposta enxuta ao cliente: nunca expõe a origem nem a URL — o app apresenta
  // a cifra como detectada por ele.
  const toClient = (p: Parsed) => ({
    found: true as const,
    source: "harmonic",
    title: p.title,
    artist: p.artist,
    key: p.key,
    body: p.body,
  });

  try {
    // O usuário escolheu uma das versões sugeridas → baixa a cifra dessa versão.
    if (pick) {
      const hit = decodePick(pick);
      const got = hit ? await fetchPrint(hit.artist, hit.song) : null;
      if (!got) return res.status(200).json({ found: false, candidates: [] });
      return res.status(200).json(toClient(got));
    }

    // Quando vem a LETRA (transcrita do áudio/canto), identificamos pela letra.
    // Caso contrário, busca pelo nome ("Artista - Música").
    const parsed = lyrics ? await resolveCifraByLyrics(lyrics) : await resolveCifra(query);
    if (!parsed) {
      // Sem um casamento confiável: oferece algumas VERSÕES para o usuário escolher.
      const candidates = await gatherCandidates({ query: query || undefined, lyrics: lyrics || undefined });
      return res.status(200).json({ found: false, candidates });
    }
    return res.status(200).json(toClient(parsed));
  } catch (err) {
    console.error("[/api/cifra] error:", err instanceof Error ? err.message : err);
    return res
      .status(502)
      .json({ status: "fetch_failed", message: "Não foi possível buscar a cifra agora." });
  }
});

export default router;
