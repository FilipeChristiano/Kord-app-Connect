interface PianoKeyboardProps {
  notes: string[];
  className?: string;
}

// Note name → semitone (pitch class 0-11)
const NOTE_SEMITONE: Record<string, number> = {
  C: 0, "B#": 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3,
  E: 4, Fb: 4, F: 5, "E#": 5, "F#": 6, Gb: 6, G: 7,
  "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11, Cb: 11,
};

// White keys per octave: note name + semitone + white-key index (0-6)
const WHITE_KEYS = [
  { note: "C", semitone: 0 },
  { note: "D", semitone: 2 },
  { note: "E", semitone: 4 },
  { note: "F", semitone: 5 },
  { note: "G", semitone: 7 },
  { note: "A", semitone: 9 },
  { note: "B", semitone: 11 },
];

// Black keys: semitone + position between white keys (afterWhiteIndex = index of white key to the left)
const BLACK_KEYS = [
  { semitone: 1,  afterWhite: 0, label: "Db" },
  { semitone: 3,  afterWhite: 1, label: "Eb" },
  { semitone: 6,  afterWhite: 3, label: "Gb" },
  { semitone: 8,  afterWhite: 4, label: "Ab" },
  { semitone: 10, afterWhite: 5, label: "Bb" },
];

const OCTAVES = 2;
const WW = 38;   // white key width
const WH = 112;  // white key height
const BW = 22;   // black key width
const BH = 68;   // black key height
const GAP = 1;   // gap between white keys

const SVG_W = OCTAVES * 7 * WW;
const SVG_H = WH + 28; // extra for note labels below

export function PianoKeyboard({ notes, className }: PianoKeyboardProps) {
  // Collect active semitones and their display label from the chord
  const activeSemitones = new Map<number, string>();
  notes.forEach((n) => {
    const s = NOTE_SEMITONE[n];
    if (s !== undefined && !activeSemitones.has(s)) {
      activeSemitones.set(s, n);
    }
  });

  return (
    <div className={className} style={{ overflowX: "auto" }}>
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        width="100%"
        style={{ maxWidth: SVG_W, display: "block", margin: "0 auto" }}
        role="img"
        aria-label={`Teclado de piano — notas: ${notes.join(", ")}`}
      >
        {/* ── White keys ──────────────────────────────────────────── */}
        {Array.from({ length: OCTAVES }).flatMap((_, octave) =>
          WHITE_KEYS.map((wk, i) => {
            const x = (octave * 7 + i) * WW + GAP;
            const active = activeSemitones.has(wk.semitone);
            const label = active ? activeSemitones.get(wk.semitone)! : null;

            return (
              <g key={`w-${octave}-${i}`}>
                <rect
                  x={x}
                  y={0}
                  width={WW - GAP * 2}
                  height={WH}
                  rx={3}
                  fill={active ? "#f59e0b" : "#f5f0e8"}
                  stroke={active ? "#d97706" : "#9ca3af"}
                  strokeWidth={active ? 1.5 : 0.8}
                />
                {/* Bottom rounded cap */}
                <rect
                  x={x}
                  y={WH - 6}
                  width={WW - GAP * 2}
                  height={6}
                  rx={3}
                  fill={active ? "#d97706" : "#d1cdc4"}
                />
                {/* Note label at bottom of key */}
                {label && (
                  <text
                    x={x + (WW - GAP * 2) / 2}
                    y={WH - 10}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight="700"
                    fontFamily="monospace"
                    fill="#1a1a1a"
                  >
                    {label}
                  </text>
                )}
              </g>
            );
          })
        )}

        {/* ── Black keys (drawn on top) ─────────────────────────────── */}
        {Array.from({ length: OCTAVES }).flatMap((_, octave) =>
          BLACK_KEYS.map((bk) => {
            const whiteX = (octave * 7 + bk.afterWhite + 1) * WW;
            const x = whiteX - BW / 2;
            const active = activeSemitones.has(bk.semitone);
            const label = active ? activeSemitones.get(bk.semitone)! : null;

            return (
              <g key={`b-${octave}-${bk.label}`}>
                {/* Body */}
                <rect
                  x={x}
                  y={0}
                  width={BW}
                  height={BH}
                  rx={2}
                  fill={active ? "#f59e0b" : "#1c1917"}
                  stroke={active ? "#d97706" : "#000"}
                  strokeWidth={0.5}
                />
                {/* Shine */}
                {!active && (
                  <rect
                    x={x + 3}
                    y={4}
                    width={BW - 10}
                    height={BH / 3}
                    rx={1}
                    fill="rgba(255,255,255,0.08)"
                  />
                )}
                {/* Note label */}
                {label && (
                  <text
                    x={x + BW / 2}
                    y={BH - 7}
                    textAnchor="middle"
                    fontSize={9}
                    fontWeight="700"
                    fontFamily="monospace"
                    fill="#1a1a1a"
                  >
                    {label}
                  </text>
                )}
              </g>
            );
          })
        )}

        {/* ── Octave labels ─────────────────────────────────────────── */}
        {Array.from({ length: OCTAVES }).map((_, octave) => (
          <text
            key={`oct-${octave}`}
            x={octave * 7 * WW + WW * 3.5}
            y={SVG_H - 6}
            textAnchor="middle"
            fontSize={9}
            fill="#6b7280"
            fontFamily="sans-serif"
          >
            Oitava {octave + 1}
          </text>
        ))}
      </svg>
    </div>
  );
}
