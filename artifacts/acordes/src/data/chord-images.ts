// ── Mapeamento chord ID → página do PDF ──────────────────────────────────────
//
// Apenas as 5 categorias sofisticadas têm páginas de variações no PDF.
// Cada acorde tem 5 variações (var1…var5) por página.
// Categoria "Com 7ªM e 9ª" usa apenas as páginas pares (página do 1º voicing
// de cada tonalidade — as ímpares são continuações da mesma tonalidade).
//
// Ordem das tonalidades nas páginas: C, C#/Db, D, D#/Eb, E, F, F#/Gb, G, Ab, A, Bb, B

const CHORD_PAGE_MAP: Record<string, number> = {
  // ── Maiores com 7ªM (páginas 18-29) ────────────────────────────────────────
  "C7M": 18,  "Db7M": 19,  "D7M": 20,  "Eb7M": 21,  "E7M": 22,  "F7M": 23,
  "Gb7M": 24, "G7M": 25,   "Ab7M": 26, "A7M": 27,   "Bb7M": 28, "B7M": 29,

  // ── Com 9ª / add9 (páginas 30-41) ──────────────────────────────────────────
  "Cadd9": 30,  "Dbadd9": 31, "Dadd9": 32,  "Ebadd9": 33, "Eadd9": 34,  "Fadd9": 35,
  "Gbadd9": 36, "Gadd9": 37,  "Abadd9": 38, "Aadd9": 39,  "Bbadd9": 40, "Badd9": 41,

  // ── Com 7ªM e 9ª — páginas pares 42-64 (1ª pág. de cada tonalidade) ────────
  "C9M": 42,  "Db9M": 44, "D9M": 46,  "Eb9M": 48, "E9M": 50,  "F9M": 52,
  "Gb9M": 54, "G9M": 56,  "Ab9M": 58, "A9M": 60,  "Bb9M": 62, "B9M": 64,

  // ── Com 6ª (páginas 66-77) ─────────────────────────────────────────────────
  "C6-9": 66,  "Db6-9": 67, "D6-9": 68,  "Eb6-9": 69, "E6-9": 70,  "F6-9": 71,
  "Gb6-9": 72, "G6-9": 73,  "Ab6-9": 74, "A6-9": 75,  "Bb6-9": 76, "B6-9": 77,

  // ── 7sus4 (páginas 78-89) ──────────────────────────────────────────────────
  "C7sus4": 78,  "Db7sus4": 79, "D7sus4": 80,  "Eb7sus4": 81, "E7sus4": 82,  "F7sus4": 83,
  "Gb7sus4": 84, "G7sus4": 85,  "Ab7sus4": 86, "A7sus4": 87,  "Bb7sus4": 88, "B7sus4": 89,
};

/**
 * Retorna as 5 URLs de imagem de variação para o acorde especificado,
 * ou null se o acorde não possuir imagens do PDF.
 *
 * Os arquivos ficam em /public/variacoes/ e são servidos como assets estáticos.
 * Nomeclatura: pag0{XX}_var{N}.png  (ex.: pag018_var1.png)
 */
export function getChordVariationImages(
  chordId: string,
  base: string = "",
): string[] | null {
  const page = CHORD_PAGE_MAP[chordId];
  if (!page) return null;

  const ps = page.toString().padStart(2, "0"); // "18", "42", "89" …
  return [1, 2, 3, 4, 5].map(
    (v) => `${base}/variacoes/pag0${ps}_var${v}.png`,
  );
}
