import type { TimedChord } from "@/lib/audio-analysis";
import type { TranscriptionResult } from "@/lib/transcription";

// ─────────────────────────────────────────────────────────────────────────────
// Alinhamento acordes × letra.
//
// Usa os timestamps dos acordes (detecção client-side) e os timestamps das
// palavras (transcrição) para posicionar cada acorde acima da palavra que soa no
// mesmo instante, montando a cifra clássica. Trechos incertos são marcados:
//   - acorde com baixa confiança recebe "?" ao lado;
//   - linha cuja transcrição tem palavras de baixa confiança recebe "(?)".
// Nenhuma letra é inventada: só posicionamos o que veio da transcrição.
// ─────────────────────────────────────────────────────────────────────────────

const CHORD_UNCERTAIN = 0.6; // produto escalar normalizado do acorde (0..1)
const WORD_UNCERTAIN = 0.5; // confiança da palavra transcrita (0..1)

// Posiciona rótulos em colunas, sem deixar acordes grudarem.
function placeLabels(placements: { col: number; label: string }[]): string {
  const sorted = [...placements].sort((a, b) => a.col - b.col);
  let line = "";
  for (const p of sorted) {
    let col = p.col;
    if (line.length > 0 && col <= line.length) col = line.length + 1;
    while (line.length < col) line += " ";
    line += p.label;
  }
  return line.replace(/\s+$/, "");
}

export function buildAlignedChart(
  transcription: TranscriptionResult,
  timeline: TimedChord[],
  keySymbol: string,
  bpm: number,
): { chart: string; hasUncertain: boolean } {
  const headerParts = [`Tom: ${keySymbol}`];
  if (bpm > 0) headerParts.push(`BPM: ${bpm}`);

  const lines = Array.isArray(transcription.lines) ? transcription.lines : [];
  let hasUncertain = false;
  const blocks: string[] = [];
  let ci = 0; // acordes consumidos em ordem

  for (const seg of lines) {
    const words =
      seg.words && seg.words.length
        ? seg.words
        : [{ text: seg.text, start: seg.start, end: seg.end }];

    // Monta a linha da letra e guarda a coluna inicial de cada palavra.
    let lyric = "";
    const cols: number[] = [];
    words.forEach((w, i) => {
      if (i > 0) lyric += " ";
      cols.push(lyric.length);
      lyric += w.text;
    });

    const lowWord = words.some(
      (w) => typeof w.confidence === "number" && w.confidence < WORD_UNCERTAIN,
    );
    if (lowWord) hasUncertain = true;

    // Acordes cujo início cai dentro deste segmento.
    const placements: { col: number; label: string }[] = [];
    while (ci < timeline.length && timeline[ci].start < seg.end) {
      const ch = timeline[ci];
      if (ch.end <= seg.start) {
        ci++;
        continue; // acorde já terminou antes desta linha
      }
      // Palavra cujo tempo de início mais se aproxima (sem ultrapassar) o acorde.
      let wi = 0;
      for (let k = 0; k < words.length; k++) {
        if (words[k].start <= ch.start) wi = k;
        else break;
      }
      const uncertain = ch.confidence < CHORD_UNCERTAIN;
      if (uncertain) hasUncertain = true;
      placements.push({ col: cols[wi] ?? 0, label: ch.symbol + (uncertain ? "?" : "") });
      ci++;
    }

    const chordLine = placeLabels(placements);
    const lyricOut = lyric + (lowWord ? "   (?)" : "");
    blocks.push(chordLine ? `${chordLine}\n${lyricOut}` : lyricOut);
  }

  const body = blocks.length > 0 ? blocks.join("\n\n") : "(transcrição vazia)";
  const legend = hasUncertain ? "\n\n(? = trecho incerto — confira este ponto)" : "";
  return { chart: `${headerParts.join("   ")}\n\n${body}${legend}`, hasUncertain };
}
