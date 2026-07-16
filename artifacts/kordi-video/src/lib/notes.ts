/**
 * Utilidades de teoria musical compartilhadas entre o diagrama de teclado
 * (PianoKeyboard) e o playback de piano real (piano.ts).
 */

export const NOTE_SEMITONE: Record<string, number> = {
  C: 0, "B#": 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3,
  E: 4, Fb: 4, F: 5, "E#": 5, "F#": 6, Gb: 6, G: 7,
  "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11, Cb: 11,
};

export interface PlacedNote {
  semitone: number;
  octave: number;
}

export function toSemitone(note: string): number {
  return NOTE_SEMITONE[note] ?? -1;
}

/**
 * Dado um array de notas em ordem ascendente de altura,
 * coloca cada nota na menor oitava possível que seja >= a nota anterior,
 * começando em baseOctave.
 */
export function placeNotes(notes: string[], baseOctave: number): PlacedNote[] {
  const placed: PlacedNote[] = [];
  let currentOctave = baseOctave;
  let prevSemitone = -1;

  for (const note of notes) {
    const sem = toSemitone(note);
    if (sem < 0) continue;
    // Se essa nota tem semitone <= anterior, sobe de oitava
    if (prevSemitone >= 0 && sem <= prevSemitone) {
      currentOctave++;
    }
    placed.push({ semitone: sem, octave: currentOctave });
    prevSemitone = sem;
  }
  return placed;
}

/**
 * Separação padrão de mãos usada no dicionário: ME = raiz + 5ª (graves),
 * MD = acorde completo. Acordes de "Mão Esquerda" tocam tudo na ME.
 */
export function splitHands(notes: string[], category: string) {
  if (category.startsWith("Mão Esquerda")) {
    return { leftHand: notes, rightHand: [] as string[] };
  }
  const leftHand = notes.length >= 3 ? [notes[0], notes[2]] : [notes[0]];
  const rightHand = [...notes];
  return { leftHand, rightHand };
}
