// ── Mapeamento chord ID → página do PDF ──────────────────────────────────────
//
// Estrutura das seções de variações (5 voicings por página):
//   18-029 : Maiores com 7ªM      (1 pág/tom, 12 tons)
//   30-041 : Maiores com 9ª (add9)(1 pág/tom, 12 tons)
//   42-065 : Maiores com 7ªM e 9ª (2 págs/tom — usa só a par inicial)
//   66-077 : Maiores com 6ª       (1 pág/tom, 12 tons)
//   78-089 : 7sus4                (1 pág/tom, 12 tons)
//   90-101 : Menores com 7ª       (1 pág/tom, 12 tons)
//  102-113 : Menores com 9ª       (1 pág/tom, 12 tons)
//  114-137 : Menores com 7ª e 9ª  (2 págs/tom — usa só a par inicial)
//  138-149 : Menores com 7ª e 11ª (1 pág/tom, 12 tons)
//
// Ordem dos tons: C, Db, D, Eb, E, F, F#/Gb, G, Ab, A, Bb, B

const CHORD_PAGE_MAP: Record<string, number> = {
  // ── Maiores com 7ªM (páginas 18-29) ────────────────────────────────────────
  "C7M": 18,  "Db7M": 19,  "D7M": 20,  "Eb7M": 21,  "E7M": 22,  "F7M": 23,
  "Gb7M": 24, "G7M": 25,   "Ab7M": 26, "A7M": 27,   "Bb7M": 28, "B7M": 29,

  // ── Maiores com 9ª / add9 (páginas 30-41) ──────────────────────────────────
  "Cadd9": 30,  "Dbadd9": 31, "Dadd9": 32,  "Ebadd9": 33, "Eadd9": 34,  "Fadd9": 35,
  "Gbadd9": 36, "Gadd9": 37,  "Abadd9": 38, "Aadd9": 39,  "Bbadd9": 40, "Badd9": 41,

  // ── Maiores com 7ªM e 9ª — páginas pares 42-64 (1ª pág. de cada tom) ───────
  "C9M": 42,  "Db9M": 44, "D9M": 46,  "Eb9M": 48, "E9M": 50,  "F9M": 52,
  "Gb9M": 54, "G9M": 56,  "Ab9M": 58, "A9M": 60,  "Bb9M": 62, "B9M": 64,

  // ── Maiores com 6ª (páginas 66-77) ─────────────────────────────────────────
  "C6-9": 66,  "Db6-9": 67, "D6-9": 68,  "Eb6-9": 69, "E6-9": 70,  "F6-9": 71,
  "Gb6-9": 72, "G6-9": 73,  "Ab6-9": 74, "A6-9": 75,  "Bb6-9": 76, "B6-9": 77,

  // ── 7sus4 (páginas 78-89) ──────────────────────────────────────────────────
  "C7sus4": 78,  "Db7sus4": 79, "D7sus4": 80,  "Eb7sus4": 81, "E7sus4": 82,  "F7sus4": 83,
  "Gb7sus4": 84, "G7sus4": 85,  "Ab7sus4": 86, "A7sus4": 87,  "Bb7sus4": 88, "B7sus4": 89,

  // ── Menores com 7ª (páginas 90-101) ────────────────────────────────────────
  "Cm7": 90,  "Dbm7": 91, "Dm7": 92,  "Ebm7": 93, "Em7": 94,  "Fm7": 95,
  "Gbm7": 96, "Gm7": 97,  "Abm7": 98, "Am7": 99,  "Bbm7": 100, "Bm7": 101,

  // ── Menores com 9ª / madd9 (páginas 102-113) ───────────────────────────────
  "Cmadd9": 102,  "Dbmadd9": 103, "Dmadd9": 104,  "Ebmadd9": 105, "Emadd9": 106,  "Fmadd9": 107,
  "Gbmadd9": 108, "Gmadd9": 109,  "Abmadd9": 110, "Amadd9": 111,  "Bbmadd9": 112, "Bmadd9": 113,

  // ── Menores com 7ª e 9ª — páginas pares 114-136 (1ª pág. de cada tom) ──────
  "Cm9": 114,  "Dbm9": 116, "Dm9": 118,  "Ebm9": 120, "Em9": 122,  "Fm9": 124,
  "Gbm9": 126, "Gm9": 128,  "Abm9": 130, "Am9": 132,  "Bbm9": 134, "Bm9": 136,

  // ── Menores com 7ª e 11ª (páginas 138-149) ─────────────────────────────────
  "Cm11": 138,  "Dbm11": 139, "Dm11": 140,  "Ebm11": 141, "Em11": 142,  "Fm11": 143,
  "Gbm11": 144, "Gm11": 145,  "Abm11": 146, "Am11": 147,  "Bbm11": 148, "Bm11": 149,
};

/**
 * Retorna as 5 URLs de imagem de variação para o acorde especificado,
 * ou null se o acorde não possuir imagens de variações do PDF.
 *
 * Os arquivos ficam em /public/variacoes/ e são servidos como assets estáticos.
 * Nomenclatura: pag{XXX}_var{N}.png  (ex.: pag018_var1.png, pag100_var3.png)
 */
export function getChordVariationImages(
  chordId: string,
  base: string = "",
): string[] | null {
  const page = CHORD_PAGE_MAP[chordId];
  if (!page) return null;

  const ps = page.toString().padStart(3, "0"); // "018", "090", "100" …
  return [1, 2, 3, 4, 5].map(
    (v) => `${base}/variacoes/pag${ps}_var${v}.png`,
  );
}

// ── Mapeamento chord ID → imagem da visão geral ───────────────────────────────
//
// Para acordes que não têm 5 variações (tríades, sus4, sus2, dim, m7b5,
// mão esquerda), há uma imagem de posição única extraída das páginas 1-17 do PDF.
// Arquivos ficam em /public/visao_geral/
//
// Prefixos dos arquivos:
//   01_triades_maiores_       → Tríades Maiores
//   02_triades_menores_       → Tríades Menores
//   05_sus4_                  → Sus4
//   06_sus2_                  → Sus2
//   07_diminutos_             → Diminutos
//   08_meio_diminuto_m7b5_    → Meio-Diminutos
//   09_abertos_mae_esquerda_  → Mão Esquerda — Aberto
//   10_fechados_mae_esquerda_ → Mão Esquerda — Fechado
//   11_misto_mae_esquerda_    → Mão Esquerda — Misto

const KEYS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

function buildOverviewMap(): Record<string, string> {
  const map: Record<string, string> = {};

  for (const k of KEYS) {
    // Tríades Maiores
    map[`${k}-maior`] = `01_triades_maiores_${k}.png`;

    // Tríades Menores
    map[`${k}m`] = `02_triades_menores_${k}.png`;

    // Sus4
    map[`${k}sus4`] = `05_sus4_${k}.png`;

    // Sus2
    map[`${k}sus2`] = `06_sus2_${k}.png`;

    // Diminutos
    map[`${k}-dim`] = `07_diminutos_${k}.png`;

    // Meio-Diminutos
    map[`${k}m7b5`] = `08_meio_diminuto_m7b5_${k}.png`;

    // Mão Esquerda — Aberto
    map[`${k}-me-aberto`] = `09_abertos_mae_esquerda_${k}.png`;

    // Mão Esquerda — Fechado
    map[`${k}-me-fechado`] = `10_fechados_mae_esquerda_${k}.png`;

    // Mão Esquerda — Misto
    map[`${k}-me-misto`] = `11_misto_mae_esquerda_${k}.png`;
  }

  return map;
}

const CHORD_OVERVIEW_MAP = buildOverviewMap();

/**
 * Retorna a URL da imagem de posição única (visão geral) para o acorde,
 * ou null se não houver imagem disponível.
 *
 * Usada para acordes que não possuem variações detalhadas (tríades, sus4,
 * sus2, dim, m7b5, mão esquerda).
 */
export function getChordOverviewImage(
  chordId: string,
  base: string = "",
): string | null {
  const file = CHORD_OVERVIEW_MAP[chordId];
  if (!file) return null;
  return `${base}/visao_geral/${file}`;
}
