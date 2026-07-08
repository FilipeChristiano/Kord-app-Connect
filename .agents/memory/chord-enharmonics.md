---
name: Enarmonia no dicionário de acordes
description: Ids do dicionário são bemóis legados, names exibem "sustenido/bemol"; popups devem exibir o token clicado e espelhar as imagens do dicionário.
---

O dicionário de acordes (CHORDS) tem UMA entrada por acorde de tecla preta, com ids em bemol legado ("Db7M", "Db9M"...), mas o `name` exibe as DUAS grafias no padrão "sustenido/bemol" (ex.: "C#7M/Db7M"). `chordIdForToken` mapeia C# e Db para o mesmo id. Nunca renomear ids, só `name`, senão quebram rotas, favoritos e o mapa de imagens do PDF. A busca por raiz casa a raiz no início do nome ou após "/" (cuidado com nomes tipo "C#6/9/Db6/9").

O popup das cifras deve espelhar EXATAMENTE o dicionário: imagens reais do PDF (getChordVariationImages/getChordOverviewImage) ou SVG só para tríades (CHORD_SVG_OVERRIDES) — nunca voicings computados ("variações inventadas").

**Regra:** qualquer UI que abra a formação de um acorde a partir de um token da cifra (popup, etc.) deve exibir o token como escrito na cifra, não `chord.name` do dicionário. O `ChordPopup` aceita a prop `label` para isso e respela as notas em sustenidos quando o label começa com `#`.

**Why:** usuário clicou em C#7M(9) e viu "Db9M" — achou que o app abriu um acorde errado e "inventou" variações.

**How to apply:** ao criar novos pontos de clique em acordes (ex.: Audio Lab, novas páginas), sempre repassar o token clicado como `label` ao ChordPopup.
