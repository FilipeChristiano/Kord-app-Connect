export type SophisticationLevel = "suave" | "intermediario" | "avancado";

export interface SubstitutionResult {
  original: string;
  substituted: string;
  category: string;
  chordId?: string;
  harmonicFunction?: string;
}

// ── Note ↔ semitone conversions ───────────────────────────────────────────────
const NOTE_TO_SEMITONE: Record<string, number> = {
  C: 0, "B#": 0, Db: 1, "C#": 1, D: 2, Eb: 3, "D#": 3,
  E: 4, Fb: 4, F: 5, "E#": 5, Gb: 6, "F#": 6, G: 7,
  Ab: 8, "G#": 8, A: 9, Bb: 10, "A#": 10, B: 11, Cb: 11,
};

// Normalize enharmonic roots to flat names (dictionary uses flats)
const ENHARMONIC_ROOT: Record<string, string> = {
  "C#": "Db", "D#": "Eb", "E#": "F", "F#": "Gb",
  "G#": "Ab", "A#": "Bb", "B#": "C",
};

// Major scale semitone intervals from root
const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11]; // I II III IV V VI VII

// Human-readable function names (Portuguese)
const FUNCTION_NAMES: Record<number, string> = {
  0: "I grau (tônica)",
  1: "II grau (supertônica)",
  2: "III grau (mediante)",
  3: "IV grau (subdominante)",
  4: "V grau (dominante)",
  5: "VI grau (submediante)",
  6: "VII grau (sensível)",
};

// ── Campo Harmônico ──────────────────────────────────────────────────────────
// For each scale degree and chord quality, the ideal sophistication per level.
// Uses EXACT names from the dictionary (7M, m7, m7(b5), °, add9, 6/9, 7sus4, sus4, sus2).

type QualityMap = Record<string, Record<SophisticationLevel, string>>;

const CAMPO_HARMONICO: Record<number, QualityMap> = {
  // ── I grau — Tônica Maior ─────────────────────────────────────────────
  // Guia de aplicações: use 7M para suavizar, add9 para textura, 6/9 para jazz
  0: {
    "":      { suave: "add9",   intermediario: "7M",    avancado: "6/9"    },
    "7M":    { suave: "7M",     intermediario: "7M",    avancado: "6/9"    },
    "add9":  { suave: "add9",   intermediario: "7M",    avancado: "6/9"    },
    "6/9":   { suave: "6/9",    intermediario: "6/9",   avancado: "6/9"    },
    "sus4":  { suave: "sus4",   intermediario: "sus4",  avancado: "7sus4"  },
    "sus2":  { suave: "sus2",   intermediario: "sus2",  avancado: "add9"   },
  },

  // ── II grau — Supertônica Menor ───────────────────────────────────────
  // Guia: m7 é a sofisticação natural da supertônica no campo harmônico
  1: {
    "m":     { suave: "m7",     intermediario: "m7",    avancado: "m7"     },
    "m7":    { suave: "m7",     intermediario: "m7",    avancado: "m7"     },
    "":      { suave: "add9",   intermediario: "7M",    avancado: "6/9"    }, // II maior
    "7":     { suave: "7sus4",  intermediario: "7sus4", avancado: "7sus4"  }, // V/V (dominante secundária)
    "7M":    { suave: "7M",     intermediario: "7M",    avancado: "6/9"    },
    "add9":  { suave: "add9",   intermediario: "7M",    avancado: "6/9"    },
  },

  // ── III grau — Mediante Menor ─────────────────────────────────────────
  // Guia: m7 substitui naturalmente a mediante
  2: {
    "m":     { suave: "m7",     intermediario: "m7",    avancado: "m7"     },
    "m7":    { suave: "m7",     intermediario: "m7",    avancado: "m7"     },
    "":      { suave: "add9",   intermediario: "7M",    avancado: "6/9"    },
    "7":     { suave: "7sus4",  intermediario: "7sus4", avancado: "7sus4"  },
  },

  // ── IV grau — Subdominante Maior ──────────────────────────────────────
  // Guia: 7M é a sofisticação natural da subdominante; add9 para suave
  3: {
    "":      { suave: "add9",   intermediario: "7M",    avancado: "7M"     },
    "7M":    { suave: "7M",     intermediario: "7M",    avancado: "6/9"    },
    "add9":  { suave: "add9",   intermediario: "7M",    avancado: "7M"     },
    "6/9":   { suave: "6/9",    intermediario: "6/9",   avancado: "6/9"    },
    "sus4":  { suave: "sus4",   intermediario: "7sus4", avancado: "7sus4"  },
    "sus2":  { suave: "sus2",   intermediario: "sus2",  avancado: "add9"   },
    "m":     { suave: "m7",     intermediario: "m7",    avancado: "m7"     }, // IVm (empréstimo)
    "m7":    { suave: "m7",     intermediario: "m7",    avancado: "m7"     },
  },

  // ── V grau — Dominante ────────────────────────────────────────────────
  // Guia: 7sus4 substitui o V grau criando tensão sem aspereza; evita o trítono
  4: {
    "":      { suave: "sus4",   intermediario: "7sus4", avancado: "7sus4"  },
    "7":     { suave: "7sus4",  intermediario: "7sus4", avancado: "7sus4"  },
    "sus4":  { suave: "sus4",   intermediario: "7sus4", avancado: "7sus4"  },
    "7sus4": { suave: "7sus4",  intermediario: "7sus4", avancado: "7sus4"  },
    "add9":  { suave: "sus4",   intermediario: "7sus4", avancado: "7sus4"  },
    "7M":    { suave: "7M",     intermediario: "7M",    avancado: "6/9"    },
    "sus2":  { suave: "sus2",   intermediario: "sus2",  avancado: "7sus4"  },
  },

  // ── VI grau — Submediante Menor ───────────────────────────────────────
  // Guia: m7 é a sofisticação natural da submediante
  5: {
    "m":     { suave: "m7",     intermediario: "m7",    avancado: "m7"     },
    "m7":    { suave: "m7",     intermediario: "m7",    avancado: "m7"     },
    "":      { suave: "add9",   intermediario: "7M",    avancado: "6/9"    }, // VI maior
    "7":     { suave: "7sus4",  intermediario: "7sus4", avancado: "7sus4"  },
    "add9":  { suave: "add9",   intermediario: "7M",    avancado: "6/9"    },
  },

  // ── VII grau — Sensível / Diminuto ────────────────────────────────────
  // Guia: m7(b5) substitui o diminuto com mais sofisticação harmônica
  6: {
    "°":        { suave: "°",       intermediario: "m7(b5)", avancado: "m7(b5)" },
    "dim":      { suave: "°",       intermediario: "m7(b5)", avancado: "m7(b5)" },
    "m":        { suave: "m7",      intermediario: "m7(b5)", avancado: "m7(b5)" },
    "m7":       { suave: "m7",      intermediario: "m7(b5)", avancado: "m7(b5)" },
    "m7(b5)":   { suave: "m7(b5)",  intermediario: "m7(b5)", avancado: "m7(b5)" },
    "m7b5":     { suave: "m7(b5)",  intermediario: "m7(b5)", avancado: "m7(b5)" },
  },
};

// ── Fallback (acordes fora do campo harmônico) ────────────────────────────────
const FALLBACK: QualityMap = {
  "":        { suave: "add9",   intermediario: "7M",     avancado: "6/9"    },
  "m":       { suave: "m7",     intermediario: "m7",     avancado: "m7"     },
  "7":       { suave: "7sus4",  intermediario: "7sus4",  avancado: "7sus4"  },
  "7M":      { suave: "7M",     intermediario: "7M",     avancado: "6/9"    },
  "7+":      { suave: "7M",     intermediario: "7M",     avancado: "6/9"    },
  "m7":      { suave: "m7",     intermediario: "m7",     avancado: "m7"     },
  "sus4":    { suave: "sus4",   intermediario: "7sus4",  avancado: "7sus4"  },
  "sus2":    { suave: "sus2",   intermediario: "sus2",   avancado: "add9"   },
  "7sus4":   { suave: "7sus4",  intermediario: "7sus4",  avancado: "7sus4"  },
  "add9":    { suave: "add9",   intermediario: "7M",     avancado: "6/9"    },
  "6/9":     { suave: "6/9",    intermediario: "6/9",    avancado: "6/9"    },
  "6":       { suave: "add9",   intermediario: "6/9",    avancado: "6/9"    },
  "m7(b5)":  { suave: "m7(b5)", intermediario: "m7(b5)", avancado: "m7(b5)" },
  "m7b5":    { suave: "m7(b5)", intermediario: "m7(b5)", avancado: "m7(b5)" },
  "°":       { suave: "°",      intermediario: "m7(b5)", avancado: "m7(b5)" },
  "dim":     { suave: "°",      intermediario: "m7(b5)", avancado: "m7(b5)" },
  "aug":     { suave: "aug",    intermediario: "aug",    avancado: "aug"    },
  "+":       { suave: "aug",    intermediario: "aug",    avancado: "aug"    },
  "maj7":    { suave: "7M",     intermediario: "7M",     avancado: "6/9"    },
  "maj9":    { suave: "7M",     intermediario: "7M",     avancado: "6/9"    },
  "9sus4":   { suave: "7sus4",  intermediario: "7sus4",  avancado: "7sus4"  },
  "9":       { suave: "7sus4",  intermediario: "7sus4",  avancado: "7sus4"  },
  "11":      { suave: "7sus4",  intermediario: "7sus4",  avancado: "7sus4"  },
  "13":      { suave: "7sus4",  intermediario: "7sus4",  avancado: "7sus4"  },
};

// ── Chord ID map (root → newQuality → dictionary ID for linking) ──────────────
const CHORD_ID_MAP: Record<string, Record<string, string>> = {
  C:  { "7M":"C7M", add9:"Cadd9", "6/9":"C6-9", m7:"Cm7", sus4:"Csus4", sus2:"Csus2", "7sus4":"C7sus4", "°":"Cdim", "m7(b5)":"Cm7b5" },
  Db: { "7M":"Db7M", add9:"Dbadd9", "6/9":"Db6-9", m7:"Dbm7", sus4:"Dbsus4", sus2:"Dbsus2", "7sus4":"Db7sus4", "°":"Dbdim", "m7(b5)":"Dbm7b5" },
  D:  { "7M":"D7M", add9:"Dadd9", "6/9":"D6-9", m7:"Dm7", sus4:"Dsus4", sus2:"Dsus2", "7sus4":"D7sus4", "°":"Ddim", "m7(b5)":"Dm7b5" },
  Eb: { "7M":"Eb7M", add9:"Ebadd9", "6/9":"Eb6-9", m7:"Ebm7", sus4:"Ebsus4", sus2:"Ebsus2", "7sus4":"Eb7sus4", "°":"Ebdim", "m7(b5)":"Ebm7b5" },
  E:  { "7M":"E7M", add9:"Eadd9", "6/9":"E6-9", m7:"Em7", sus4:"Esus4", sus2:"Esus2", "7sus4":"E7sus4", "°":"Edim", "m7(b5)":"Em7b5" },
  F:  { "7M":"F7M", add9:"Fadd9", "6/9":"F6-9", m7:"Fm7", sus4:"Fsus4", sus2:"Fsus2", "7sus4":"F7sus4", "°":"Fdim", "m7(b5)":"Fm7b5" },
  Gb: { "7M":"Gb7M", add9:"Gbadd9", "6/9":"Gb6-9", m7:"Gbm7", sus4:"Gbsus4", sus2:"Gbsus2", "7sus4":"Gb7sus4", "°":"Gbdim", "m7(b5)":"Gbm7b5" },
  G:  { "7M":"G7M", add9:"Gadd9", "6/9":"G6-9", m7:"Gm7", sus4:"Gsus4", sus2:"Gsus2", "7sus4":"G7sus4", "°":"Gdim", "m7(b5)":"Gm7b5" },
  Ab: { "7M":"Ab7M", add9:"Abadd9", "6/9":"Ab6-9", m7:"Abm7", sus4:"Absus4", sus2:"Absus2", "7sus4":"Ab7sus4", "°":"Abdim", "m7(b5)":"Abm7b5" },
  A:  { "7M":"A7M", add9:"Aadd9", "6/9":"A6-9", m7:"Am7", sus4:"Asus4", sus2:"Asus2", "7sus4":"A7sus4", "°":"Adim", "m7(b5)":"Am7b5" },
  Bb: { "7M":"Bb7M", add9:"Bbadd9", "6/9":"Bb6-9", m7:"Bbm7", sus4:"Bbsus4", sus2:"Bbsus2", "7sus4":"Bb7sus4", "°":"Bbdim", "m7(b5)":"Bbm7b5" },
  B:  { "7M":"B7M", add9:"Badd9", "6/9":"B6-9", m7:"Bm7", sus4:"Bsus4", sus2:"Bsus2", "7sus4":"B7sus4", "°":"Bdim", "m7(b5)":"Bm7b5" },
};

const QUALITY_TO_CATEGORY: Record<string, string> = {
  "add9":    "Com 9ª",
  "7M":      "Maiores com 7ªM",
  "6/9":     "Com 6ª",
  "m7":      "Menores com 7ª",
  "7sus4":   "7sus4",
  "sus4":    "Sus4",
  "sus2":    "Sus2",
  "°":       "Diminutos",
  "m7(b5)":  "Meio-Diminutos",
  "aug":     "Tríades Maiores",
};

// ── Parsing helpers ───────────────────────────────────────────────────────────
const NOTE_REGEX = /^([A-G][b#]?)/;

// Ordered longest-first to avoid partial matches
const QUALITY_PATTERNS = [
  "m7(b5)", "m7b5", "7sus4", "9sus4", "maj9", "maj7", "add9", "add11",
  "sus4", "sus2", "dim7", "6/9", "7M", "7+", "m9", "m7", "m6",
  "m", "°", "dim", "aug", "7", "9", "11", "13", "6", "+",
];

export function parseChordToken(token: string): { root: string; quality: string } | null {
  const noteMatch = token.match(NOTE_REGEX);
  if (!noteMatch) return null;
  const root = noteMatch[1];
  let rest = token.slice(root.length);

  // Remove bass note  e.g. /G
  const bassIdx = rest.indexOf("/");
  if (bassIdx > 0) rest = rest.slice(0, bassIdx);

  // Match quality from longest to shortest
  let quality = "";
  for (const pat of QUALITY_PATTERNS) {
    if (rest === pat || rest.startsWith(pat)) {
      quality = pat;
      break;
    }
  }
  // If leftover after known pattern, the token isn't purely a chord we know
  if (rest !== "" && rest !== quality) {
    quality = rest; // pass through for fallback lookup
  }

  return { root, quality };
}

function normalizeRoot(root: string): string {
  return ENHARMONIC_ROOT[root] || root;
}

// ── Key detection ─────────────────────────────────────────────────────────────
// Tries all 12 major keys, scores by how many chord roots are diatonic.
function detectKey(rootSemitones: number[]): number {
  if (rootSemitones.length === 0) return 0;
  let bestKey = 0, bestScore = -1;
  for (let k = 0; k < 12; k++) {
    const score = rootSemitones.filter((r) =>
      MAJOR_SCALE.some((s) => (s + k) % 12 === r)
    ).length;
    if (score > bestScore) {
      bestScore = score;
      bestKey = k;
    }
  }
  return bestKey;
}

// ── Single chord substitution (with key context) ──────────────────────────────
function substituteChordInKey(
  token: string,
  level: SophisticationLevel,
  keySemitone: number
): SubstitutionResult | null {
  const parsed = parseChordToken(token);
  if (!parsed) return null;

  const { quality } = parsed;
  const root = normalizeRoot(parsed.root);
  const rootSemitone = NOTE_TO_SEMITONE[root];
  if (rootSemitone === undefined) return null;

  // Determine harmonic degree in detected key
  const relative = (rootSemitone - keySemitone + 12) % 12;
  const degree = MAJOR_SCALE.indexOf(relative);

  let newQuality: string;
  let harmonicFunction: string | undefined;

  if (degree >= 0 && CAMPO_HARMONICO[degree]) {
    const degreeMap = CAMPO_HARMONICO[degree];
    const levelMap = degreeMap[quality] ?? degreeMap[""];
    if (levelMap) {
      newQuality = levelMap[level];
      harmonicFunction = FUNCTION_NAMES[degree];
    } else {
      const fb = FALLBACK[quality];
      if (!fb) return null;
      newQuality = fb[level];
    }
  } else {
    const fb = FALLBACK[quality];
    if (!fb) return null;
    newQuality = fb[level];
  }

  const substituted = root + newQuality;
  const category = QUALITY_TO_CATEGORY[newQuality] || "Tríades Maiores";
  const chordId = CHORD_ID_MAP[root]?.[newQuality];

  return {
    original: token,
    substituted,
    category,
    chordId,
    harmonicFunction,
  };
}

// ── Tokenisation ──────────────────────────────────────────────────────────────
interface Token {
  type: "chord" | "text";
  value: string;
  substitution?: SubstitutionResult;
}

const CHORD_REGEX =
  /\b([A-G][b#]?(?:m7\(b5\)|m7b5|7sus4|9sus4|maj9|maj7|add9|7M|7\+|m7|m6|m9|m|°|dim7|dim|aug|sus4|sus2|6\/9|7|9|11|13|6|\+)?(?:\/[A-G][b#]?)?)\b/g;

function tokenizeLine(line: string, level: SophisticationLevel, keySemitone: number): Token[] {
  const tokens: Token[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  CHORD_REGEX.lastIndex = 0;

  while ((match = CHORD_REGEX.exec(line)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: "text", value: line.slice(lastIndex, match.index) });
    }
    const tokenStr = match[1];
    const sub = substituteChordInKey(tokenStr, level, keySemitone);
    if (sub) {
      tokens.push({ type: "chord", value: tokenStr, substitution: sub });
    } else {
      tokens.push({ type: "text", value: tokenStr });
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < line.length) {
    tokens.push({ type: "text", value: line.slice(lastIndex) });
  }
  return tokens;
}

// ── Public API ────────────────────────────────────────────────────────────────
export interface ProcessedLine {
  tokens: Token[];
  hasChords: boolean;
}

export function processChordChart(text: string, level: SophisticationLevel): ProcessedLine[] {
  // Step 1: detect key from all chord roots in the entire text
  const allRoots: number[] = [];
  let m: RegExpExecArray | null;
  const scanRegex = /\b([A-G][b#]?)/g;
  while ((m = scanRegex.exec(text)) !== null) {
    const semitone = NOTE_TO_SEMITONE[normalizeRoot(m[1])];
    if (semitone !== undefined) allRoots.push(semitone);
  }
  const keySemitone = detectKey(allRoots);

  // Step 2: tokenise line by line using the detected key
  return text.split("\n").map((line) => {
    const tokens = tokenizeLine(line, level, keySemitone);
    const hasChords = tokens.some((t) => t.type === "chord" && t.substitution);
    return { tokens, hasChords };
  });
}

// Re-export SubstitutionResult for use in chord-substitutor page
export type { Token };
