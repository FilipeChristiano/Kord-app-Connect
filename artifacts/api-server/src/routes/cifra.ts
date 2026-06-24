import express, { Router, type IRouter, type Request, type Response } from "express";
import { getAuth } from "@clerk/express";
import { getOpenAI } from "../lib/openai-client";

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

// ─── Busca pela base do CifraClub (Solr) ─────────────────────────────────────
// Fonte primária e confiável de detecção: o índice de busca do próprio CifraClub
// (mesmo usado pelo site). Retorna o slug do artista (`d`), o slug da música
// (`u`), o título real (`m`) e o nome do artista (`a`). É bem mais estável que
// raspar buscadores genéricos (que costumam responder com CAPTCHA/anomaly).
interface SolrSong {
  artist: string; // slug do artista
  song: string; // slug da música
  title: string; // título legível
  artistName: string; // nome legível do artista
}

async function solrSearch(query: string, max = 8): Promise<SolrSong[]> {
  const q = query.trim();
  if (!q) return [];
  const r = await fetchText(
    `https://solr.sscdn.co/cc/h2/?q=${encodeURIComponent(q)}`,
    12000,
  );
  if (!r.text) return [];
  // A resposta vem embrulhada como JSONP: "(​{…})". Remove o invólucro.
  const jsonText = r.text.trim().replace(/^\(/, "").replace(/\)\s*;?\s*$/, "");
  let docs: unknown;
  try {
    docs = (JSON.parse(jsonText) as { response?: { docs?: unknown } })?.response?.docs;
  } catch {
    return [];
  }
  if (!Array.isArray(docs)) return [];

  const out: SolrSong[] = [];
  const seen = new Set<string>();
  for (const raw of docs) {
    const d = raw as { d?: unknown; u?: unknown; m?: unknown; a?: unknown };
    const artist = String(d.d ?? "").toLowerCase();
    const song = String(d.u ?? "").toLowerCase();
    if (!/^[a-z0-9-]+$/.test(artist) || !/^[a-z0-9-]+$/.test(song)) continue;
    const key = `${artist}/${song}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const title = String(d.m ?? "").trim() || humanizeSlug(song);
    const artistName = String(d.a ?? "").trim() || humanizeSlug(artist);
    out.push({ artist, song, title, artistName });
    if (out.length >= max) break;
  }
  return out;
}

function solrToCandidate(s: SolrSong): Candidate {
  return {
    id: encodePick({ artist: s.artist, song: s.song }),
    title: s.title,
    artist: s.artistName,
  };
}

// ─── Identificação por LETRA via base musical (Deezer) ───────────────────────
// O índice do CifraClub (Solr) acha a música pelo NOME, mas não pela letra
// inteira. Quando o trecho cantado NÃO contém o título (ex.: "Atos 2" começa em
// "nós estamos aqui..."), a busca aberta do Deezer — que indexa a letra — devolve
// o nome/artista certo a partir do trecho. Em seguida confirmamos a cifra no
// próprio CifraClub. Nada disso vaza ao cliente: usamos só para descobrir o
// título/artista e devolver a cifra como detecção do app.
interface DeezerSong {
  title: string;
  artist: string;
}

// Limpa sufixos do título do Deezer ("(Ao Vivo)", "[Playback]", "feat. ...",
// "- Live") para casar melhor com o índice do CifraClub.
function cleanDeezerTitle(t: string): string {
  return t
    .replace(/\s*[([][^)\]]*[)\]]/g, " ")
    .replace(/\s*[-–—]\s*(ao vivo|aovivo|playback|live|remix|vers[aã]o).*$/i, "")
    .replace(/\s+feat\.?\s+.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Normaliza nomes para comparação tolerante (sem acento, minúsculo, só letras/números).
function normName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// O artista do Deezer e o do CifraClub batem? (igual, um contém o outro, ou
// compartilham um token significativo).
function artistMatches(a: string, b: string): boolean {
  const na = normName(a);
  const nb = normName(b);
  if (!na || !nb) return false;
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;
  const setA = new Set(na.split(" ").filter((t) => t.length > 2));
  const shared = nb.split(" ").filter((t) => t.length > 2 && setA.has(t)).length;
  return shared >= 1;
}

async function deezerSearch(query: string, max = 8): Promise<DeezerSong[]> {
  const q = query.trim();
  if (!q) return [];
  const r = await fetchText(
    `https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=${max}`,
    10000,
  );
  if (!r.text) return [];
  let data: unknown;
  try {
    data = (JSON.parse(r.text) as { data?: unknown }).data;
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const out: DeezerSong[] = [];
  const seen = new Set<string>();
  for (const raw of data) {
    const t = raw as { title?: unknown; artist?: { name?: unknown } };
    const title = cleanDeezerTitle(String(t.title ?? ""));
    const artist = String(t.artist?.name ?? "").trim();
    if (!title || !artist) continue;
    const key = `${title}|${artist}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ title, artist });
    if (out.length >= max) break;
  }
  return out;
}

// Confirma uma música (título + artista) na base do CifraClub (Solr): a cifra
// precisa EXISTIR e o artista precisa bater. Evita inventar músicas que o
// identificador (LLM/Deezer) possa ter alucinado. Devolve o candidato pronto.
async function confirmSong(title: string, artist: string): Promise<Candidate | null> {
  const base = cleanDeezerTitle(title);
  if (!base) return null;
  let hits = await solrSearch(`${base} ${artist}`, 5);
  if (!hits.length) hits = await solrSearch(base, 5);
  // O título do CifraClub bate com o que buscamos? (evita aceitar um único
  // resultado solto que, por acaso, seja de OUTRA música.)
  const nbase = normName(base);
  const titleClose = (h: SolrSong) => {
    const nt = normName(h.title);
    return nt === nbase || nt.includes(nbase) || nbase.includes(nt);
  };
  // Preferimos o artista que bate; como reserva, aceitamos um único resultado
  // SÓ se o título também for compatível.
  const match =
    hits.find((h) => artistMatches(h.artistName, artist) && titleClose(h)) ??
    hits.find((h) => artistMatches(h.artistName, artist)) ??
    (hits.length === 1 && titleClose(hits[0]) ? hits[0] : undefined);
  return match ? solrToCandidate(match) : null;
}

// ─── Identificação por LETRA via IA (OpenAI, proxy gerenciado pelo Replit) ────
// O ponto fraco da busca textual (Deezer/Solr) é que o trecho CANTADO chega
// transcrito de forma imperfeita — sem acentos, com palavras trocadas — e a
// busca literal erra ("nos estamos aqui tao sedentos" deixa de casar "Atos 2").
//
// A IA NÃO é confiável para ADIVINHAR a música (chuta louvores de tema parecido).
// Mas é ótima no que importa aqui: CORRIGIR a transcrição do canto — devolver os
// acentos e a grafia certa, sem mudar as palavras. Com o trecho corrigido, o
// Deezer (que indexa a letra) identifica a música com precisão. É esse o papel da
// IA: limpar a transcrição, não identificar.
async function llmCleanLyrics(lyrics: string): Promise<string> {
  const openai = getOpenAI();
  if (!openai) return "";
  const snippet = lyricsSnippet(lyrics, 16);
  if (!snippet) return "";
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Você recebe um TRECHO de letra de música em português, transcrito do canto de alguém — pode estar sem acentos, com grafia errada ou palavras muito parecidas trocadas (ex.: \"sede\" no lugar de \"sedentos\"). " +
            "Corrija para o português CORRETO (acentuação e ortografia), preservando EXATAMENTE as mesmas palavras, na MESMA ordem. NÃO complete, não acrescente, não remova e não tente adivinhar de qual música é. " +
            'Responda APENAS JSON no formato {"text":"<trecho corrigido>"}.',
        },
        { role: "user", content: snippet },
      ],
    });
    const txt = completion.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(txt) as { text?: unknown };
    return String(parsed.text ?? "").trim();
  } catch (err) {
    console.warn(
      "[/api/cifra] llm clean failed:",
      err instanceof Error ? err.message : err,
    );
    return "";
  }
}

// Resultado da identificação por letra: lista de versões confirmadas (melhor
// primeiro) e, quando há confiança alta, a versão para resolver direto.
interface LyricIdent {
  ordered: Candidate[];
  confident: Candidate | null;
}

// Busca no Deezer (indexa a letra) tolerante: o Deezer casa melhor com trechos
// CURTOS — vai diminuindo o número de palavras iniciais até obter resultados.
async function deezerByLyricText(text: string): Promise<DeezerSong[]> {
  const toks = text.split(" ").filter(Boolean);
  if (toks.length < 3) return [];
  for (const n of [8, 6, 5, 4]) {
    if (n > toks.length && n !== 4) continue;
    const q = toks.slice(0, Math.min(n, toks.length)).join(" ");
    const songs = await deezerSearch(q, 8);
    if (songs.length) return songs;
  }
  return [];
}

// Identifica a música a partir de um trecho da LETRA. A IA corrige a transcrição
// do canto (acentos/grafia), o Deezer identifica pela letra corrigida e o
// CifraClub confirma a cifra. Covers do mesmo louvor (mesmo título, artistas
// diferentes) são colapsados na versão canônica. É calculada UMA vez por
// requisição e reusada na resolução e nos candidatos.
async function identifyByLyrics(lyrics: string): Promise<LyricIdent> {
  const original = lyricsSnippet(lyrics, 12);
  if (!original) return { ordered: [], confident: null };

  const cleaned = await llmCleanLyrics(lyrics);

  // Tenta primeiro a letra corrigida (com acentos), depois o original como reserva.
  let deezerSongs: DeezerSong[] = [];
  for (const src of [cleaned, original]) {
    if (!src) continue;
    deezerSongs = await deezerByLyricText(src);
    if (deezerSongs.length) break;
  }

  // Quantas vezes cada título aparece no topo do Deezer. Quando a MESMA música
  // domina (várias gravações do mesmo louvor casam o trecho), é sinal forte de
  // que o trecho pertence mesmo a ela.
  const titleCount = new Map<string, number>();
  for (const s of deezerSongs) {
    const t = normName(s.title);
    if (t) titleCount.set(t, (titleCount.get(t) ?? 0) + 1);
  }

  // Confirma no CifraClub e DEDUPLICA por TÍTULO: covers do mesmo louvor por
  // artistas diferentes são a MESMA música — ficamos com a 1ª (a mais tocada/
  // canônica, no topo do Deezer). Assim, quando o trecho casa uma única música,
  // sobra um único candidato → identificação confiável.
  const ordered: Candidate[] = [];
  const seenTitle = new Set<string>();
  const seenId = new Set<string>();
  let topTitleCount = 0;
  for (const s of deezerSongs) {
    if (ordered.length >= 5) break;
    const tkey = normName(s.title);
    if (!tkey || seenTitle.has(tkey)) continue;
    const cand = await confirmSong(s.title, s.artist);
    if (!cand) continue;
    seenTitle.add(tkey);
    if (!seenId.has(cand.id)) {
      seenId.add(cand.id);
      if (ordered.length === 0) topTitleCount = titleCount.get(tkey) ?? 1;
      ordered.push(cand);
    }
  }

  // Resolve direto APENAS quando há uma única música distinta confirmada E essa
  // identificação é forte: ou o Deezer trouxe um único resultado, ou o mesmo
  // título dominou o topo (>= 2 gravações). Isso evita resolver para a música
  // errada quando vários títulos HOMÔNIMOS distintos casam um trecho genérico.
  const confident =
    ordered.length === 1 && (deezerSongs.length === 1 || topTitleCount >= 2)
      ? ordered[0]
      : null;
  return { ordered, confident };
}

// Reúne algumas versões da música a partir do nome e/ou de um trecho da letra.
// Combina a página do artista (quando há "Artista - Música") com os resultados
// do DuckDuckGo. Devolve candidatos distintos, sem fazer download de cada cifra
// (a cifra só é baixada quando o usuário escolhe uma versão).
async function gatherCandidates(
  opts: { query?: string; lyrics?: string },
  // Identificação por letra já calculada nesta requisição (evita rede repetida).
  preloadedLyric?: LyricIdent,
): Promise<Candidate[]> {
  const out: Candidate[] = [];
  const seenId = new Set<string>();
  const pushCand = (c: Candidate) => {
    if (!seenId.has(c.id)) {
      seenId.add(c.id);
      out.push(c);
    }
  };

  // 0) Pelo NOME: índice de busca do próprio CifraClub (Solr). Estável e sem
  //    CAPTCHA, casa título/artista com precisão.
  if (opts.query) {
    for (const s of await solrSearch(opts.query, 8)) {
      pushCand(solrToCandidate(s));
      if (out.length >= 5) break;
    }
  }
  if (out.length >= 5) return out.slice(0, 5);

  // 0b) Pela LETRA: identificação real por IA + base musical (Deezer), confirmada
  //     no CifraClub. Vem ANTES do palpite por prefixo do Solr, pois cobre o caso
  //     (comum) do trecho cantado não conter o título — que o Solr sozinho
  //     erraria, casando o prefixo com OUTRA música homônima.
  if (opts.lyrics && out.length < 5) {
    const ident = preloadedLyric ?? (await identifyByLyrics(opts.lyrics));
    for (const c of ident.ordered) {
      pushCand(c);
      if (out.length >= 5) break;
    }
  }

  // 0c) Pela LETRA via Solr por prefixos cada vez menores (reforço — útil quando o
  //     trecho cantado COMEÇA pelo título/refrão).
  if (opts.lyrics && out.length < 5) {
    for (const n of [3, 4, 6]) {
      if (out.length >= 5) break;
      const snip = lyricsSnippet(opts.lyrics, n);
      if (!snip) continue;
      for (const s of await solrSearch(snip, 8)) {
        pushCand(solrToCandidate(s));
        if (out.length >= 5) break;
      }
    }
  }
  if (out.length >= 5) return out.slice(0, 5);

  // 1) Reforço (melhor esforço): raspagem do CifraClub via página do artista e
  //    DuckDuckGo, caso o Solr não tenha trazido versões suficientes.
  const hits: CifraHit[] = [];
  const seen = new Set<string>();
  const add = (h: CifraHit) => {
    const k = `${h.artist}/${h.song}`;
    if (!seen.has(k)) {
      seen.add(k);
      hits.push(h);
    }
  };

  // 1a) Quando há "Artista - Música", lista músicas próximas na página do artista.
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

  for (const h of hits) {
    pushCand(hitToCandidate(h));
    if (out.length >= 5) break;
  }
  return out.slice(0, 5);
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
function lyricsSnippet(lyrics: string, words = 10): string {
  const clean = lyrics
    .replace(/\[[^\]]*\]/g, " ") // tira [Intro], [Refrão] etc.
    .replace(/[“”"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const toks = clean.split(" ").filter(Boolean);
  return toks.slice(0, words).join(" ");
}

// Identifica a música a partir de um trecho da LETRA (não do nome). Pesquisa no
// DuckDuckGo restringindo ao CifraClub e segue o primeiro resultado /artista/musica/.
async function resolveCifraByLyrics(
  lyrics: string,
  // Identificação por letra já calculada nesta requisição (evita rede repetida).
  preloadedLyric?: LyricIdent,
): Promise<Parsed | null> {
  const snippet = lyricsSnippet(lyrics);
  if (!snippet) return null;

  // 1) Identificação real pela LETRA por IA + base musical (Deezer), confirmada no
  //    CifraClub. Vem ANTES do palpite por prefixo do Solr, pois identifica a
  //    música mesmo quando o trecho não contém o título e mesmo com transcrição
  //    ruidosa. Resolve direto só quando há confiança alta (concordância IA+Deezer
  //    ou versão única); com várias versões, devolve null para o usuário escolher.
  const ident = preloadedLyric ?? (await identifyByLyrics(lyrics));
  if (ident.confident) {
    const hit = decodePick(ident.confident.id);
    if (hit) {
      const got = await fetchPrint(hit.artist, hit.song);
      if (got) return got;
    }
  }
  if (ident.ordered.length >= 1) return null;

  // 2) Índice do CifraClub (Solr), por prefixos cada vez menores da letra (reforço
  //    quando o trecho COMEÇA pelo título/refrão). Só resolve direto com um único
  //    resultado claro; com várias versões devolve null para o usuário escolher.
  for (const n of [3, 4, 6]) {
    const snip = lyricsSnippet(lyrics, n);
    if (!snip) continue;
    const songs = await solrSearch(snip, 8);
    if (songs.length === 1) {
      const got = await fetchPrint(songs[0].artist, songs[0].song);
      if (got) return got;
    }
    if (songs.length > 1) return null;
  }

  // 3) DuckDuckGo (reserva, melhor esforço — costuma estar bloqueado por CAPTCHA).
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

  // 3) Índice do CifraClub (Solr): resolve direto só quando há um único resultado
  //    claro. Com várias versões devolvemos null para o usuário escolher.
  const solrSongs = await solrSearch(query, 8);
  if (solrSongs.length === 1) {
    const got = await fetchPrint(solrSongs[0].artist, solrSongs[0].song);
    if (got) return got;
  }
  if (solrSongs.length > 1) return null;

  // 4) DuckDuckGo (reserva, melhor esforço — costuma estar bloqueado por CAPTCHA).
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
    // Caso contrário, busca pelo nome ("Artista - Música"). A identificação por
    // letra (IA + Deezer) é calculada UMA vez e reusada na resolução e nos candidatos.
    const lyricIdent = lyrics ? await identifyByLyrics(lyrics) : undefined;
    const parsed = lyrics
      ? await resolveCifraByLyrics(lyrics, lyricIdent)
      : await resolveCifra(query);
    if (!parsed) {
      // Sem um casamento confiável: oferece algumas VERSÕES para o usuário escolher.
      const candidates = await gatherCandidates(
        { query: query || undefined, lyrics: lyrics || undefined },
        lyricIdent,
      );
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
