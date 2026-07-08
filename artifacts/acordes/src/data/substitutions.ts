export type SophisticationLevel = "suave" | "intermediario" | "avancado";

export interface SubstitutionResult {
  original: string;
  substituted: string;
  category: string;
  chordId?: string;
  harmonicFunction?: string;
}

// ── Semitones ─────────────────────────────────────────────────────────────────
const NOTE_TO_SEMITONE: Record<string, number> = {
  C: 0, "B#": 0, Db: 1, "C#": 1, D: 2, Eb: 3, "D#": 3,
  E: 4, Fb: 4, F: 5, "E#": 5, Gb: 6, "F#": 6, G: 7,
  Ab: 8, "G#": 8, A: 9, Bb: 10, "A#": 10, B: 11, Cb: 11,
};

const ENHARMONIC_ROOT: Record<string, string> = {
  "C#": "Db", "D#": "Eb", "E#": "F", "F#": "Gb",
  "G#": "Ab", "A#": "Bb", "B#": "C",
};

// Intervalos das escalas a partir da tônica
const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11]; // I II III IV V VI VII
const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10]; // i ii° III iv v VI VII

// ── Nomes de função harmônica ─────────────────────────────────────────────────
const FUNCTION_NAMES_MAJOR: Record<number, string> = {
  0: "I grau — Tônica",
  1: "II grau — Supertônica",
  2: "III grau — Mediante",
  3: "IV grau — Subdominante",
  4: "V grau — Dominante",
  5: "VI grau — Submediante",
  6: "VII grau — Sensível",
};

const FUNCTION_NAMES_MINOR: Record<number, string> = {
  0: "i grau — Tônica menor",
  1: "ii° grau — Semidim / Sensível",
  2: "III grau — Relativa maior",
  3: "iv grau — Subdominante menor",
  4: "v grau — Dominante",
  5: "VI grau — Submediante maior",
  6: "VII grau — Subtônica",
};

// ── Tipos de sofisticação por grau ────────────────────────────────────────────
// Suave       → sofisticação básica (7M, m7, sus4/7sus4, °/m7(b5))
// Intermediário → sofisticação gospel/worship moderna (9, m7(9), 7sus4(9))
// Avançado    → harmonia mais rica (7M(9), m7(11), 7sus4(9), 6)

type QualityMap = Record<string, Record<SophisticationLevel, string>>;

// ── CAMPO HARMÔNICO MAIOR ─────────────────────────────────────────────────────
// I   → 7M / 9 / 7M(9) / 6
// ii  → m7 / m7(9) / m7(11)
// iii → m7 / m7(9) / m7(9)
// IV  → 7M / 9 / 7M(9) / 6
// V   → sus4 / 7sus4 / 7sus4(9)
// vi  → m7 / m7(9) / m7(11)
// vii → ° / m7(b5) / m7(b5)
const CAMPO_MAIOR: Record<number, QualityMap> = {
  0: { // I — Tônica Maior   suave=7M  intermediário=7M(9)  avançado=7M(9)
    "":          { suave: "7M",       intermediario: "7M(9)",    avancado: "7M(9)"    },
    "7M":        { suave: "7M",       intermediario: "7M(9)",    avancado: "7M(9)"    },
    "9":         { suave: "7M",       intermediario: "7M(9)",    avancado: "7M(9)"    },
    "7M(9)":     { suave: "7M",       intermediario: "7M(9)",    avancado: "7M(9)"    },
    "6":         { suave: "6",        intermediario: "6",        avancado: "6"        },
    "add9":      { suave: "7M",       intermediario: "7M(9)",    avancado: "7M(9)"    },
    "sus2":      { suave: "sus2",     intermediario: "sus2",     avancado: "sus2"     },
    "sus4":      { suave: "sus4",     intermediario: "sus4",     avancado: "sus4"     },
    "maj7":      { suave: "7M",       intermediario: "7M(9)",    avancado: "7M(9)"    },
    "6/9":       { suave: "6",        intermediario: "6",        avancado: "6"        },
  },
  1: { // ii — Supertônica Menor
    "m":         { suave: "m7",       intermediario: "m7(9)",    avancado: "m7(11)"   },
    "m7":        { suave: "m7",       intermediario: "m7(9)",    avancado: "m7(11)"   },
    "m9":        { suave: "m7",       intermediario: "m7(9)",    avancado: "m7(11)"   },
    "m7(9)":     { suave: "m7",       intermediario: "m7(9)",    avancado: "m7(11)"   },
    "m7(11)":    { suave: "m7",       intermediario: "m7(9)",    avancado: "m7(11)"   },
    "":          { suave: "7M",       intermediario: "7M(9)",    avancado: "7M(9)"    }, // II maior
    "7":         { suave: "7sus4",    intermediario: "7sus4",    avancado: "7sus4"    }, // V/V
    "add9":      { suave: "m7",       intermediario: "m7(9)",    avancado: "m7(11)"   },
  },
  2: { // iii — Mediante Menor
    "m":         { suave: "m7",       intermediario: "m7(9)",    avancado: "m7(9)"    },
    "m7":        { suave: "m7",       intermediario: "m7(9)",    avancado: "m7(9)"    },
    "m9":        { suave: "m7",       intermediario: "m7(9)",    avancado: "m7(9)"    },
    "m7(9)":     { suave: "m7",       intermediario: "m7(9)",    avancado: "m7(9)"    },
    "":          { suave: "7M",       intermediario: "7M(9)",    avancado: "7M(9)"    },
    "7":         { suave: "7sus4",    intermediario: "7sus4",    avancado: "7sus4"    },
    "add9":      { suave: "m7",       intermediario: "m7(9)",    avancado: "m7(9)"    },
  },
  3: { // IV — Subdominante Maior   suave=7M  intermediário=7M(9)  avançado=7M(9)
    "":          { suave: "7M",       intermediario: "7M(9)",    avancado: "7M(9)"    },
    "7M":        { suave: "7M",       intermediario: "7M(9)",    avancado: "7M(9)"    },
    "9":         { suave: "7M",       intermediario: "7M(9)",    avancado: "7M(9)"    },
    "7M(9)":     { suave: "7M",       intermediario: "7M(9)",    avancado: "7M(9)"    },
    "6":         { suave: "6",        intermediario: "6",        avancado: "6"        },
    "add9":      { suave: "7M",       intermediario: "7M(9)",    avancado: "7M(9)"    },
    "sus4":      { suave: "sus4",     intermediario: "sus4",     avancado: "sus4"     },
    "sus2":      { suave: "sus2",     intermediario: "sus2",     avancado: "sus2"     },
    "maj7":      { suave: "7M",       intermediario: "7M(9)",    avancado: "7M(9)"    },
    "6/9":       { suave: "6",        intermediario: "6",        avancado: "6"        },
    "m":         { suave: "m7",       intermediario: "m7(9)",    avancado: "m7(11)"   }, // IVm (empréstimo)
    "m7":        { suave: "m7",       intermediario: "m7(9)",    avancado: "m7(11)"   },
  },
  4: { // V — Dominante   suave=sus4  intermediário=7sus4  avançado=7sus4(9)
    "":          { suave: "sus4",     intermediario: "7sus4",    avancado: "7sus4"    },
    "7":         { suave: "7sus4",    intermediario: "7sus4",    avancado: "7sus4"    },
    "sus4":      { suave: "sus4",     intermediario: "7sus4",    avancado: "7sus4"    },
    "7sus4":     { suave: "7sus4",    intermediario: "7sus4",    avancado: "7sus4"    },
    "7sus4(9)":  { suave: "7sus4",    intermediario: "7sus4"   , avancado: "7sus4"    },
    "add9":      { suave: "sus4",     intermediario: "7sus4",    avancado: "7sus4"    },
    "9":         { suave: "7sus4",    intermediario: "7sus4"   , avancado: "7sus4"    },
    "9sus4":     { suave: "7sus4",    intermediario: "7sus4"   , avancado: "7sus4"    },
    "sus2":      { suave: "sus2",     intermediario: "7sus4",    avancado: "7sus4"    },
    "7M":        { suave: "7M",       intermediario: "7M(9)",    avancado: "7M(9)"    }, // V com função tônica
    "m":         { suave: "m7",       intermediario: "m7(9)",    avancado: "m7(9)"    },
  },
  5: { // vi — Submediante Menor
    "m":         { suave: "m7",       intermediario: "m7(9)",    avancado: "m7(11)"   },
    "m7":        { suave: "m7",       intermediario: "m7(9)",    avancado: "m7(11)"   },
    "m9":        { suave: "m7",       intermediario: "m7(9)",    avancado: "m7(11)"   },
    "m7(9)":     { suave: "m7",       intermediario: "m7(9)",    avancado: "m7(11)"   },
    "m7(11)":    { suave: "m7",       intermediario: "m7(9)",    avancado: "m7(11)"   },
    "add9":      { suave: "m7",       intermediario: "m7(9)",    avancado: "m7(11)"   },
    "":          { suave: "7M",       intermediario: "7M(9)",    avancado: "7M(9)"    }, // VI maior
    "7":         { suave: "7sus4",    intermediario: "7sus4",    avancado: "7sus4"    },
  },
  6: { // vii° — Sensível / Diminuto
    "":          { suave: "°",        intermediario: "m7(b5)",   avancado: "m7(b5)"   },
    "°":         { suave: "°",        intermediario: "m7(b5)",   avancado: "m7(b5)"   },
    "dim":       { suave: "°",        intermediario: "m7(b5)",   avancado: "m7(b5)"   },
    "m":         { suave: "m7(b5)",   intermediario: "m7(b5)",   avancado: "m7(b5)"   },
    "m7":        { suave: "m7(b5)",   intermediario: "m7(b5)",   avancado: "m7(b5)"   },
    "m7(b5)":    { suave: "m7(b5)",   intermediario: "m7(b5)",   avancado: "m7(b5)"   },
    "m7b5":      { suave: "m7(b5)",   intermediario: "m7(b5)",   avancado: "m7(b5)"   },
  },
};

// ── CAMPO HARMÔNICO MENOR NATURAL ─────────────────────────────────────────────
// i   → m7 / m7(9) / m7(11)
// ii° → ° / m7(b5) / m7(b5)
// III → 7M / 7M(9) / 7M(9)
// iv  → m7 / m7(9) / m7(11)
// v   → m7 / m7(9) (menor natural) ou 7sus4 (harmônico/gospel)
// VI  → 7M / 7M(9) / 7M(9)
// VII → 7M / 7M(9) / 7M(9)
const CAMPO_MENOR: Record<number, QualityMap> = {
  0: { // i — Tônica Menor   suave=m7  intermediário=m7(9)  avançado=m7(11)
    "m":         { suave: "m7",       intermediario: "m7(9)",    avancado: "m7(11)"   },
    "m7":        { suave: "m7",       intermediario: "m7(9)",    avancado: "m7(11)"   },
    "m9":        { suave: "m7",       intermediario: "m7(9)",    avancado: "m7(11)"   },
    "m7(9)":     { suave: "m7",       intermediario: "m7(9)",    avancado: "m7(11)"   },
    "m7(11)":    { suave: "m7",       intermediario: "m7(9)",    avancado: "m7(11)"   },
    "":          { suave: "m7",       intermediario: "m7(9)",    avancado: "m7(11)"   },
    "add9":      { suave: "m7",       intermediario: "m7(9)",    avancado: "m7(11)"   },
  },
  1: { // ii° — Meio-diminuto / Sensível Menor
    "m":         { suave: "m7(b5)",   intermediario: "m7(b5)",   avancado: "m7(b5)"   },
    "°":         { suave: "°",        intermediario: "m7(b5)",   avancado: "m7(b5)"   },
    "dim":       { suave: "°",        intermediario: "m7(b5)",   avancado: "m7(b5)"   },
    "m7(b5)":    { suave: "m7(b5)",   intermediario: "m7(b5)",   avancado: "m7(b5)"   },
    "m7b5":      { suave: "m7(b5)",   intermediario: "m7(b5)",   avancado: "m7(b5)"   },
    "m7":        { suave: "m7(b5)",   intermediario: "m7(b5)",   avancado: "m7(b5)"   },
    "":          { suave: "m7(b5)",   intermediario: "m7(b5)",   avancado: "m7(b5)"   },
  },
  2: { // III — Relativa Maior   suave=7M  intermediário=7M(9)  avançado=7M(9)
    "":          { suave: "7M",       intermediario: "7M(9)",    avancado: "7M(9)"    },
    "7M":        { suave: "7M",       intermediario: "7M(9)",    avancado: "7M(9)"    },
    "9":         { suave: "7M",       intermediario: "7M(9)",    avancado: "7M(9)"    },
    "7M(9)":     { suave: "7M",       intermediario: "7M(9)",    avancado: "7M(9)"    },
    "add9":      { suave: "7M",       intermediario: "7M(9)",    avancado: "7M(9)"    },
    "maj7":      { suave: "7M",       intermediario: "7M(9)",    avancado: "7M(9)"    },
    "6/9":       { suave: "6",        intermediario: "6",        avancado: "6"        },
  },
  3: { // iv — Subdominante Menor
    "m":         { suave: "m7",       intermediario: "m7(9)",    avancado: "m7(11)"   },
    "m7":        { suave: "m7",       intermediario: "m7(9)",    avancado: "m7(11)"   },
    "m9":        { suave: "m7",       intermediario: "m7(9)",    avancado: "m7(11)"   },
    "m7(9)":     { suave: "m7",       intermediario: "m7(9)",    avancado: "m7(11)"   },
    "m7(11)":    { suave: "m7",       intermediario: "m7(9)",    avancado: "m7(11)"   },
    "":          { suave: "m7",       intermediario: "m7(9)",    avancado: "m7(11)"   },
    "add9":      { suave: "m7",       intermediario: "m7(9)",    avancado: "m7(11)"   },
  },
  4: { // v — Dominante (em menor natural = menor; gospel usa o V maior/7sus4)
    "m":         { suave: "m7",       intermediario: "m7(9)",    avancado: "m7(9)"    },
    "m7":        { suave: "m7",       intermediario: "m7(9)",    avancado: "m7(9)"    },
    "":          { suave: "7sus4",    intermediario: "7sus4",    avancado: "7sus4"    }, // V maior → dominante harmônico
    "7":         { suave: "7sus4",    intermediario: "7sus4",    avancado: "7sus4"    },
    "sus4":      { suave: "sus4",     intermediario: "7sus4",    avancado: "7sus4"    },
    "7sus4":     { suave: "7sus4",    intermediario: "7sus4",    avancado: "7sus4"    },
    "add9":      { suave: "7sus4",    intermediario: "7sus4",    avancado: "7sus4"    },
  },
  5: { // VI — Submediante Maior   suave=7M  intermediário=7M(9)  avançado=7M(9)
    "":          { suave: "7M",       intermediario: "7M(9)",    avancado: "7M(9)"    },
    "7M":        { suave: "7M",       intermediario: "7M(9)",    avancado: "7M(9)"    },
    "9":         { suave: "7M",       intermediario: "7M(9)",    avancado: "7M(9)"    },
    "7M(9)":     { suave: "7M",       intermediario: "7M(9)",    avancado: "7M(9)"    },
    "add9":      { suave: "7M",       intermediario: "7M(9)",    avancado: "7M(9)"    },
    "maj7":      { suave: "7M",       intermediario: "7M(9)",    avancado: "7M(9)"    },
    "6/9":       { suave: "6",        intermediario: "6",        avancado: "6"        },
  },
  6: { // VII — Subtônica Maior   suave=7M  intermediário=7M(9)  avançado=7M(9)
    "":          { suave: "7M",       intermediario: "7M(9)",    avancado: "7M(9)"    },
    "7M":        { suave: "7M",       intermediario: "7M(9)",    avancado: "7M(9)"    },
    "9":         { suave: "7M",       intermediario: "7M(9)",    avancado: "7M(9)"    },
    "7M(9)":     { suave: "7M",       intermediario: "7M(9)",    avancado: "7M(9)"    },
    "add9":      { suave: "7M",       intermediario: "7M(9)",    avancado: "7M(9)"    },
    "maj7":      { suave: "7M",       intermediario: "7M(9)",    avancado: "7M(9)"    },
    "7":         { suave: "7sus4",    intermediario: "7sus4",    avancado: "7sus4"    }, // VII7
    "sus4":      { suave: "sus4",     intermediario: "7sus4",    avancado: "7sus4"    },
  },
};

// ── Fallback para acordes fora do campo harmônico ─────────────────────────────
const FALLBACK: QualityMap = {
  "":           { suave: "7M",       intermediario: "7M(9)",    avancado: "7M(9)"    },
  "7M":         { suave: "7M",       intermediario: "7M(9)",    avancado: "7M(9)"    },
  "9":          { suave: "7M",       intermediario: "7M(9)",    avancado: "7M(9)"    },
  "7M(9)":      { suave: "7M",       intermediario: "7M(9)",    avancado: "7M(9)"    },
  "6":          { suave: "6",        intermediario: "6",        avancado: "6"        },
  "6/9":        { suave: "6",        intermediario: "6",        avancado: "6"        },
  "add9":       { suave: "7M",       intermediario: "7M(9)",    avancado: "7M(9)"    },
  "maj7":       { suave: "7M",       intermediario: "7M(9)",    avancado: "7M(9)"    },
  "m":          { suave: "m7",       intermediario: "m7(9)",    avancado: "m7(11)"   },
  "m7":         { suave: "m7",       intermediario: "m7(9)",    avancado: "m7(11)"   },
  "m9":         { suave: "m7",       intermediario: "m7(9)",    avancado: "m7(11)"   },
  "m7(9)":      { suave: "m7",       intermediario: "m7(9)",    avancado: "m7(11)"   },
  "m7(11)":     { suave: "m7",       intermediario: "m7(9)",    avancado: "m7(11)"   },
  "7":          { suave: "7sus4",    intermediario: "7sus4",    avancado: "7sus4"    },
  "7sus4":      { suave: "7sus4",    intermediario: "7sus4",    avancado: "7sus4"    },
  "7sus4(9)":   { suave: "7sus4",    intermediario: "7sus4"   , avancado: "7sus4"    },
  "sus4":       { suave: "sus4",     intermediario: "7sus4",    avancado: "7sus4"    },
  "sus2":       { suave: "sus2",     intermediario: "sus2",     avancado: "sus2"     },
  "9sus4":      { suave: "7sus4",    intermediario: "7sus4"   , avancado: "7sus4"    },
  "°":          { suave: "°",        intermediario: "m7(b5)",   avancado: "m7(b5)"   },
  "dim":        { suave: "°",        intermediario: "m7(b5)",   avancado: "m7(b5)"   },
  "m7(b5)":     { suave: "m7(b5)",   intermediario: "m7(b5)",   avancado: "m7(b5)"   },
  "m7b5":       { suave: "m7(b5)",   intermediario: "m7(b5)",   avancado: "m7(b5)"   },
  "11":         { suave: "7sus4",    intermediario: "7sus4",    avancado: "7sus4"    },
  "13":         { suave: "7M",       intermediario: "7M(9)",    avancado: "7M(9)"    },
};

// ── Chord ID map — root + nova qualidade → ID REAL no dicionário ──────────────
// IMPORTANTE: todos os IDs aqui DEVEM existir em chords.ts. Qualidades sem
// entrada no dicionário (ex.: 7sus4(9)) NÃO devem ser geradas pelo sofisticador.
const ROOTS = ["C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B"] as const;
const CHORD_ID_MAP: Record<string, Record<string, string>> = Object.fromEntries(
  ROOTS.map((r) => [r, {
    "":         `${r}-maior`,
    "7M":       `${r}7M`,
    "7M(9)":    `${r}9M`,        // dicionário: "Com 7ªM e 9ª"
    "6":        `${r}6-9`,       // dicionário: "Com 6ª" (6/9)
    "sus4":     `${r}sus4`,
    "sus2":     `${r}sus2`,
    "m":        `${r}m`,
    "m7":       `${r}m7`,
    "m7(9)":    `${r}m9`,        // dicionário: "Menores com 7ª e 9ª"
    "m7(11)":   `${r}m11`,       // dicionário: "Menores com 7ª e 11ª"
    "7sus4":    `${r}7sus4`,
    "°":        `${r}-dim`,
    "m7(b5)":   `${r}m7b5`,
  }])
);

// Categoria correspondente à nova qualidade gerada
const QUALITY_TO_CATEGORY: Record<string, string> = {
  "":         "Tríades Maiores",
  "7M":       "Maiores com 7ªM",
  "7M(9)":    "Com 7ªM e 9ª",
  "6":        "Com 6ª",
  "sus4":     "Sus4",
  "sus2":     "Sus2",
  "m":        "Tríades Menores",
  "m7":       "Menores com 7ª",
  "m7(9)":    "Menores com 7ª e 9ª",
  "m7(11)":   "Menores com 7ª e 11ª",
  "7sus4":    "7sus4",
  "°":        "Diminutos",
  "m7(b5)":   "Meio-Diminutos",
};

// ── Parsing helpers ───────────────────────────────────────────────────────────
const NOTE_REGEX = /^([A-G][b#]?)/;

const QUALITY_PATTERNS = [
  "m7(b5)", "m7b5", "7sus4(9)", "7sus4", "9sus4", "m7(9)", "m7(11)", "7M(9)",
  "maj9", "maj7", "add9", "add11", "sus4", "sus2", "dim7", "7M",
  "m7", "m9", "m6", "6/9", "7+", "m", "°", "dim", "aug",
  "7", "9", "11", "13", "6", "+",
];

export function parseChordToken(token: string): { root: string; quality: string } | null {
  const noteMatch = token.match(NOTE_REGEX);
  if (!noteMatch) return null;
  const root = noteMatch[1];
  let rest = token.slice(root.length);

  // Remove bass note e.g. /G
  const bassIdx = rest.indexOf("/");
  if (bassIdx > 0) rest = rest.slice(0, bassIdx);

  let quality = "";
  for (const pat of QUALITY_PATTERNS) {
    if (rest === pat || rest.startsWith(pat + " ")) {
      quality = pat;
      break;
    }
    if (rest === pat) {
      quality = pat;
      break;
    }
  }
  if (rest !== "" && quality === "") {
    // Unknown suffix — pass through
    quality = rest;
  }

  return { root, quality };
}

function normalizeRoot(root: string): string {
  return ENHARMONIC_ROOT[root] || root;
}

// ── Detecção de tonalidade (maior ou menor) ───────────────────────────────────
interface Tonality {
  keySemitone: number;
  isMinor: boolean;
}

function detectTonality(
  tokens: Array<{ root: string; quality: string }>,
  rawText: string
): Tonality {
  if (tokens.length === 0) return { keySemitone: 0, isMinor: false };

  const roots = tokens
    .map((t) => NOTE_TO_SEMITONE[normalizeRoot(t.root)] ?? -1)
    .filter((s) => s >= 0);

  // Encontra a melhor tonalidade maior por pontuação diatônica
  let bestMajorKey = 0, bestScore = -1;
  for (let k = 0; k < 12; k++) {
    const score = roots.filter((r) => MAJOR_SCALE.some((s) => (s + k) % 12 === r)).length;
    if (score > bestScore) { bestScore = score; bestMajorKey = k; }
  }

  // A tônica menor relativa está a 9 semitons acima (ou 3 abaixo) da maior
  const relMinorSemitone = (bestMajorKey + 9) % 12;

  // Verifica o primeiro e o último acorde da progressão para o centro tonal
  const first = tokens[0];
  const last  = tokens[tokens.length - 1];
  const firstSem = NOTE_TO_SEMITONE[normalizeRoot(first.root)] ?? -1;
  const lastSem  = NOTE_TO_SEMITONE[normalizeRoot(last.root)] ?? -1;

  const isMinorQuality = (q: string) =>
    q.startsWith("m") || q === "°" || q === "dim";

  const firstIsMinorRoot = firstSem === relMinorSemitone && isMinorQuality(first.quality);
  const lastIsMinorRoot  = lastSem  === relMinorSemitone && isMinorQuality(last.quality);

  // Conta quantas vezes o acorde menor relativo aparece (peso adicional)
  const relMinorCount = tokens.filter(
    (t) =>
      (NOTE_TO_SEMITONE[normalizeRoot(t.root)] ?? -1) === relMinorSemitone &&
      isMinorQuality(t.quality)
  ).length;

  const isMinor =
    firstIsMinorRoot ||
    (lastIsMinorRoot && relMinorCount >= 2);

  return { keySemitone: isMinor ? relMinorSemitone : bestMajorKey, isMinor };
}

// ── Substituição de um acorde no contexto da tonalidade ───────────────────────
function substituteChordInKey(
  token: string,
  level: SophisticationLevel,
  tonality: Tonality
): SubstitutionResult | null {
  const parsed = parseChordToken(token);
  if (!parsed) return null;

  const { quality } = parsed;
  const originalRoot = parsed.root;               // preserva C# / F# / Bb etc.
  const normalRoot   = normalizeRoot(parsed.root); // Db / Gb / Bb — para busca no dicionário
  const rootSemitone = NOTE_TO_SEMITONE[normalRoot];
  if (rootSemitone === undefined) return null;

  const { keySemitone, isMinor } = tonality;
  const scale = isMinor ? MINOR_SCALE : MAJOR_SCALE;
  const campo = isMinor ? CAMPO_MENOR : CAMPO_MAIOR;
  const functionNames = isMinor ? FUNCTION_NAMES_MINOR : FUNCTION_NAMES_MAJOR;

  const relative = (rootSemitone - keySemitone + 12) % 12;
  const degree   = scale.indexOf(relative);

  let newQuality: string;
  let harmonicFunction: string | undefined;

  if (degree >= 0 && campo[degree]) {
    const degreeMap = campo[degree];
    // Usa o mapa específico da qualidade. Só usa degreeMap[""] se o
    // acorde original também não tinha qualidade (tríade pura).
    const levelMap = degreeMap[quality] ?? (quality === "" ? degreeMap[""] : undefined);
    if (levelMap) {
      newQuality = levelMap[level];
      harmonicFunction = functionNames[degree];
    } else {
      // Qualidade não mapeada para este grau → fallback por família
      const fb = FALLBACK[quality];
      if (!fb) return null;
      newQuality = fb[level];
      harmonicFunction = functionNames[degree];
    }
  } else {
    const fb = FALLBACK[quality];
    if (!fb) return null;
    newQuality = fb[level];
  }

  // Monta o acorde de saída preservando a notação original (# ou b)
  const substituted = originalRoot + newQuality;
  const category    = QUALITY_TO_CATEGORY[newQuality] || "Tríades Maiores";
  // ID no dicionário usa a raiz normalizada (Db, Gb…) pois o PDF usa bemóis
  const chordId     = CHORD_ID_MAP[normalRoot]?.[newQuality];

  return { original: token, substituted, category, chordId, harmonicFunction };
}

// ── Tokenização ───────────────────────────────────────────────────────────────
interface Token {
  type: "chord" | "text";
  value: string;
  substitution?: SubstitutionResult;
}

const CHORD_REGEX =
  /(?<![A-Za-z])([A-G][b#]?(?:m7\(b5\)|m7b5|7sus4\(9\)|7sus4|9sus4|m7\(11\)|m7\(9\)|7M\(9\)|maj9|maj7|add9|7M|7\+|m7|m9|m6|m|°|dim7|dim|aug|sus4|sus2|6\/9|7|9|11|13|6|\+)?(?:\/[A-G][b#]?)?)(?![A-Za-z0-9])/g;

function tokenizeLine(
  line: string,
  level: SophisticationLevel,
  tonality: Tonality
): Token[] {
  const tokens: Token[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  CHORD_REGEX.lastIndex = 0;

  while ((match = CHORD_REGEX.exec(line)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: "text", value: line.slice(lastIndex, match.index) });
    }
    const tokenStr = match[1];
    const sub = substituteChordInKey(tokenStr, level, tonality);
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

// ── Nota por semitom (padrão do PDF — bemóis) ────────────────────────────────
const SEMITONE_TO_NOTE = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

// ── API pública ───────────────────────────────────────────────────────────────
export interface ProcessedLine {
  tokens: Token[];
  hasChords: boolean;
}

export interface DetectedTonality {
  keyName: string;   // e.g. "C", "Am", "Bb", "F#m"
  isMinor: boolean;
  keySemitone: number;
}

function extractAllParsed(text: string): Array<{ root: string; quality: string }> {
  const allParsed: Array<{ root: string; quality: string }> = [];
  const scanRegex = /(?<![A-Za-z])([A-G][b#]?(?:m7\(b5\)|m7b5|7sus4\(9\)|7sus4|9sus4|m7\(11\)|m7\(9\)|7M\(9\)|maj9|maj7|add9|7M|7\+|m7|m9|m6|m|°|dim7|dim|aug|sus4|sus2|6\/9|7|9|11|13|6|\+)?(?:\/[A-G][b#]?)?)(?![A-Za-z0-9])/g;
  let m: RegExpExecArray | null;
  while ((m = scanRegex.exec(text)) !== null) {
    const parsed = parseChordToken(m[1]);
    if (parsed && NOTE_TO_SEMITONE[normalizeRoot(parsed.root)] !== undefined) {
      allParsed.push(parsed);
    }
  }
  return allParsed;
}

// ID no dicionário para um acorde escrito como está (sem substituição) — usado
// pela visualização "Original" do Sofisticador, para o popup abrir o acorde certo.
export function chordIdForToken(token: string): string | undefined {
  const parsed = parseChordToken(token);
  if (!parsed) return undefined;
  return CHORD_ID_MAP[normalizeRoot(parsed.root)]?.[parsed.quality];
}

export function processChordChart(text: string, level: SophisticationLevel): ProcessedLine[] {
  const allParsed = extractAllParsed(text);
  const tonality  = detectTonality(allParsed, text);
  return text.split("\n").map((line) => {
    const tokens = tokenizeLine(line, level, tonality);
    const hasChords = tokens.some((t) => t.type === "chord" && t.substitution);
    return { tokens, hasChords };
  });
}

export function processChordChartFull(
  text: string,
  level: SophisticationLevel
): { lines: ProcessedLine[]; tonality: DetectedTonality } {
  const allParsed = extractAllParsed(text);
  const tonality  = detectTonality(allParsed, text);

  const keyNote = SEMITONE_TO_NOTE[tonality.keySemitone] ?? "C";
  const keyName = tonality.isMinor ? `${keyNote}m` : keyNote;

  const lines = text.split("\n").map((line) => {
    const tokens = tokenizeLine(line, level, tonality);
    const hasChords = tokens.some((t) => t.type === "chord" && t.substitution);
    return { tokens, hasChords };
  });

  return {
    lines,
    tonality: { keyName, isMinor: tonality.isMinor, keySemitone: tonality.keySemitone },
  };
}

export type { Token };
