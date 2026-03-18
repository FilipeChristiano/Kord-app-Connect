export interface Chord {
  id: string;
  name: string;
  category: string;
  formula: string;
  notes: string[];
  description: string;
  application: string;
  tags: string[];
  variations?: string[];
}

export const CATEGORIES = [
  "Maiores Sofisticados",
  "Menores Sofisticados",
  "Acordes com Sétima",
  "Acordes com Nona",
  "Acordes com Décima Primeira",
  "Acordes com Décima Terceira",
  "Acordes Diminutos",
  "Acordes Aumentados",
  "Acordes Suspensos",
  "Substituições e Variações",
];

export const CATEGORY_COLORS: Record<string, string> = {
  "Maiores Sofisticados": "bg-amber-500/10 text-amber-500 border-amber-500/20",
  "Menores Sofisticados": "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "Acordes com Sétima": "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  "Acordes com Nona": "bg-purple-500/10 text-purple-400 border-purple-500/20",
  "Acordes com Décima Primeira": "bg-pink-500/10 text-pink-400 border-pink-500/20",
  "Acordes com Décima Terceira": "bg-rose-500/10 text-rose-400 border-rose-500/20",
  "Acordes Diminutos": "bg-red-500/10 text-red-400 border-red-500/20",
  "Acordes Aumentados": "bg-orange-500/10 text-orange-400 border-orange-500/20",
  "Acordes Suspensos": "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  "Substituições e Variações": "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
};

export const CHORDS: Chord[] = [
  {
    id: "c9",
    name: "C9",
    formula: "1 - 3 - 5 - b7 - 9",
    notes: ["C", "E", "G", "Bb", "D"],
    category: "Acordes com Nona",
    description: "Acorde de nona dominante, cria tensão e sofisticação. Muito usado no gospel e jazz.",
    application: "Use em passagens de tensão antes do repouso. Perfeito em progressões gospel.",
    tags: ["gospel", "jazz", "tensão"],
    variations: ["C7", "C13"]
  },
  {
    id: "cmaj7",
    name: "Cmaj7",
    formula: "1 - 3 - 5 - 7M",
    notes: ["C", "E", "G", "B"],
    category: "Maiores Sofisticados",
    description: "Som suave, elegante e sofisticado. Um dos acordes mais belos da harmonia.",
    application: "Ideal para intros, finais e momentos de delicadeza na ministração.",
    tags: ["suave", "jazz", "gospel", "elegante"],
    variations: ["Cmaj9", "C6/9"]
  },
  {
    id: "cm7",
    name: "Cm7",
    formula: "1 - b3 - 5 - b7",
    notes: ["C", "Eb", "G", "Bb"],
    category: "Menores Sofisticados",
    description: "Menor com sétima menor. Som melancólico, profundo e sofisticado.",
    application: "Funciona bem em progressões menores e músicas contemplativas.",
    tags: ["melancólico", "suave", "jazz"],
    variations: ["Cm9", "Cm11"]
  },
  {
    id: "c7_9",
    name: "C7(9)",
    formula: "1 - 3 - 5 - b7 - 9",
    notes: ["C", "E", "G", "Bb", "D"],
    category: "Acordes com Nona",
    description: "Dominante com nona, cria expectativa e movimento. Som rico e sofisticado.",
    application: "Use como V7 em cadências com mais cor e sofisticação.",
    tags: ["dominante", "jazz", "tensão"],
    variations: ["C9", "C13"]
  },
  {
    id: "c6_9",
    name: "C6/9",
    formula: "1 - 3 - 5 - 6 - 9",
    notes: ["C", "E", "G", "A", "D"],
    category: "Maiores Sofisticados",
    description: "Acorde cheio e sofisticado. Combina a sexta e a nona, criando som rico.",
    application: "Ótimo para finais e momentos de plenitude harmônica.",
    tags: ["suave", "rico", "gospel"],
    variations: ["Cmaj7", "Cadd9"]
  },
  {
    id: "cadd9",
    name: "Cadd9",
    formula: "1 - 3 - 5 - 9",
    notes: ["C", "E", "G", "D"],
    category: "Maiores Sofisticados",
    description: "O acorde add9 é mais simples que o maj9 mas traz sofisticação imediata.",
    application: "Substituição fácil para C maior simples. Enriquece qualquer progressão básica.",
    tags: ["iniciante", "suave"],
    variations: ["C6/9", "Cmaj7"]
  },
  {
    id: "cmaj9",
    name: "Cmaj9",
    formula: "1 - 3 - 5 - 7M - 9",
    notes: ["C", "E", "G", "B", "D"],
    category: "Acordes com Nona",
    description: "Máximo de elegância e suavidade. Som sofisticado e etéreo.",
    application: "Para momentos de grandiosidade e beleza. Climático em adorações.",
    tags: ["elegante", "jazz", "gospel", "etéreo"],
    variations: ["Cmaj7", "C6/9"]
  },
  {
    id: "dm7",
    name: "Dm7",
    formula: "1 - b3 - 5 - b7",
    notes: ["D", "F", "A", "C"],
    category: "Menores Sofisticados",
    description: "Menor com sétima. Um dos acordes mais usados no jazz e bossa nova.",
    application: "Funciona como IIm7 em progressões IIm7-V7-I. Base da harmonia sofisticada.",
    tags: ["jazz", "bossa", "gospel"],
    variations: ["Dm9", "Dm11"]
  },
  {
    id: "g7_13",
    name: "G7(13)",
    formula: "1 - 3 - 5 - b7 - 13",
    notes: ["G", "B", "D", "F", "E"],
    category: "Acordes com Décima Terceira",
    description: "Dominante com décima terceira. Som rico, poderoso e cheio de sofisticação.",
    application: "Use como V7 com cor extra antes do I grau. Aumenta tensão e expectativa.",
    tags: ["dominante", "jazz", "tensão", "gospel"],
    variations: ["G9", "G7"]
  },
  {
    id: "fmaj7",
    name: "Fmaj7",
    formula: "1 - 3 - 5 - 7M",
    notes: ["F", "A", "C", "E"],
    category: "Maiores Sofisticados",
    description: "O IV grau com sétima maior é um dos acordes mais suaves e bonitos.",
    application: "Perfeito em progressões I-IVmaj7. Muito usado em gospel e adoração.",
    tags: ["suave", "gospel", "adoração"],
    variations: ["Fmaj9", "F6/9"]
  },
  {
    id: "am9",
    name: "Am9",
    formula: "1 - b3 - 5 - b7 - 9",
    notes: ["A", "C", "E", "G", "B"],
    category: "Acordes com Nona",
    description: "Menor com nona. Som profundo, rico e melancólico ao mesmo tempo.",
    application: "Traz profundidade em músicas lentas e contemplativas.",
    tags: ["melancólico", "profundo", "jazz"],
    variations: ["Am7", "Am11"]
  },
  {
    id: "e7_sharp9",
    name: "E7(#9)",
    formula: "1 - 3 - 5 - b7 - #9",
    notes: ["E", "G#", "B", "D", "G"],
    category: "Substituições e Variações",
    description: "O acorde Hendrix! Combinação de maior e menor simultâneos. Muito expressivo.",
    application: "Para momentos de tensão dramática, groove e expressividade máxima.",
    tags: ["blues", "rock", "expressivo", "tensão"],
    variations: ["E7", "E9"]
  },
  {
    id: "bdim7",
    name: "Bdim7",
    formula: "1 - b3 - b5 - bb7",
    notes: ["B", "D", "F", "Ab"],
    category: "Acordes Diminutos",
    description: "Diminuto com sétima diminuta. Cria suspense e tensão dramática.",
    application: "Use como passagem cromática ou em momentos de clímax dramático.",
    tags: ["tensão", "dramático", "clássico"],
    variations: ["Bdim", "G#dim7"]
  },
  {
    id: "caug",
    name: "Caug",
    formula: "1 - 3 - #5",
    notes: ["C", "E", "G#"],
    category: "Acordes Aumentados",
    description: "Acorde aumentado. Som misterioso e instável que pede resolução.",
    application: "Use como substituto do V grau para criar mais cor e tensão.",
    tags: ["misterioso", "tensão", "passagem"],
    variations: ["C+", "Eaug", "G#aug"]
  },
  {
    id: "csus2",
    name: "Csus2",
    formula: "1 - 2 - 5",
    notes: ["C", "D", "G"],
    category: "Acordes Suspensos",
    description: "Suspenso com segunda. Som aberto, etéreo e contemporâneo.",
    application: "Muito usado no worship moderno. Cria espaço e leveza na harmonia.",
    tags: ["worship", "contemporâneo", "aberto", "etéreo"],
    variations: ["Csus4", "Cadd9"]
  },
  {
    id: "csus4",
    name: "Csus4",
    formula: "1 - 4 - 5",
    notes: ["C", "F", "G"],
    category: "Acordes Suspensos",
    description: "Suspenso com quarta. Som expectante que pede resolução para o maior.",
    application: "Cria tensão e expectativa antes do I grau. Muito usado em codas.",
    tags: ["tensão", "worship", "expectativa"],
    variations: ["Csus2", "C"]
  },
  {
    id: "dm11",
    name: "Dm11",
    formula: "1 - b3 - 5 - b7 - 9 - 11",
    notes: ["D", "F", "A", "C", "E", "G"],
    category: "Acordes com Décima Primeira",
    description: "Menor com décima primeira. O acorde mais completo e cheio. Som denso e rico.",
    application: "Para texturas complexas e momentos de clímax harmônico.",
    tags: ["completo", "jazz", "avançado", "rico"],
    variations: ["Dm7", "Dm9"]
  }
];

export function getChordById(id: string): Chord | undefined {
  return CHORDS.find((c) => c.id === id);
}

export function searchChords(query: string, category?: string): Chord[] {
  let filtered = CHORDS;
  
  if (category && category !== "Todos") {
    filtered = filtered.filter((c) => c.category === category);
  }
  
  if (query) {
    const lowerQuery = query.toLowerCase();
    filtered = filtered.filter((c) => 
      c.name.toLowerCase().includes(lowerQuery) || 
      c.notes.some(n => n.toLowerCase().includes(lowerQuery)) ||
      c.tags.some(t => t.toLowerCase().includes(lowerQuery))
    );
  }
  
  return filtered;
}
