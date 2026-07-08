// ── Voicings (variações no teclado) para acordes de 4 notas ──────────────────
// Compartilhado entre o Dicionário de Acordes (chord-detail) e o ChordPopup,
// para as variações aparecerem iguais nos dois lugares.

export interface Voicing {
  label: string;
  leftHand: string[];
  rightHand: string[];
}

// Voicings exatos extraídos das imagens do PDF para todos os 12 acordes Maior7M.
// Padrão lido nas imagens:
//   V1 — posição fundamental : LH=[R, 5ª],  RH=[R, 3ª, 5ª, 7ª]
//   V2 — 1ª inversão         : LH=[R, 5ª],  RH=[3ª, 5ª, 7ª, R]
//   V3 — 2ª inversão         : LH=[R, 5ª],  RH=[5ª, 7ª, R, 3ª]
//   V4 — 3ª inversão         : LH=[R, 5ª],  RH=[7ª, R, 3ª, 5ª]
//   V5 — shell voicing       : LH=[R, 3ª],  RH=[5ª, 7ª, R]
// placeNotes() trata automaticamente os saltos de oitava com base na ordem das notas.
const VOICINGS_7M: Record<string, Voicing[]> = (() => {
  function make(r: string, t: string, f: string, s: string): Voicing[] {
    return [
      { label: "Posição fundamental", leftHand: [r, f], rightHand: [r, t, f, s] },
      { label: "1ª inversão",         leftHand: [r, f], rightHand: [t, f, s, r] },
      { label: "2ª inversão",         leftHand: [r, f], rightHand: [f, s, r, t] },
      { label: "3ª inversão",         leftHand: [r, f], rightHand: [s, r, t, f] },
      { label: "Shell voicing",       leftHand: [r, t], rightHand: [f, s, r]    },
    ];
  }
  return {
    "C7M":  make("C",  "E",  "G",  "B"),
    "Db7M": make("Db", "F",  "Ab", "C"),
    "D7M":  make("D",  "F#", "A",  "C#"),
    "Eb7M": make("Eb", "G",  "Bb", "D"),
    "E7M":  make("E",  "G#", "B",  "D#"),
    "F7M":  make("F",  "A",  "C",  "E"),
    "Gb7M": make("F#", "A#", "C#", "F"),
    "G7M":  make("G",  "B",  "D",  "F#"),
    "Ab7M": make("Ab", "C",  "Eb", "G"),
    "A7M":  make("A",  "C#", "E",  "G#"),
    "Bb7M": make("Bb", "D",  "F",  "A"),
    "B7M":  make("B",  "D#", "F#", "A#"),
  };
})();

export function getVoicings7M(chordId: string, notes: string[]): Voicing[] {
  const hardcoded = VOICINGS_7M[chordId];
  if (hardcoded) return hardcoded;
  // Fallback genérico para outros acordes de 4 notas
  const [n0, n1, n2, n3] = notes;
  return [
    { label: "Posição fundamental", leftHand: [n0, n2], rightHand: [n0, n1, n2, n3] },
    { label: "1ª inversão",         leftHand: [n0, n2], rightHand: [n1, n2, n3, n0] },
    { label: "2ª inversão",         leftHand: [n0, n2], rightHand: [n2, n3, n0, n1] },
    { label: "3ª inversão",         leftHand: [n0, n2], rightHand: [n3, n0, n1, n2] },
    { label: "Shell voicing",       leftHand: [n0, n1], rightHand: [n2, n3, n0]    },
  ];
}
