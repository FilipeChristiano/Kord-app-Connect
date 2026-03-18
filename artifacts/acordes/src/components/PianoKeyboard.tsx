/**
 * PianoKeyboard — Diagrama de teclado com bolinhas coloridas
 *
 * Padrão igual ao PDF:
 *   🔴 Bolinha vermelha  = Mão Esquerda  (registro grave, oitava 1)
 *   🟠 Bolinha laranja   = Mão Direita em tecla branca (registro agudo, oitava 2)
 *   ⚫ Bolinha preta      = Mão Direita em tecla preta  (registro agudo, oitava 2)
 *
 * O teclado mantém as cores naturais — apenas as bolinhas indicam as notas.
 */

interface PianoKeyboardProps {
  leftHandNotes: string[];
  rightHandNotes: string[];
  className?: string;
}

const NOTE_SEMITONE: Record<string, number> = {
  C: 0, "B#": 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3,
  E: 4, Fb: 4, F: 5, "E#": 5, "F#": 6, Gb: 6, G: 7,
  "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11, Cb: 11,
};

const WHITE_KEY_SEMITONES = [0, 2, 4, 5, 7, 9, 11]; // C D E F G A B
const WHITE_KEY_NAMES     = ["C","D","E","F","G","A","B"];

// afterWhite = índice da tecla branca à esquerda da preta (dentro da oitava)
const BLACK_KEYS = [
  { semitone: 1,  afterWhite: 0, name: "Db" },
  { semitone: 3,  afterWhite: 1, name: "Eb" },
  { semitone: 6,  afterWhite: 3, name: "Gb" },
  { semitone: 8,  afterWhite: 4, name: "Ab" },
  { semitone: 10, afterWhite: 5, name: "Bb" },
];

const OCTAVES = 2;
const WW = 38;   // largura da tecla branca
const WH = 120;  // altura da tecla branca
const BW = 24;   // largura da tecla preta
const BH = 74;   // altura da tecla preta
const GAP = 2;   // gap entre teclas brancas

// Tamanho das bolinhas
const DOT_R_WHITE = 10;  // raio da bolinha em tecla branca
const DOT_R_BLACK = 8;   // raio da bolinha em tecla preta

const SVG_W = OCTAVES * 7 * WW;
const SVG_H = WH + 28;

type Hand = "left" | "right" | null;

function toSemitoneSet(notes: string[]): Set<number> {
  const s = new Set<number>();
  notes.forEach((n) => {
    const v = NOTE_SEMITONE[n];
    if (v !== undefined) s.add(v);
  });
  return s;
}

function labelMap(notes: string[]): Map<number, string> {
  const m = new Map<number, string>();
  notes.forEach((n) => {
    const v = NOTE_SEMITONE[n];
    if (v !== undefined && !m.has(v)) m.set(v, n);
  });
  return m;
}

export function PianoKeyboard({ leftHandNotes, rightHandNotes, className }: PianoKeyboardProps) {
  const lhSet = toSemitoneSet(leftHandNotes);
  const rhSet = toSemitoneSet(rightHandNotes);
  const lhLabels = labelMap(leftHandNotes);
  const rhLabels = labelMap(rightHandNotes);

  // Para cada tecla em cada oitava: qual mão?
  function getHand(semitone: number, octave: number): Hand {
    if (octave === 0) {
      if (lhSet.has(semitone)) return "left";
      // Se não há notas de MD (categorias Mão Esquerda): mostrar em ambas oitavas
      if (rightHandNotes.length === 0 && lhSet.has(semitone)) return "left";
    }
    if (octave === 1) {
      if (rhSet.has(semitone)) return "right";
      if (rightHandNotes.length === 0 && lhSet.has(semitone)) return "left";
    }
    return null;
  }

  function getLabel(semitone: number, octave: number): string | null {
    if (octave === 0 && lhSet.has(semitone)) return lhLabels.get(semitone) ?? null;
    if (octave === 1 && rhSet.has(semitone)) return rhLabels.get(semitone) ?? null;
    if (rightHandNotes.length === 0 && lhSet.has(semitone)) return lhLabels.get(semitone) ?? null;
    return null;
  }

  // Cor da bolinha
  function dotFill(hand: Hand, isBlack: boolean): string {
    if (hand === "left")  return "#ef4444"; // vermelho — mão esquerda
    if (hand === "right") return isBlack ? "#1c1917" : "#f97316"; // preta ou laranja — mão direita
    return "none";
  }
  function dotStroke(hand: Hand, isBlack: boolean): string {
    if (hand === "left")  return "#b91c1c";
    if (hand === "right") return isBlack ? "#f97316" : "#ea6a00";
    return "none";
  }

  return (
    <div className={className} style={{ overflowX: "auto" }}>
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        width="100%"
        style={{ maxWidth: SVG_W, display: "block", margin: "0 auto" }}
        role="img"
        aria-label={`Teclado piano — ME: ${leftHandNotes.join(",")} | MD: ${rightHandNotes.join(",")}`}
      >
        {/* ── Fundo do teclado ─────────────────────────────────────────── */}
        <rect x={0} y={0} width={SVG_W} height={WH} rx={4}
          fill="#2a1f0e" stroke="#4a3520" strokeWidth={1.5} />

        {/* ── Teclas brancas ──────────────────────────────────────────── */}
        {Array.from({ length: OCTAVES }).flatMap((_, octave) =>
          WHITE_KEY_SEMITONES.map((semitone, i) => {
            const x = (octave * 7 + i) * WW + GAP;
            const w = WW - GAP * 2;
            const hand = getHand(semitone, octave);
            const label = getLabel(semitone, octave);

            return (
              <g key={`w-${octave}-${i}`}>
                {/* Corpo da tecla branca */}
                <rect
                  x={x} y={2} width={w} height={WH - 4}
                  rx={3}
                  fill="#f5ede0"
                  stroke="#c8bfb0"
                  strokeWidth={0.8}
                />
                {/* Sombra inferior para efeito 3D */}
                <rect
                  x={x} y={WH - 10} width={w} height={8}
                  rx={2}
                  fill="#d4c8b8"
                />
                {/* Bolinha colorida */}
                {hand && (
                  <circle
                    cx={x + w / 2}
                    cy={WH - 20}
                    r={DOT_R_WHITE}
                    fill={dotFill(hand, false)}
                    stroke={dotStroke(hand, false)}
                    strokeWidth={1.5}
                  />
                )}
              </g>
            );
          })
        )}

        {/* ── Teclas pretas (desenhadas por cima) ──────────────────────── */}
        {Array.from({ length: OCTAVES }).flatMap((_, octave) =>
          BLACK_KEYS.map((bk, bi) => {
            const whiteX = (octave * 7 + bk.afterWhite + 1) * WW;
            const x = whiteX - BW / 2;
            const hand = getHand(bk.semitone, octave);
            const label = getLabel(bk.semitone, octave);

            return (
              <g key={`b-${octave}-${bi}`}>
                {/* Corpo da tecla preta */}
                <rect
                  x={x} y={2} width={BW} height={BH}
                  rx={2}
                  fill="#1a1008"
                  stroke="#000"
                  strokeWidth={0.5}
                />
                {/* Gradiente de brilho */}
                <rect
                  x={x + 3} y={5} width={BW - 10} height={BH / 4}
                  rx={1}
                  fill="rgba(255,255,255,0.07)"
                />
                {/* Bolinha colorida */}
                {hand && (
                  <circle
                    cx={x + BW / 2}
                    cy={BH - 12}
                    r={DOT_R_BLACK}
                    fill={dotFill(hand, true)}
                    stroke={dotStroke(hand, true)}
                    strokeWidth={hand === "right" ? 2 : 1.5}
                  />
                )}
              </g>
            );
          })
        )}

        {/* ── Divisória central ─────────────────────────────────────────── */}
        <line
          x1={SVG_W / 2} y1={4} x2={SVG_W / 2} y2={WH - 4}
          stroke="rgba(255,180,80,0.25)" strokeWidth={1.5} strokeDasharray="5,4"
        />

        {/* ── Rótulos de registro ───────────────────────────────────────── */}
        <text x={SVG_W / 4} y={SVG_H - 6}
          textAnchor="middle" fontSize={9} fontFamily="sans-serif" fontWeight="600" fill="#f87171">
          ← Mão Esquerda
        </text>
        <text x={SVG_W * 3 / 4} y={SVG_H - 6}
          textAnchor="middle" fontSize={9} fontFamily="sans-serif" fontWeight="600" fill="#f97316">
          Mão Direita →
        </text>
      </svg>
    </div>
  );
}
