interface PianoKeyboardProps {
  leftHandNotes: string[];
  rightHandNotes: string[];
  className?: string;
}

// Note name → semitone (pitch class 0-11)
const NOTE_SEMITONE: Record<string, number> = {
  C: 0, "B#": 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3,
  E: 4, Fb: 4, F: 5, "E#": 5, "F#": 6, Gb: 6, G: 7,
  "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11, Cb: 11,
};

// White keys per octave
const WHITE_KEYS = [
  { note: "C", semitone: 0 },
  { note: "D", semitone: 2 },
  { note: "E", semitone: 4 },
  { note: "F", semitone: 5 },
  { note: "G", semitone: 7 },
  { note: "A", semitone: 9 },
  { note: "B", semitone: 11 },
];

// Black keys: semitone + position
const BLACK_KEYS = [
  { semitone: 1,  afterWhite: 0, label: "Db" },
  { semitone: 3,  afterWhite: 1, label: "Eb" },
  { semitone: 6,  afterWhite: 3, label: "Gb" },
  { semitone: 8,  afterWhite: 4, label: "Ab" },
  { semitone: 10, afterWhite: 5, label: "Bb" },
];

// Colors
const COLORS = {
  leftHand:       "#ef4444", // coral vermelho — mão esquerda
  leftHandDark:   "#b91c1c",
  rightHand:      "#f59e0b", // âmbar dourado — mão direita
  rightHandDark:  "#d97706",
  whiteKey:       "#f5f0e8",
  whiteKeyEdge:   "#d1cdc4",
  blackKey:       "#1c1917",
  keyStroke:      "#9ca3af",
};

const OCTAVES = 2;
const WW = 38;
const WH = 112;
const BW = 22;
const BH = 68;
const GAP = 1;
const SVG_W = OCTAVES * 7 * WW;
const SVG_H = WH + 24;

type Hand = "left" | "right" | null;

export function PianoKeyboard({ leftHandNotes, rightHandNotes, className }: PianoKeyboardProps) {
  // Build semitone → { hand, label } maps (left takes priority if both)
  const semitoneMap = new Map<number, { hand: Hand; label: string }>();

  rightHandNotes.forEach((n) => {
    const s = NOTE_SEMITONE[n];
    if (s !== undefined) semitoneMap.set(s, { hand: "right", label: n });
  });
  leftHandNotes.forEach((n) => {
    const s = NOTE_SEMITONE[n];
    if (s !== undefined) semitoneMap.set(s, { hand: "left", label: n });
  });

  function fillForHand(hand: Hand, isBlack: boolean): string {
    if (hand === "left")  return COLORS.leftHand;
    if (hand === "right") return COLORS.rightHand;
    return isBlack ? COLORS.blackKey : COLORS.whiteKey;
  }
  function strokeForHand(hand: Hand, isBlack: boolean): string {
    if (hand === "left")  return COLORS.leftHandDark;
    if (hand === "right") return COLORS.rightHandDark;
    return isBlack ? "#000" : COLORS.keyStroke;
  }
  function edgeForHand(hand: Hand): string {
    if (hand === "left")  return COLORS.leftHandDark;
    if (hand === "right") return COLORS.rightHandDark;
    return COLORS.whiteKeyEdge;
  }

  const allNotes = [...leftHandNotes, ...rightHandNotes];

  return (
    <div className={className} style={{ overflowX: "auto" }}>
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        width="100%"
        style={{ maxWidth: SVG_W, display: "block", margin: "0 auto" }}
        role="img"
        aria-label={`Teclado de piano — notas: ${allNotes.join(", ")}`}
      >
        {/* ── White keys ──────────────────────────────────────────── */}
        {Array.from({ length: OCTAVES }).flatMap((_, octave) =>
          WHITE_KEYS.map((wk, i) => {
            const x = (octave * 7 + i) * WW + GAP;
            const entry = semitoneMap.get(wk.semitone);
            const hand = entry?.hand ?? null;
            const label = entry?.label ?? null;

            return (
              <g key={`w-${octave}-${i}`}>
                <rect
                  x={x} y={0}
                  width={WW - GAP * 2} height={WH}
                  rx={3}
                  fill={fillForHand(hand, false)}
                  stroke={strokeForHand(hand, false)}
                  strokeWidth={hand ? 1.5 : 0.8}
                />
                {/* Bottom cap */}
                <rect
                  x={x} y={WH - 6}
                  width={WW - GAP * 2} height={6}
                  rx={3}
                  fill={edgeForHand(hand)}
                />
                {label && (
                  <text
                    x={x + (WW - GAP * 2) / 2} y={WH - 10}
                    textAnchor="middle" fontSize={10} fontWeight="700"
                    fontFamily="monospace" fill="#1a1a1a"
                  >
                    {label}
                  </text>
                )}
              </g>
            );
          })
        )}

        {/* ── Black keys ────────────────────────────────────────────── */}
        {Array.from({ length: OCTAVES }).flatMap((_, octave) =>
          BLACK_KEYS.map((bk) => {
            const whiteX = (octave * 7 + bk.afterWhite + 1) * WW;
            const x = whiteX - BW / 2;
            const entry = semitoneMap.get(bk.semitone);
            const hand = entry?.hand ?? null;
            const label = entry?.label ?? null;

            return (
              <g key={`b-${octave}-${bk.label}`}>
                <rect
                  x={x} y={0} width={BW} height={BH}
                  rx={2}
                  fill={fillForHand(hand, true)}
                  stroke={strokeForHand(hand, true)}
                  strokeWidth={0.5}
                />
                {/* Shine on inactive keys */}
                {!hand && (
                  <rect
                    x={x + 3} y={4} width={BW - 10} height={BH / 3}
                    rx={1} fill="rgba(255,255,255,0.08)"
                  />
                )}
                {label && (
                  <text
                    x={x + BW / 2} y={BH - 6}
                    textAnchor="middle" fontSize={8} fontWeight="700"
                    fontFamily="monospace"
                    fill={hand ? "#1a1a1a" : "#666"}
                  >
                    {label}
                  </text>
                )}
              </g>
            );
          })
        )}

        {/* ── Octave separators ──────────────────────────────────────── */}
        {Array.from({ length: OCTAVES }).map((_, octave) => (
          <line
            key={`sep-${octave}`}
            x1={octave * 7 * WW} y1={WH - 2}
            x2={(octave + 1) * 7 * WW} y2={WH - 2}
            stroke="rgba(255,255,255,0.1)" strokeWidth={1}
          />
        ))}
      </svg>
    </div>
  );
}
