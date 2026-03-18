/**
 * PianoKeyboard — 2-oitava representação visual de acordes
 *
 * Convenção (igual ao PDF):
 *   Oitava 1 (esquerda)  → Mão Esquerda  → cor vermelha
 *   Oitava 2 (direita)   → Mão Direita   → cor âmbar/dourada
 *
 * Teclas da mão direita:
 *   Brancas  → preenchidas em âmbar ("bolinhas amarelas")
 *   Pretas   → preenchidas em âmbar escuro ("bolinhas pretas / teclas pretas")
 *
 * Teclas da mão esquerda:
 *   Brancas e pretas → preenchidas em vermelho coral
 */

interface PianoKeyboardProps {
  /** Notas tocadas pela mão esquerda (baixo / registro grave) */
  leftHandNotes: string[];
  /** Notas tocadas pela mão direita (harmonia / registro agudo) */
  rightHandNotes: string[];
  className?: string;
}

const NOTE_SEMITONE: Record<string, number> = {
  C: 0, "B#": 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3,
  E: 4, Fb: 4, F: 5, "E#": 5, "F#": 6, Gb: 6, G: 7,
  "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11, Cb: 11,
};

const WHITE_KEYS = [
  { semitone: 0  },
  { semitone: 2  },
  { semitone: 4  },
  { semitone: 5  },
  { semitone: 7  },
  { semitone: 9  },
  { semitone: 11 },
];

// afterWhite = índice da tecla branca à ESQUERDA da preta
const BLACK_KEYS = [
  { semitone: 1,  afterWhite: 0 },
  { semitone: 3,  afterWhite: 1 },
  { semitone: 6,  afterWhite: 3 },
  { semitone: 8,  afterWhite: 4 },
  { semitone: 10, afterWhite: 5 },
];

// ── Cores ────────────────────────────────────────────────────────────────────
const C = {
  lhWhiteFill:   "#ef4444",   // tecla branca — mão esquerda (vermelho)
  lhWhiteEdge:   "#b91c1c",
  lhWhiteLabel:  "#fff",
  lhBlackFill:   "#ef4444",   // tecla preta — mão esquerda (vermelho)
  lhBlackEdge:   "#b91c1c",
  lhBlackLabel:  "#fff",

  rhWhiteFill:   "#f59e0b",   // tecla branca — mão direita (âmbar/amarelo)
  rhWhiteEdge:   "#d97706",
  rhWhiteLabel:  "#1a1a1a",
  rhBlackFill:   "#1c1917",   // tecla preta — mão direita ("bolinha preta")
  rhBlackEdge:   "#f59e0b",   // borda âmbar para indicar ativa
  rhBlackLabel:  "#f59e0b",

  inactiveWhite: "#f5f0e8",
  inactiveWhiteEdge: "#d1cdc4",
  inactiveBlack: "#1c1917",
  keyStroke:     "#9ca3af",
};

const OCTAVES = 2;
const WW = 38;   // largura da tecla branca
const WH = 114;  // altura da tecla branca
const BW = 22;   // largura da tecla preta
const BH = 70;   // altura da tecla preta
const GAP = 1;
const SVG_W = OCTAVES * 7 * WW;
const SVG_H = WH + 26; // espaço para legenda inferior

type Hand = "left" | "right" | null;

export function PianoKeyboard({ leftHandNotes, rightHandNotes, className }: PianoKeyboardProps) {
  const lhSet = new Set(leftHandNotes.map((n) => NOTE_SEMITONE[n]).filter((s) => s !== undefined));
  const rhSet = new Set(rightHandNotes.map((n) => NOTE_SEMITONE[n]).filter((s) => s !== undefined));

  // Mapa semitone → label (nome da nota) por mão
  const lhLabel = new Map<number, string>();
  const rhLabel = new Map<number, string>();
  leftHandNotes.forEach((n) => { const s = NOTE_SEMITONE[n]; if (s !== undefined) lhLabel.set(s, n); });
  rightHandNotes.forEach((n) => { const s = NOTE_SEMITONE[n]; if (s !== undefined) rhLabel.set(s, n); });

  // Para cada oitava, qual conjunto de semitones verificar
  function getHand(semitone: number, octave: number): Hand {
    if (octave === 0 && lhSet.has(semitone)) return "left";
    if (octave === 1 && rhSet.has(semitone)) return "right";
    // Mão Esquerda — Aberto/Fechado/Misto: se rightHandNotes está vazio,
    // mostrar notas ME também na oitava 2 para referência visual
    if (octave === 1 && rightHandNotes.length === 0 && lhSet.has(semitone)) return "left";
    return null;
  }

  function getLabel(semitone: number, octave: number): string | null {
    if (octave === 0 && lhSet.has(semitone)) return lhLabel.get(semitone) ?? null;
    if (octave === 1 && rhSet.has(semitone)) return rhLabel.get(semitone) ?? null;
    if (octave === 1 && rightHandNotes.length === 0 && lhSet.has(semitone)) return lhLabel.get(semitone) ?? null;
    return null;
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
        {/* ── Teclas brancas ──────────────────────────────────────────── */}
        {Array.from({ length: OCTAVES }).flatMap((_, octave) =>
          WHITE_KEYS.map((wk, i) => {
            const x = (octave * 7 + i) * WW + GAP;
            const hand = getHand(wk.semitone, octave);
            const label = getLabel(wk.semitone, octave);

            const fill   = hand === "left"  ? C.lhWhiteFill
                         : hand === "right" ? C.rhWhiteFill
                         : C.inactiveWhite;
            const edge   = hand === "left"  ? C.lhWhiteEdge
                         : hand === "right" ? C.rhWhiteEdge
                         : C.inactiveWhiteEdge;
            const stroke = hand ? (hand === "left" ? C.lhWhiteEdge : C.rhWhiteEdge) : C.keyStroke;
            const lColor = hand === "left" ? C.lhWhiteLabel : C.rhWhiteLabel;

            return (
              <g key={`w-${octave}-${i}`}>
                <rect x={x} y={0} width={WW - GAP * 2} height={WH}
                  rx={3} fill={fill} stroke={stroke} strokeWidth={hand ? 1.5 : 0.8} />
                {/* cap inferior */}
                <rect x={x} y={WH - 6} width={WW - GAP * 2} height={6} rx={3} fill={edge} />
                {label && (
                  <text x={x + (WW - GAP * 2) / 2} y={WH - 10}
                    textAnchor="middle" fontSize={10} fontWeight="700"
                    fontFamily="monospace" fill={lColor}>
                    {label}
                  </text>
                )}
              </g>
            );
          })
        )}

        {/* ── Teclas pretas ────────────────────────────────────────────── */}
        {Array.from({ length: OCTAVES }).flatMap((_, octave) =>
          BLACK_KEYS.map((bk, bi) => {
            const whiteX = (octave * 7 + bk.afterWhite + 1) * WW;
            const x = whiteX - BW / 2;
            const hand = getHand(bk.semitone, octave);
            const label = getLabel(bk.semitone, octave);

            const fill   = hand === "left"  ? C.lhBlackFill
                         : hand === "right" ? C.rhBlackFill
                         : C.inactiveBlack;
            const stroke = hand === "left"  ? C.lhBlackEdge
                         : hand === "right" ? C.rhBlackEdge
                         : "#000";
            const sw     = hand ? 2 : 0.5;
            const lColor = hand === "left" ? C.lhBlackLabel : C.rhBlackLabel;

            return (
              <g key={`b-${octave}-${bi}`}>
                <rect x={x} y={0} width={BW} height={BH}
                  rx={2} fill={fill} stroke={stroke} strokeWidth={sw} />
                {/* brilho nas teclas inativas */}
                {!hand && (
                  <rect x={x + 3} y={4} width={BW - 10} height={BH / 3}
                    rx={1} fill="rgba(255,255,255,0.08)" />
                )}
                {label && (
                  <text x={x + BW / 2} y={BH - 6}
                    textAnchor="middle" fontSize={8} fontWeight="700"
                    fontFamily="monospace" fill={lColor}>
                    {label}
                  </text>
                )}
              </g>
            );
          })
        )}

        {/* ── Divisória central (entre ME e MD) ────────────────────────── */}
        <line x1={SVG_W / 2} y1={0} x2={SVG_W / 2} y2={WH}
          stroke="rgba(255,255,255,0.15)" strokeWidth={1.5} strokeDasharray="4,3" />

        {/* ── Rótulos de registro ───────────────────────────────────────── */}
        <text x={SVG_W / 4} y={SVG_H - 4}
          textAnchor="middle" fontSize={9} fill="#f87171" fontFamily="sans-serif" fontWeight="600">
          ← Mão Esquerda
        </text>
        <text x={SVG_W * 3 / 4} y={SVG_H - 4}
          textAnchor="middle" fontSize={9} fill="#fbbf24" fontFamily="sans-serif" fontWeight="600">
          Mão Direita →
        </text>
      </svg>
    </div>
  );
}
