// ─────────────────────────────────────────────────────────────────────────────
// Teoria musical da cifra: classificação de linhas, transposição (mudar o tom) e
// detecção do tom a partir dos acordes (quando a cifra vem sem o tom marcado).
//
// A transposição preserva o ALINHAMENTO acorde-sobre-letra: cada acorde é
// reescrito na MESMA coluna em que estava, empurrando só quando um acorde mais
// largo (ex.: C → C#) encostaria no próximo. Linhas de letra/tablatura/seção
// nunca são transpostas — só as linhas de acordes.
// ─────────────────────────────────────────────────────────────────────────────

export type LineKind = "section" | "chords" | "tab" | "lyric" | "blank" | "annotation";

// Reconhece um token de acorde (raiz maiúscula A–G + sufixos/baixo).
export function isChordToken(t: string): boolean {
  return /^[A-G][#b]?(?:[mM]|maj|min|dim|aug|sus|add|°|º|\+|\d|\(|\)|#|b|\/|[A-G])*$/.test(t);
}

// Marcações de execução (não são letra nem acorde): "(2x)", "Solo", "Intro"…
const ANNOTATION_RE =
  /^\(?\s*(?:\d+\s*x|x\s*\d+|bis|solo|intro|instrumental|final|riff|coda|tutti|(?:repete|repetir)[a-zçãõéêáà0-9 ]*)\s*\)?\s*[:.\-–—]*\s*$/i;

export function classifyLine(line: string): LineKind {
  const trimmed = line.trim();
  if (!trimmed) return "blank";
  if (/^\[[^\]]+\]$/.test(trimmed)) return "section";
  // Linhas de tablatura: corda + barra + traços (ex.: "E|--3--2--").
  if (/\|/.test(line) && /-{2,}/.test(line)) return "tab";
  // Marcação de execução isolada — tratada como não-letra.
  if (ANNOTATION_RE.test(trimmed)) return "annotation";
  // Ignora tokens que são só pontuação (ex.: parênteses de progressão "( Em7 C9 )").
  const tokens = trimmed.split(/\s+/).filter((t) => !/^[()|:.-]+$/.test(t));
  if (tokens.length === 0) return "lyric";
  const chordCount = tokens.filter(isChordToken).length;
  if (chordCount > 0 && chordCount / tokens.length >= 0.8) return "chords";
  return "lyric";
}

// ── Notas ↔ classe de altura (pitch class 0..11) ─────────────────────────────
const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

function noteToPc(note: string): number | null {
  const m = note.match(/^([A-G])([#b]?)/);
  if (!m) return null;
  let pc = LETTER_PC[m[1]];
  if (pc === undefined) return null;
  if (m[2] === "#") pc += 1;
  else if (m[2] === "b") pc -= 1;
  return ((pc % 12) + 12) % 12;
}

function noteName(pc: number, preferFlats: boolean): string {
  const i = ((pc % 12) + 12) % 12;
  return preferFlats ? FLAT_NAMES[i] : SHARP_NAMES[i];
}

// Transpõe um único segmento "raiz + sufixo" (sem barra).
function transposeSegment(seg: string, semis: number, preferFlats: boolean): string {
  const m = seg.match(/^([A-G][#b]?)(.*)$/);
  if (!m) return seg;
  const pc = noteToPc(m[1]);
  if (pc === null) return seg;
  return noteName(pc + semis, preferFlats) + m[2];
}

// Transpõe um token de acorde, incluindo o baixo invertido (ex.: "D/F#").
export function transposeToken(token: string, semis: number, preferFlats: boolean): string {
  if (semis % 12 === 0) return token;
  return token
    .split("/")
    .map((part) => transposeSegment(part, semis, preferFlats))
    .join("/");
}

// Reescreve uma linha de acordes preservando as colunas de cada acorde.
function transposeChordLine(line: string, semis: number, preferFlats: boolean): string {
  let out = "";
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    const text = isChordToken(m[0]) ? transposeToken(m[0], semis, preferFlats) : m[0];
    let col = m.index;
    if (out.length > 0 && col <= out.length) col = out.length + 1; // ao menos 1 espaço
    while (out.length < col) out += " ";
    out += text;
  }
  return out;
}

// Uma linha com prefixo [Seção] seguida de acordes na mesma linha.
function inlineChordPart(line: string): { prefix: string; chords: string } | null {
  const m = line.match(/^(\s*\[[^\]]+\]\s*)(.*)$/);
  if (!m || !m[2].trim()) return null;
  const tokens = m[2].trim().split(/\s+/).filter((t) => !/^[()|]+$/.test(t));
  if (tokens.length === 0) return null;
  const chordCount = tokens.filter(isChordToken).length;
  if (chordCount / tokens.length < 0.6) return null;
  return { prefix: m[1], chords: m[2] };
}

// Transpõe a cifra inteira (texto). `semis` em semitons; positivo sobe.
export function transposeChart(text: string, semis: number, preferFlats: boolean): string {
  if (semis % 12 === 0) return text;
  const lines = text.replace(/\r/g, "").split("\n");
  return lines
    .map((line) => {
      const kind = classifyLine(line);
      if (kind === "chords") return transposeChordLine(line, semis, preferFlats);
      const inline = inlineChordPart(line);
      if (inline) {
        return inline.prefix + transposeChordLine(inline.chords, semis, preferFlats).trimStart();
      }
      return line;
    })
    .join("\n");
}

// ── Tom (key) ────────────────────────────────────────────────────────────────
export interface ParsedKey {
  pc: number;
  isMinor: boolean;
}

export function parseKeyName(key: string | null | undefined): ParsedKey | null {
  if (!key) return null;
  const m = key.trim().match(/^([A-G][#b]?)\s*(m|min|minor)?\b/i);
  if (!m) return null;
  const pc = noteToPc(m[1]);
  if (pc === null) return null;
  const isMinor = !!m[2] && /^m/i.test(m[2]);
  return { pc, isMinor };
}

// Tons com bemóis na armadura (escolha de grafia natural para nomes de tom).
const MAJOR_FLAT_PCS = new Set([5, 10, 3, 8, 1]); // F, Bb, Eb, Ab, Db
const MINOR_FLAT_PCS = new Set([2, 7, 0, 5, 10, 3]); // Dm, Gm, Cm, Fm, Bbm, Ebm

export function preferFlatsForKey(pc: number, isMinor: boolean): boolean {
  const i = ((pc % 12) + 12) % 12;
  return isMinor ? MINOR_FLAT_PCS.has(i) : MAJOR_FLAT_PCS.has(i);
}

export function keyName(pc: number, isMinor: boolean): string {
  const flats = preferFlatsForKey(pc, isMinor);
  return noteName(pc, flats) + (isMinor ? "m" : "");
}

export function transposeKeyName(key: ParsedKey, semis: number): string {
  return keyName(key.pc + semis, key.isMinor);
}

// Lista de 12 tons no mesmo modo (maior/menor) para o seletor.
export function keyOptions(isMinor: boolean): { pc: number; label: string }[] {
  return Array.from({ length: 12 }, (_, pc) => ({ pc, label: keyName(pc, isMinor) }));
}

// ── Detecção do tom a partir dos acordes (quando a cifra vem sem o tom) ───────
type Quality = "maj" | "min" | "dim";

// Tríades diatônicas de cada modo: deslocamento (semitons) → qualidade.
const MAJOR_TRIADS: [number, Quality][] = [
  [0, "maj"], [2, "min"], [4, "min"], [5, "maj"], [7, "maj"], [9, "min"], [11, "dim"],
];
const MINOR_TRIADS: [number, Quality][] = [
  [0, "min"], [2, "dim"], [3, "maj"], [5, "min"], [7, "min"], [8, "maj"], [10, "maj"],
];

function chordRoots(text: string): { pc: number; isMinor: boolean }[] {
  const lines = text.replace(/\r/g, "").split("\n");
  const out: { pc: number; isMinor: boolean }[] = [];
  for (const line of lines) {
    const kind = classifyLine(line);
    const inline = inlineChordPart(line);
    if (kind !== "chords" && !inline) continue;
    const source = inline ? inline.chords : line;
    for (const tok of source.trim().split(/\s+/)) {
      if (!isChordToken(tok)) continue;
      const head = tok.split("/")[0];
      const m = head.match(/^([A-G][#b]?)(.*)$/);
      if (!m) continue;
      const pc = noteToPc(m[1]);
      if (pc === null) continue;
      const isMinor = /^m(?!aj)/.test(m[2]);
      out.push({ pc, isMinor });
    }
  }
  return out;
}

// Estima o tom: pontua os 24 tons (12 maiores + 12 menores) por quantos acordes
// pertencem à escala, com bônus para o primeiro/último acorde como tônica.
export function detectKeyFromChart(text: string): string | null {
  const chords = chordRoots(text);
  if (chords.length < 2) return null;
  const first = chords[0];
  const last = chords[chords.length - 1];

  let bestScore = -Infinity;
  let bestPc = 0;
  let bestMinor = false;

  for (let tonic = 0; tonic < 12; tonic++) {
    for (const isMinor of [false, true]) {
      // Mapa pc → qualidade esperada da tríade diatônica nesse tom.
      const triads = isMinor ? MINOR_TRIADS : MAJOR_TRIADS;
      const expected = new Map<number, Quality>();
      for (const [deg, q] of triads) expected.set((tonic + deg) % 12, q);

      let score = 0;
      for (const c of chords) {
        const expQ = expected.get(c.pc);
        if (expQ === undefined) {
          score -= 0.3; // acorde fora do tom: penaliza
          continue;
        }
        const chordQ: Quality = c.isMinor ? "min" : "maj";
        if (expQ === chordQ) score += 1; // grau e qualidade batem
        else if (expQ === "dim") score += 0.6; // grau diminuto (qualidade flexível)
        else score += 0.4; // na escala, qualidade diferente (ex.: dominante secundária)
      }
      // Bônus: o 1º/último acorde costuma ser a tônica, no modo certo.
      const firstTonic = first.pc === tonic;
      const lastTonic = last.pc === tonic;
      if (firstTonic) score += first.isMinor === isMinor ? 1.5 : 0.7;
      if (lastTonic) score += last.isMinor === isMinor ? 1 : 0.5;
      // Pequena preferência por maior em caso de empate.
      if (!isMinor) score += 0.1;

      if (score > bestScore) {
        bestScore = score;
        bestPc = tonic;
        bestMinor = isMinor;
      }
    }
  }
  return keyName(bestPc, bestMinor);
}
