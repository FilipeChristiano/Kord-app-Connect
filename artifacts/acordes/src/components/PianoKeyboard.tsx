/**
 * PianoKeyboard — Diagrama de teclado SVG com 3 oitavas
 *
 * Voicings de Mão Esquerda (isLeftOnly = sem mão direita):
 *   Aberto  → baseOctave=0: Raiz+Quinta na região grave (oitava 0)
 *   Fechado → baseOctave=1: Terça+Quinta na região média (oitava 1)
 *   Misto   → baseOctave=0: Raiz+Terça+Quinta na região grave (oitava 0)
 *
 * Acordes normais (ME + MD): ME em oitava 0, MD em oitava 1. Oitava 2 vazia.
 *
 * Cor das bolinhas:
 *   🔴 Vermelho = Mão Esquerda
 *   🟣 Roxo     = Mão Direita tecla branca
 *   ⚫ Preta    = Mão Direita tecla preta
 */

import { placeNotes } from "@/lib/notes";

interface PianoKeyboardProps {
  leftHandNotes: string[];
  rightHandNotes: string[];
  /** Oitava base para a mão esquerda. 0 = grave (Aberto/Misto), 1 = média (Fechado) */
  leftHandBaseOctave?: number;
  className?: string;
}

const WHITE_KEY_SEMITONES = [0, 2, 4, 5, 7, 9, 11];

const BLACK_KEYS = [
  { semitone: 1,  afterWhite: 0 },
  { semitone: 3,  afterWhite: 1 },
  { semitone: 6,  afterWhite: 3 },
  { semitone: 8,  afterWhite: 4 },
  { semitone: 10, afterWhite: 5 },
];

const OCTAVES = 3;
const WW = 34;
const WH = 110;
const BW = 22;
const BH = 68;
const GAP = 2;
const DOT_R_WHITE = 9;
const DOT_R_BLACK = 7;
const SVG_W = OCTAVES * 7 * WW;
const SVG_H = WH + 26;

type Hand = "left" | "right" | null;

function dotFill(hand: Hand, isBlack: boolean): string {
  if (hand === "left")  return "#ef4444";
  if (hand === "right") return isBlack ? "#1c1917" : "#a855f7";
  return "none";
}
function dotStroke(hand: Hand, isBlack: boolean): string {
  if (hand === "left")  return "#b91c1c";
  if (hand === "right") return isBlack ? "#a855f7" : "#9333ea";
  return "none";
}

export function PianoKeyboard({
  leftHandNotes,
  rightHandNotes,
  leftHandBaseOctave = 0,
  className,
}: PianoKeyboardProps) {
  const isLeftOnly = rightHandNotes.length === 0 && leftHandNotes.length > 0;

  // Posiciona as notas de cada mão nas oitavas corretas
  const lhPlaced = placeNotes(leftHandNotes, leftHandBaseOctave);
  // MD sempre começa na oitava 1 (para acordes normais)
  const rhPlaced = placeNotes(rightHandNotes, 1);

  function getHand(semitone: number, octave: number): Hand {
    for (const n of lhPlaced) {
      if (n.semitone === semitone && n.octave === octave) return "left";
    }
    for (const n of rhPlaced) {
      if (n.semitone === semitone && n.octave === octave) return "right";
    }
    return null;
  }

  const hasLeft  = leftHandNotes.length > 0;
  const hasRight = rightHandNotes.length > 0;

  // Determina os rótulos a mostrar
  const leftLabel  = hasLeft && !isLeftOnly ? "← Mão Esquerda" : hasLeft ? "← Mão Esquerda" : null;
  const rightLabel = hasRight ? "Mão Direita →" : null;

  return (
    <div className={className} style={{ overflowX: "auto" }}>
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        width="100%"
        style={{ maxWidth: SVG_W, display: "block", margin: "0 auto" }}
        role="img"
        aria-label={`Teclado piano — ME: ${leftHandNotes.join(",")} | MD: ${rightHandNotes.join(",")}`}
      >
        {/* Fundo do teclado */}
        <rect x={0} y={0} width={SVG_W} height={WH} rx={4}
          fill="#2a1f0e" stroke="#4a3520" strokeWidth={1.5} />

        {/* Teclas brancas */}
        {Array.from({ length: OCTAVES }).flatMap((_, octave) =>
          WHITE_KEY_SEMITONES.map((semitone, i) => {
            const x    = (octave * 7 + i) * WW + GAP;
            const w    = WW - GAP * 2;
            const hand = getHand(semitone, octave);

            return (
              <g key={`w-${octave}-${i}`}>
                <rect x={x} y={2} width={w} height={WH - 4} rx={3}
                  fill="#f5ede0" stroke="#c8bfb0" strokeWidth={0.8} />
                <rect x={x} y={WH - 9} width={w} height={7} rx={2}
                  fill="#d4c8b8" />
                {hand && (
                  <circle
                    cx={x + w / 2} cy={WH - 18} r={DOT_R_WHITE}
                    fill={dotFill(hand, false)} stroke={dotStroke(hand, false)} strokeWidth={1.5}
                  />
                )}
              </g>
            );
          })
        )}

        {/* Teclas pretas */}
        {Array.from({ length: OCTAVES }).flatMap((_, octave) =>
          BLACK_KEYS.map((bk, bi) => {
            const whiteX = (octave * 7 + bk.afterWhite + 1) * WW;
            const x      = whiteX - BW / 2;
            const hand   = getHand(bk.semitone, octave);

            return (
              <g key={`b-${octave}-${bi}`}>
                <rect x={x} y={2} width={BW} height={BH} rx={2}
                  fill="#1a1008" stroke="#000" strokeWidth={0.5} />
                <rect x={x + 3} y={5} width={BW - 8} height={BH / 4} rx={1}
                  fill="rgba(255,255,255,0.07)" />
                {hand && (
                  <circle
                    cx={x + BW / 2} cy={BH - 11} r={DOT_R_BLACK}
                    fill={dotFill(hand, true)} stroke={dotStroke(hand, true)}
                    strokeWidth={hand === "right" ? 2 : 1.5}
                  />
                )}
              </g>
            );
          })
        )}

        {/* Divisórias entre oitavas */}
        {[1, 2].map(oct => (
          <line key={`div-${oct}`}
            x1={oct * 7 * WW} y1={4} x2={oct * 7 * WW} y2={WH - 4}
            stroke="rgba(255,180,80,0.2)" strokeWidth={1} strokeDasharray="4,3"
          />
        ))}

        {/* Rótulos */}
        {leftLabel && !hasRight && (
          <text x={SVG_W / 4} y={SVG_H - 6}
            textAnchor="middle" fontSize={9} fontFamily="'Inter', sans-serif" fontWeight="600" fill="#f87171">
            {leftLabel}
          </text>
        )}
        {hasLeft && hasRight && (
          <text x={SVG_W / 6} y={SVG_H - 6}
            textAnchor="middle" fontSize={9} fontFamily="'Inter', sans-serif" fontWeight="600" fill="#f87171">
            ← Mão Esquerda
          </text>
        )}
        {rightLabel && (
          <text x={hasLeft ? SVG_W * 2 / 3 : SVG_W / 2} y={SVG_H - 6}
            textAnchor="middle" fontSize={9} fontFamily="'Inter', sans-serif" fontWeight="600" fill="#a855f7">
            {rightLabel}
          </text>
        )}
      </svg>
    </div>
  );
}
