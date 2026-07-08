export interface ApplicationTip {
  title: string;
  description: string;
}

export interface ProgressionExample {
  label: string;
  chords: string[];
  context: string;
}

export interface CategoryApplication {
  category: string;
  icon: string;
  summary: string;
  contexts: string[];
  tips: ApplicationTip[];
  progressions: ProgressionExample[];
}

export const CATEGORY_APPLICATIONS: CategoryApplication[] = [
  {
    category: "Tríades Maiores",
    icon: "🎹",
    summary:
      "As tríades maiores são a base de toda harmonia tonal. Dominar as 12 tríades em todas as inversões é o ponto de partida para qualquer tecladista que quer sair do básico.",
    contexts: [
      "Introduções simples e poderosas",
      "Acompanhamentos em hinos e músicas de adoração",
      "Base para aprender inversões e voicings",
      "Fundação de qualquer progressão harmônica",
    ],
    tips: [
      {
        title: "Pratique as inversões",
        description:
          "Toque cada tríade nas três posições (fundamental, 1ª inversão e 2ª inversão). Isso fluidifica o movimento entre acordes e cria progressões mais lineares.",
      },
      {
        title: "Use como ponto de partida para acrescentar notas",
        description:
          "A tríade é a base. A partir dela, adicione a 7ªM, a 9ª ou a 6ª para criar acordes sofisticados sem perder a harmonia central.",
      },
      {
        title: "Conecte acordes vizinhos com nota comum",
        description:
          "Ao mover entre tríades, tente manter pelo menos uma nota em comum entre elas. Isso cria condução de vozes suave e profissional.",
      },
    ],
    progressions: [
      {
        label: "Progressão 1-4-5",
        chords: ["C", "F", "G"],
        context: "Base do louvor e adoração. Fácil de adaptar a qualquer tom.",
      },
      {
        label: "Progressão 1-5-6-4",
        chords: ["C", "G", "Am", "F"],
        context:
          "Progressão pop clássica usada em centenas de músicas de adoração.",
      },
      {
        label: "Progressão gospel básica",
        chords: ["Bb", "Eb", "F", "Bb"],
        context: "Tom de Bb, muito comum em igrejas e grupos gospel.",
      },
    ],
  },
  {
    category: "Tríades Menores",
    icon: "🎵",
    summary:
      "As tríades menores são a expressão da emoção e profundidade na música. Usadas como graus diatônicos em tonalidades maiores (IIm, IIIm, VIm) ou como centro tonal em tonalidades menores.",
    contexts: [
      "IIm, IIIm e VIm em progressões maiores",
      "Im em músicas em tonalidade menor",
      "Músicas contemplativas e de lamento",
      "Passagens dramáticas e expressivas",
    ],
    tips: [
      {
        title: "Use o VIm como substituto do I",
        description:
          "O VIm (ex.: Am em Dó maior) pode substituir o I grau em muitos contextos, criando uma cadência mais sofisticada e melancólica sem sair da tonalidade.",
      },
      {
        title: "Explore o IIm para criar tensão",
        description:
          "O IIm (ex.: Dm em Dó maior) é o início da cadência IIm-V7-I. Ele cria a preparação ideal para o dominante.",
      },
      {
        title: "Combine menores com a sétima para mais suavidade",
        description:
          "Quase sempre que usar uma tríade menor, experimente acrescentar a 7ª menor. Isso transforma o acorde em m7, muito mais sofisticado e musical.",
      },
    ],
    progressions: [
      {
        label: "Progressão menor clássica",
        chords: ["Am", "F", "C", "G"],
        context: "VIm-IV-I-V. Muito expressiva e amplamente usada.",
      },
      {
        label: "Progressão menor direta",
        chords: ["Dm", "Am", "Bb", "C"],
        context: "Im-Vm-bVII-bVII. Som moderno e dramático.",
      },
      {
        label: "Cadência menor gospel",
        chords: ["Em", "Am", "Dm", "G"],
        context: "IIIm-VIm-IIm-V. Condução sofisticada em tonalidade menor.",
      },
    ],
  },
  {
    category: "Maiores com 7ªM",
    icon: "✨",
    summary:
      "O acorde maior com sétima maior (7M) é a porta de entrada para a harmonia sofisticada. Apenas uma nota a mais transforma qualquer acorde simples em algo elegante e suave.",
    contexts: [
      "Introduções e finais de músicas",
      "I grau e IV grau em progressões refinadas",
      "Baladas e músicas lentas de adoração",
      "Harmonias jazz e bossa nova",
      "Substituição sofisticada de qualquer acorde maior",
    ],
    tips: [
      {
        title: "Substitua o I e o IV por suas versões 7M",
        description:
          "Na tonalidade de Dó, transforme C e F em C7M e F7M. Isso já eleva completamente o nível harmônico da música sem mudar a progressão.",
      },
      {
        title: "Use em progressões paralelas",
        description:
          "Progressões como C7M → F7M(9) → G7sus4 criam movimento harmônico refinado muito comum no gospel moderno e no jazz.",
      },
      {
        title: "Atenção ao semiton entre a 7ªM e a fundamental",
        description:
          "A tensão suave da 7ªM (semiton abaixo da oitava) é o que torna esses acordes tão bonitos. Explore esse intervalo em melodias também.",
      },
    ],
    progressions: [
      {
        label: "Progressão suave 7M",
        chords: ["C7M", "F7M", "G7sus4", "C7M"],
        context: "I7M-IV7M-V7sus4-I7M. Muito elegante em adoração.",
      },
      {
        label: "Dois acordes poderosos",
        chords: ["Ab7M", "Eb7M"],
        context:
          "Simples e luxuoso. Progressão estática que cria atmosfera de adoração.",
      },
      {
        label: "Jazz-gospel clássico",
        chords: ["F7M", "Dm7", "G7", "C7M"],
        context: "IV7M-IIm7-V7-I7M. A progressão mais elegante do jazz.",
      },
    ],
  },
  {
    category: "Menores com 7ª",
    icon: "🌙",
    summary:
      "O acorde menor com sétima menor (m7) é um dos acordes mais versáteis e sofisticados da harmonia. Suave, expressivo e sempre musical, ele aparece em praticamente toda música refinada.",
    contexts: [
      "IIm7 na progressão II-V-I (a mais importante do jazz)",
      "IIIm7 e VIm7 como substitutos do I grau",
      "Im7 em músicas menores sofisticadas",
      "Harmonias de jazz, bossa nova e gospel",
      "Texturas suaves em músicas contemplativas",
    ],
    tips: [
      {
        title: "A progressão IIm7-V7-I é fundamental",
        description:
          "Aprenda Dm7-G7-C7M em todas as tonalidades. Essa é a base do jazz e aparece em todas as músicas sofisticadas, incluindo gospel moderno.",
      },
      {
        title: "VIm7 como substituto suave do I",
        description:
          "Em Dó maior, o Am7 compartilha três notas com o C7M. Use o VIm7 para criar uma resolução mais suave e melancólica.",
      },
      {
        title: "Stacking: empilhe os m7 em sequência",
        description:
          "Progressões como Am7-Dm7-Gm7-Cm7 (descendo quintas) criam movimento hipnótico muito usado no jazz e bossa nova.",
      },
    ],
    progressions: [
      {
        label: "II-V-I clássico",
        chords: ["Dm7", "G7", "C7M"],
        context:
          "A progressão mais importante da harmonia sofisticada. Aprenda em todas as tonalidades.",
      },
      {
        label: "Sequência de m7 descendente",
        chords: ["Am7", "Dm7", "Gm7", "C7M"],
        context: "Condução de quintas descendentes. Som hipnótico e suave.",
      },
      {
        label: "Gospel moderno",
        chords: ["Cm7", "Fm7", "Bb7M", "Eb7M"],
        context: "Im7-IVm7-bVII7M-bIII7M. Progressão modal muito usada no gospel.",
      },
    ],
  },
  {
    category: "Sus4",
    icon: "⏳",
    summary:
      "O acorde sus4 substitui a terça pela quarta, criando tensão e expectativa. É o acorde do 'antes de resolver' — e essa tensão controlada é o segredo de muitas músicas poderosas.",
    contexts: [
      "Antes do acorde maior correspondente (tensão → resolução)",
      "Momentos de expectativa e clímax em adoração",
      "Codas e partes finais de músicas",
      "Intros e pontes dramáticas",
      "Criando espaço harmônico sem definir maior ou menor",
    ],
    tips: [
      {
        title: "O sus4 pede resolução",
        description:
          "Sempre que usar Gsus4, resolva para G. Esse movimento de tensão-resolução é um dos mais poderosos da música. Use-o conscientemente para criar impacto.",
      },
      {
        title: "Use sus4 em vez de V7 para um tom mais contemporâneo",
        description:
          "Em vez de G7→C, tente Gsus4→G→C. Isso é muito mais comum no worship contemporâneo e gospel moderno.",
      },
      {
        title: "Sus4 + 7ª = 7sus4 (mais sofisticado)",
        description:
          "Adicione a 7ª menor ao sus4 para criar o 7sus4 — acorde dominante suspenso muito usado no gospel e funk.",
      },
    ],
    progressions: [
      {
        label: "Tensão clássica sus4",
        chords: ["Gsus4", "G", "C7M"],
        context: "Vsus4-V-I. Movimento clássico de tensão e resolução.",
      },
      {
        label: "Loop de adoração",
        chords: ["Csus4", "C", "Fsus4", "F"],
        context: "Alterna sus4 e resolução. Cria energia constante.",
      },
      {
        label: "Contemporâneo worship",
        chords: ["Ebsus4", "Eb7M", "Absus4", "Ab7M"],
        context: "Sus4 resolvendo em 7M. Sofisticado e moderno.",
      },
    ],
  },
  {
    category: "Sus2",
    icon: "🌬️",
    summary:
      "O acorde sus2 substitui a terça pela segunda, criando um som aberto, etéreo e contemporâneo. É o acorde do espaço e da leveza — muito presente no worship moderno.",
    contexts: [
      "Intros e atmosphericas de adoração",
      "Músicas lentas e contemplativas",
      "Worship contemporâneo (muito usado)",
      "Fundos harmônicos estáticos",
      "Substituição elegante de qualquer acorde maior",
    ],
    tips: [
      {
        title: "Sus2 e add9 têm as mesmas notas",
        description:
          "Csus2 (C-D-G) e Cadd9 (C-E-G-D) compartilham a segunda/nona. Use o sus2 quando quiser mais abertura (sem terça), e o add9 quando quiser manter a qualidade maior definida.",
      },
      {
        title: "Ótimo para acompanhamentos estáticos",
        description:
          "Fique em um sus2 por muitos compassos enquanto a melodia se movimenta. Isso cria uma base etérea e espaçosa muito eficaz em momentos contemplativos.",
      },
      {
        title: "Combine sus2 com sus4 para variação",
        description:
          "Alternar Gsus2 e Gsus4 enquanto a melodia sobe ou desce cria movimento harmônico sofisticado sem sair do mesmo acorde.",
      },
    ],
    progressions: [
      {
        label: "Loop etéreo",
        chords: ["Dsus2", "Asus2", "Gsus2"],
        context: "Progressão aberta e contemporânea. Muito usada no worship.",
      },
      {
        label: "Abertura de música",
        chords: ["Ebsus2", "Bbsus2", "Absus2"],
        context: "Intros atmosféricas em tom de Eb. Som grandioso e leve.",
      },
      {
        label: "Sus2 em sequência",
        chords: ["Csus2", "Gsus2", "Amsus2", "Fsus2"],
        context:
          "Progressão 1-5-6-4 com sus2. Mais aberta e contemporânea que as tríades.",
      },
    ],
  },
  {
    category: "Diminutos",
    icon: "⚡",
    summary:
      "O acorde diminuto é a tensão pura. Instável por natureza, ele sempre quer se mover. Usado com sabedoria, cria momentos dramáticos e passagens cromáticas de grande efeito.",
    contexts: [
      "Passagens cromáticas entre acordes (ex.: C → C# dim → Dm)",
      "Substituto do dominante com 7ª bemol na 9ª",
      "VII° como sensível ao I grau",
      "Momentos de clímax dramático",
      "Músicas de caráter tenso ou épico",
    ],
    tips: [
      {
        title: "Use o diminuto como passagem cromática",
        description:
          "Entre C e D, coloque C#° (ou Db°). Esse movimento cromático cria condução suave e sofisticada. Muito usado em arranjos gospel e jazz.",
      },
      {
        title: "O VII° substitui o V7b9",
        description:
          "Em Dó maior, o B° tem as mesmas notas do G7b9 (sem o Sol). Use B° antes do C para criar cadência muito expressiva e dramática.",
      },
      {
        title: "Simetria do diminuto",
        description:
          "Acordes diminutos com 7ª (dim7) são simétricos — dividem a oitava em 4 partes iguais. Isso significa que C°7 = Eb°7 = F#°7 = A°7. Explore isso para rearmonia.",
      },
    ],
    progressions: [
      {
        label: "Passagem cromática",
        chords: ["C", "C#°", "Dm7", "G7"],
        context: "I → passagem dim → IIm7 → V7. Condução cromática elegante.",
      },
      {
        label: "Cadência dramática",
        chords: ["B°", "C7M"],
        context:
          "VII°→ I. A resolução mais tensa e dramática da harmonia tonal.",
      },
      {
        label: "Sequência gospel expressiva",
        chords: ["Bb7M", "Bb#°", "Cm7", "F7"],
        context: "I → passagem dim → IIm7 → V7 em Bb. Muito sofisticado.",
      },
    ],
  },
  {
    category: "Meio-Diminutos",
    icon: "🌑",
    summary:
      "O meio-diminuto ou m7(b5) é o acorde mais importante da harmonia menor. Indispensável na progressão IIm7b5-V7-Im, ele é a base do jazz e da harmonia clássica sofisticada.",
    contexts: [
      "IIm7(b5) na progressão menor: IIm7b5-V7-Im",
      "Jazz, bossa nova e MPB sofisticada",
      "Músicas em tonalidades menores",
      "Reharmonização de dominantes",
      "Progressões com muito movimento e cor harmônica",
    ],
    tips: [
      {
        title: "A progressão IIm7b5-V7-Im é essencial",
        description:
          "Em Dó menor: Dm7(b5) → G7 → Cm. Aprenda essa cadência em todas as tonalidades. Ela aparece em quase toda música sofisticada em tonalidade menor.",
      },
      {
        title: "Substitua o IIm7 pelo IIm7b5 em contextos menores",
        description:
          "Em progressões em tonalidade menor, use sempre o IIm7(b5), não o IIm7 natural. Isso mantém o caráter da escala menor melódica.",
      },
      {
        title: "Combine com dominante alterado",
        description:
          "Dm7(b5) → G7(b9) → Cm é ainda mais expressivo. O V7 com b9 complementa perfeitamente o meio-diminuto.",
      },
    ],
    progressions: [
      {
        label: "Cadência menor clássica",
        chords: ["Dm7(b5)", "G7", "Cm7"],
        context: "IIm7b5-V7-Im. A cadência menor mais sofisticada.",
      },
      {
        label: "Jazz menor",
        chords: ["Am7(b5)", "D7", "Gm7"],
        context: "IIm7b5-V7-Im em Sol menor. Base do jazz menor.",
      },
      {
        label: "Progressão gospel menor",
        chords: ["Bm7(b5)", "E7", "Am7", "D7M"],
        context: "IIm7b5-V7-Im7-IV7M. Som rico e modal.",
      },
    ],
  },
  {
    category: "Com 9ª",
    icon: "🌟",
    summary:
      "Acordes com nona são o atalho para a sofisticação imediata. Substituir qualquer acorde maior por sua versão add9 é a forma mais rápida de enriquecer uma progressão sem complicar.",
    contexts: [
      "Substituto direto de qualquer acorde maior",
      "I grau e IV grau com mais cor e suavidade",
      "Intros e finais elegantes",
      "Gospel contemporâneo e worship moderno",
      "Arranjos que precisam de sofisticação rápida",
    ],
    tips: [
      {
        title: "Substitua imediatamente",
        description:
          "Sempre que ver um C maior simples, toque Cadd9. Essa substituição instantânea melhora qualquer progressão básica sem precisar mudar mais nada.",
      },
      {
        title: "Add9 vs. Maj9",
        description:
          "O add9 (1-3-5-9) não tem a 7ª. O 7M(9) (1-3-5-7M-9) tem. O add9 é mais simples e mais fácil de aplicar. O 7M(9) é mais luxuoso.",
      },
      {
        title: "Use a 9ª na melodia da mão direita",
        description:
          "Enquanto a mão esquerda toca a base do acorde, adicione a nota da 9ª na melodia da mão direita. Isso cria texturas ricas e suaves.",
      },
    ],
    progressions: [
      {
        label: "Progressão 1-4 enriquecida",
        chords: ["Gadd9", "Dadd9"],
        context:
          "I-IV com add9. Imediatamente mais elegante que G e D simples.",
      },
      {
        label: "Gospel com add9",
        chords: ["Bbadd9", "Ebadd9", "Fadd9", "Bbadd9"],
        context: "I-IV-V-I em Bb com nonas. Muito suave e sofisticado.",
      },
      {
        label: "Loop contemporâneo",
        chords: ["Dadd9", "Aadd9", "Gsus2", "Aadd9"],
        context: "Progressão moderna e etérea. Muito usada em worship.",
      },
    ],
  },
  {
    category: "Com 7ªM e 9ª",
    icon: "💎",
    summary:
      "Os acordes com 7ªM e 9ª (7M(9)) são o pico da elegância harmônica. Combinam a suavidade da 7ª maior com a abertura da 9ª, criando texturas sonoras de beleza incomparável.",
    contexts: [
      "Momentos climáticos em adoração e ministração",
      "Intros e finais grandiosamente belos",
      "Jazz sofisticado e gospel de alto nível",
      "Quando se quer a máxima beleza harmônica",
      "Substituição luxuosa de qualquer acorde maior",
    ],
    tips: [
      {
        title: "Dois acordes 7M(9) criam progressões mágicas",
        description:
          "Ab7M(9) → Eb7M(9) ou F7M(9) → C7M(9) são progressões de dois acordes que criam atmosferas belíssimas. Menos é mais quando os acordes são ricos.",
      },
      {
        title: "Use voicings abertos para o 7M(9)",
        description:
          "Com 5 notas, o 7M(9) pode ficar denso. Omita a quinta (1-3-7M-9) para um voicing mais aberto e musical. Isso é o que os pianistas de jazz fazem.",
      },
      {
        title: "Maj9 como I e IV grau",
        description:
          "Na tonalidade de Dó: C7M(9) (I) e F7M(9) (IV) criam a base de uma harmonia extremamente refinada. Adicione um G7sus4 e você tem uma progressão de nível profissional.",
      },
    ],
    progressions: [
      {
        label: "Progressão ultra-elegante",
        chords: ["C7M(9)", "F7M(9)", "G7sus4", "C7M(9)"],
        context:
          "I7M(9)-IV7M(9)-V7sus4-I7M(9). Progressão de altíssimo nível harmônico.",
      },
      {
        label: "Dois acordes de adoração",
        chords: ["Ab7M(9)", "Eb7M(9)"],
        context:
          "I7M(9)-V/IV. Riqueza harmônica em apenas dois acordes. Eterno.",
      },
      {
        label: "Jazz gospel completo",
        chords: ["F7M(9)", "Em7", "Am7", "Dm7", "G7", "C7M(9)"],
        context: "Progressão jazz completa terminando em I7M(9) grandioso.",
      },
    ],
  },
  {
    category: "Com 6ª",
    icon: "🏆",
    summary:
      "Os acordes com 6ª — especialmente o 6/9 — são a resolução mais completa e bela da harmonia. Combinam a sexta com a nona para criar um som pleno, rico e definitivo. O acorde ideal para finais.",
    contexts: [
      "Finais de músicas (o I grau mais bonito possível)",
      "Resolução final após progressão sofisticada",
      "Momentos de plenitude e celebração",
      "Gospel de alto nível",
      "Substituição do I grau em contextos jazz",
    ],
    tips: [
      {
        title: "Use o 6/9 no final das músicas",
        description:
          "Em vez de terminar em C simples ou C7M, finalize em C6/9. Isso dá uma sensação de completude e beleza que o acorde simples não consegue.",
      },
      {
        title: "O 6/9 é estável — não tem sétima",
        description:
          "Diferente do 7M (que tem uma tensão suave), o 6/9 é perfeitamente estável. Isso o torna ideal para finais prolongados e texturas estáticas.",
      },
      {
        title: "Combine 6/9 com pedal na fundamental",
        description:
          "Toque a fundamental (C) no baixo com a mão esquerda e o 6/9 na mão direita (E-G-A-D). Isso cria um efeito grandioso muito usado no gospel.",
      },
    ],
    progressions: [
      {
        label: "Final gospel perfeito",
        chords: ["Bb7M", "Eb6/9", "F7sus4", "Bb6/9"],
        context: "Terminando em 6/9. A resolução mais bela que existe.",
      },
      {
        label: "Progressão com 6/9 no I e IV",
        chords: ["C6/9", "F6/9", "G7sus4", "C6/9"],
        context:
          "I6/9-IV6/9-V7sus4-I6/9. Tudo com máxima beleza e completude.",
      },
      {
        label: "Dois acordes ricos",
        chords: ["G6/9", "D6/9"],
        context:
          "Loop I6/9-V6/9. Som pleno e estático para momentos de adoração.",
      },
    ],
  },
  {
    category: "7sus4",
    icon: "🎸",
    summary:
      "O 7sus4 combina a tensão do sus4 com o movimento da 7ª menor. Som flutuante, groovado e muito expressivo. Essencial no gospel funk e nas cadências sofisticadas.",
    contexts: [
      "V7sus4 antes do I grau — cadência gospel moderna",
      "Momentos de groove e movimento em músicas animadas",
      "Antes de resoluções para 7M ou 6/9",
      "Gospel funk e R&B",
      "Substituição sofisticada do V7 simples",
    ],
    tips: [
      {
        title: "7sus4 → I7M é uma das cadências mais belas",
        description:
          "Em vez de G7→C, tente G7sus4→C7M(9). Esse movimento do 7sus4 para o 7M(9) é extremamente sofisticado e muito usado no gospel moderno.",
      },
      {
        title: "Adicione a 9ª ao 7sus4 para o 9sus4",
        description:
          "G9sus4 (G-C-D-F-A) é ainda mais rico. A 9ª acrescentada torna o acorde suspenso ainda mais pleno e expressivo.",
      },
      {
        title: "Use 7sus4 como dominante sem tensão",
        description:
          "O 7sus4 cria movimento cadencial sem a tensão do trítono do V7. Isso resulta em uma cadência mais suave e contemporânea, muito usada no worship.",
      },
    ],
    progressions: [
      {
        label: "Cadência gospel moderna",
        chords: ["F7sus4", "Bb7M"],
        context:
          "V7sus4-I7M. Progressão mais sofisticada que o V7-I simples.",
      },
      {
        label: "Progressão funk gospel",
        chords: ["Eb7sus4", "Ab7M", "Bb7sus4", "Eb7M"],
        context: "Alternando 7sus4 e 7M. Groove sofisticado em Eb.",
      },
      {
        label: "Resolução luxuosa",
        chords: ["G9sus4", "C7M(9)"],
        context: "9sus4 → 7M(9). O movimento cadencial mais elegante do gospel.",
      },
    ],
  },
  {
    category: "Mão Esquerda — Aberto",
    icon: "🖐️",
    summary:
      "O voicing aberto na mão esquerda toca apenas a fundamental e a quinta (em oitavas). Isso cria uma base profunda e deixa todo o espaço harmônico para a mão direita explorar.",
    contexts: [
      "Quando a mão direita toca acordes completos e ricos",
      "Músicas com arranjos densos e cheios",
      "Baixos profundos que não 'entopem' o som",
      "Estilo de piano gospel e R&B",
      "Criação de espaço para outros instrumentos da banda",
    ],
    tips: [
      {
        title: "A fundamental e a quinta criam base sólida sem bloquear harmonia",
        description:
          "Tocar C e G (oitava abaixo) na mão esquerda define o tom sem determinar se o acorde é maior, menor ou qualquer outro. A mão direita cuida disso.",
      },
      {
        title: "Combine com rootless voicings na mão direita",
        description:
          "Com a fundamental segura na ME, a MD pode tocar voicings sem fundamental (3ª-7ª-9ª-13ª), criando arranjos muito ricos e não redundantes.",
      },
      {
        title: "Perfeito para conjuntos com baixista",
        description:
          "Se a banda tem baixo elétrico, o voicing aberto evita conflito de frequências graves. Deixe o baixista segurar a fundamental e toque a quinta com a ME.",
      },
    ],
    progressions: [
      {
        label: "Base aberta + riqueza na MD",
        chords: ["C (aberto ME)", "F (aberto ME)"],
        context:
          "ME: C-G oitava. MD: E-G-B-D (C7M) → A-C-E-G (Fm7). Base profunda, harmonia rica.",
      },
      {
        label: "Gospel com baixo aberto",
        chords: ["Bb (aberto ME)", "Eb (aberto ME)", "F (aberto ME)"],
        context: "I-IV-V em Bb com voicings abertos. Som gospel clássico.",
      },
    ],
  },
  {
    category: "Mão Esquerda — Fechado",
    icon: "✊",
    summary:
      "O voicing fechado na mão esquerda toca a tríade completa (1-3-5) em posição fechada. Harmonicamente completo por si só, permite que a mão direita foque na melodia.",
    contexts: [
      "Quando a mão direita toca melodia simples",
      "Solos acompanhados onde a ME sustenta toda a harmonia",
      "Músicas simples onde se quer clareza harmônica",
      "Aprendizado de inversões de tríades",
      "Acompanhamento de cantores ou instrumentistas",
    ],
    tips: [
      {
        title: "Pratique nas três inversões",
        description:
          "Posição fundamental (C-E-G), 1ª inversão (E-G-C) e 2ª inversão (G-C-E). Cada uma tem um caráter diferente — a inversão determina o peso e a cor do acorde.",
      },
      {
        title: "A 2ª inversão tem caráter de dominante",
        description:
          "C na 2ª inversão (G-C-E) tem peso de instabilidade. Use isso a seu favor para criar tensão antes de uma resolução.",
      },
      {
        title: "Conecte inversões para movimentação linear",
        description:
          "Mova de C (C-E-G) para F na 2ª inversão (C-F-A) mantendo o C comum. Isso cria conexão suave e profissional entre os acordes.",
      },
    ],
    progressions: [
      {
        label: "Inversões em progressão",
        chords: ["C (fund.)", "F (2ª inv.)", "G (1ª inv.)", "C"],
        context:
          "Usando inversões para criar condução linear. ME sofisticada.",
      },
      {
        label: "Acompanhamento ME fechado",
        chords: ["G (fechado)", "Em (fechado)", "C (fechado)", "D (fechado)"],
        context:
          "I-VIm-IV-V com ME fechada. A MD canta a melodia livremente.",
      },
    ],
  },
  {
    category: "Mão Esquerda — Misto",
    icon: "🤲",
    summary:
      "O voicing misto usa tônica, quinta e tônica oitavada (1-5-8) na região grave. A fundamental fica grave, a quinta no meio e a tônica repetida uma oitava acima, criando uma base ampla, firme e estável.",
    contexts: [
      "Acompanhamentos sofisticados onde se quer profundidade + estabilidade",
      "Piano solo onde não há baixista",
      "Músicas de nível intermediário a avançado",
      "Gospel e adoração com piano como instrumento principal",
      "O voicing mais musical e completo da mão esquerda",
    ],
    tips: [
      {
        title: "Posição: 1 → 5 → 8 (tônica oitavada)",
        description:
          "Ex.: C no grave, G no meio, C mais acima. Sem a terça, o voicing fica aberto e estável — a cor do acorde fica por conta da mão direita.",
      },
      {
        title: "É o voicing padrão do pianista de gospel",
        description:
          "A maioria dos pianistas de gospel profissionais usa alguma variação do voicing misto. Ele soa completo sem ser denso, com profundidade sem ser pesado.",
      },
      {
        title: "Adicione a 7ª ao voicing misto",
        description:
          "Com a ME fazendo 1-5-8, troque a tônica de cima pela 7M. O resultado é um voicing profundo e sofisticadíssimo, muito usado no gospel.",
      },
    ],
    progressions: [
      {
        label: "Voicing misto gospel",
        chords: ["Bb (misto)", "Eb (misto)", "F (misto)", "Bb (misto)"],
        context:
          "I-IV-V-I em Bb com voicing misto. Soa como pianista profissional.",
      },
      {
        label: "Progressão completa misto + 7ªM",
        chords: ["C7M (misto)", "F7M (misto)", "G7sus4", "C6/9"],
        context:
          "ME mista + 7M + resolução em 6/9. Arranjo completo de alto nível.",
      },
    ],
  },
];
