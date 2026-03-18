export type SophisticationLevel = "suave" | "intermediario" | "avancado";

export interface SubstitutionResult {
  original: string;
  substituted: string;
  category: string;
  chordId?: string;
}

// Maps chord quality to substitution for each level
// Quality: "" = major, "m" = minor, "7" = dom7, etc.
const SUBSTITUTION_MAP: Record<string, Record<SophisticationLevel, string>> = {
  // Major triad → add9 / 7M / 6/9
  "": { suave: "add9", intermediario: "7M", avancado: "6/9" },
  // Minor triad → m7 / m7 / m9
  m: { suave: "m7", intermediario: "m7", avancado: "m9" },
  // Dominant 7th → 9 / 9 / 13
  "7": { suave: "9", intermediario: "9", avancado: "13" },
  // Major 7 → 7M / maj9 / maj9
  "7M": { suave: "7M", intermediario: "maj9", avancado: "maj9" },
  "7+": { suave: "7M", intermediario: "maj9", avancado: "6/9" },
  maj7: { suave: "7M", intermediario: "maj9", avancado: "6/9" },
  // Minor 7 → m7 / m9 / m11
  m7: { suave: "m7", intermediario: "m9", avancado: "m9" },
  // Sus4 → sus4 / 7sus4 / 9sus4
  sus4: { suave: "sus4", intermediario: "7sus4", avancado: "9sus4" },
  sus2: { suave: "sus2", intermediario: "sus2", avancado: "add9" },
  // 7sus4 → 7sus4 / 9sus4 / 9sus4
  "7sus4": { suave: "7sus4", intermediario: "9sus4", avancado: "9sus4" },
  // add9 → add9 / maj9 / 6/9
  add9: { suave: "add9", intermediario: "maj9", avancado: "6/9" },
  "9": { suave: "9", intermediario: "9", avancado: "13" },
  // Half-dim stays
  "m7(b5)": { suave: "m7(b5)", intermediario: "m7(b5)", avancado: "m7(b5)" },
  "m7b5": { suave: "m7(b5)", intermediario: "m7(b5)", avancado: "m7(b5)" },
  // Diminished stays
  "°": { suave: "°", intermediario: "°", avancado: "°" },
  dim: { suave: "°", intermediario: "°", avancado: "°" },
  // Augmented stays
  aug: { suave: "aug", intermediario: "aug", avancado: "aug" },
  "+": { suave: "aug", intermediario: "aug", avancado: "aug" },
  // 6 → 6 / 6/9 / 6/9
  "6": { suave: "add9", intermediario: "6/9", avancado: "6/9" },
  // maj9 stays at this level or goes to 6/9
  maj9: { suave: "maj9", intermediario: "maj9", avancado: "6/9" },
};

const CHORD_ID_MAP: Record<string, Record<string, string>> = {
  C: { "7M": "C7M", add9: "Cadd9", "6/9": "C6-9", m7: "Cm7", m9: "Cm7", "7sus4": "C7sus4" },
  Db: { "7M": "Db7M", add9: "Dbadd9", "6/9": "Db6-9", m7: "Dbm7", "7sus4": "Db7sus4" },
  "C#": { "7M": "Db7M", add9: "Dbadd9", "6/9": "Db6-9", m7: "Dbm7", "7sus4": "Db7sus4" },
  D: { "7M": "D7M", add9: "Dadd9", "6/9": "D6-9", m7: "Dm7", "7sus4": "D7sus4" },
  Eb: { "7M": "Eb7M", add9: "Ebadd9", "6/9": "Eb6-9", m7: "Ebm7", "7sus4": "Eb7sus4" },
  "D#": { "7M": "Eb7M", add9: "Ebadd9", "6/9": "Eb6-9", m7: "Ebm7", "7sus4": "Eb7sus4" },
  E: { "7M": "E7M", add9: "Eadd9", "6/9": "E6-9", m7: "Em7", "7sus4": "E7sus4" },
  F: { "7M": "F7M", add9: "Fadd9", "6/9": "F6-9", m7: "Fm7", "7sus4": "F7sus4" },
  "F#": { "7M": "Gb7M", add9: "Gbadd9", "6/9": "Gb6-9", m7: "Gbm7", "7sus4": "Gb7sus4" },
  Gb: { "7M": "Gb7M", add9: "Gbadd9", "6/9": "Gb6-9", m7: "Gbm7", "7sus4": "Gb7sus4" },
  G: { "7M": "G7M", add9: "Gadd9", "6/9": "G6-9", m7: "Gm7", "7sus4": "G7sus4" },
  Ab: { "7M": "Ab7M", add9: "Abadd9", "6/9": "Ab6-9", m7: "Abm7", "7sus4": "Ab7sus4" },
  "G#": { "7M": "Ab7M", add9: "Abadd9", "6/9": "Ab6-9", m7: "Abm7", "7sus4": "Ab7sus4" },
  A: { "7M": "A7M", add9: "Aadd9", "6/9": "A6-9", m7: "Am7", "7sus4": "A7sus4" },
  Bb: { "7M": "Bb7M", add9: "Bbadd9", "6/9": "Bb6-9", m7: "Bbm7", "7sus4": "Bb7sus4" },
  "A#": { "7M": "Bb7M", add9: "Bbadd9", "6/9": "Bb6-9", m7: "Bbm7", "7sus4": "Bb7sus4" },
  B: { "7M": "B7M", add9: "Badd9", "6/9": "B6-9", m7: "Bm7", "7sus4": "B7sus4" },
};

// Ordered from longest to shortest to avoid partial matches
const QUALITY_PATTERNS = [
  "m7(b5)",
  "m7b5",
  "7sus4",
  "9sus4",
  "maj9",
  "maj7",
  "add9",
  "add11",
  "sus4",
  "sus2",
  "dim7",
  "6/9",
  "7M",
  "7+",
  "m9",
  "m7",
  "m6",
  "m",
  "°",
  "dim",
  "aug",
  "7",
  "9",
  "11",
  "13",
  "6",
  "+",
];

const NOTE_REGEX = /^([A-G][b#]?)/;

export function parseChordToken(token: string): { root: string; quality: string } | null {
  const noteMatch = token.match(NOTE_REGEX);
  if (!noteMatch) return null;
  const root = noteMatch[1];
  let quality = token.slice(root.length);

  // Remove bass note (e.g., /G)
  const bassSlash = quality.indexOf("/");
  if (bassSlash !== -1 && bassSlash > 0) {
    quality = quality.slice(0, bassSlash);
  }

  return { root, quality };
}

export function substituteChord(
  token: string,
  level: SophisticationLevel
): SubstitutionResult | null {
  const parsed = parseChordToken(token);
  if (!parsed) return null;

  const { root, quality } = parsed;

  // Find the matching quality in our map
  const mapping = SUBSTITUTION_MAP[quality];
  if (!mapping) return null;

  const newQuality = mapping[level];
  const substituted = root + newQuality;

  // Determine category name
  const categoryMap: Record<string, string> = {
    add9: "Com 9ª",
    "7M": "Maiores com 7ªM",
    "6/9": "Com 6ª",
    maj9: "Com 7ªM e 9ª",
    m7: "Menores com 7ª",
    m9: "Menores com 7ª",
    "7sus4": "7sus4",
    "9sus4": "7sus4",
    "°": "Diminutos",
    "m7(b5)": "Meio-Diminutos",
    sus4: "Sus4",
    sus2: "Sus2",
    "9": "Com 9ª",
    "13": "Com 9ª",
    aug: "Tríades Maiores",
  };

  const category = categoryMap[newQuality] || "Tríades Maiores";
  const chordId = CHORD_ID_MAP[root]?.[newQuality];

  return {
    original: token,
    substituted,
    category,
    chordId,
  };
}

interface Token {
  type: "chord" | "text";
  value: string;
  substitution?: SubstitutionResult;
}

// Tokenize a line: split into chord tokens and text tokens
function tokenizeLine(line: string, level: SophisticationLevel): Token[] {
  const tokens: Token[] = [];

  // Use regex to find potential chord tokens (capitalized note names)
  const chordRegex = /\b([A-G][b#]?(?:m7b5|m7\(b5\)|7sus4|9sus4|maj9|maj7|add9|sus4|sus2|dim7|7M|7\+|m9|m7|m6|°|dim|aug|m|6\/9|7|9|11|13|6|\+)?(?:\/[A-G][b#]?)?)\b/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = chordRegex.exec(line)) !== null) {
    // Add preceding text
    if (match.index > lastIndex) {
      tokens.push({ type: "text", value: line.slice(lastIndex, match.index) });
    }

    const tokenStr = match[1];
    const sub = substituteChord(tokenStr, level);

    if (sub) {
      tokens.push({ type: "chord", value: tokenStr, substitution: sub });
    } else {
      tokens.push({ type: "text", value: tokenStr });
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < line.length) {
    tokens.push({ type: "text", value: line.slice(lastIndex) });
  }

  return tokens;
}

export interface ProcessedLine {
  tokens: Token[];
  hasChords: boolean;
}

export function processChordChart(
  text: string,
  level: SophisticationLevel
): ProcessedLine[] {
  const lines = text.split("\n");
  return lines.map((line) => {
    const tokens = tokenizeLine(line, level);
    const hasChords = tokens.some((t) => t.type === "chord" && t.substitution);
    return { tokens, hasChords };
  });
}
