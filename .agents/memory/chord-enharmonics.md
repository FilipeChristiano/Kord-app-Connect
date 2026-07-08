---
name: Enarmonia no dicionário de acordes
description: O dicionário guarda só uma grafia enarmônica por acorde; UIs devem exibir o token clicado, não o nome do dicionário.
---

O dicionário de acordes (CHORDS) guarda apenas UMA grafia enarmônica de cada acorde — em geral com bemóis. `chordIdForToken` mapeia C# e Db para o mesmo id. Atenção: ids legados podem diferir do nome exibido (ex.: id "Db9M" exibe "Db7M(9)") — nunca renomear ids, só `name`, senão quebram rotas, favoritos e o mapa de imagens do PDF.

O popup das cifras deve espelhar EXATAMENTE o dicionário: imagens reais do PDF (getChordVariationImages/getChordOverviewImage) ou SVG só para tríades (CHORD_SVG_OVERRIDES) — nunca voicings computados ("variações inventadas").

**Regra:** qualquer UI que abra a formação de um acorde a partir de um token da cifra (popup, etc.) deve exibir o token como escrito na cifra, não `chord.name` do dicionário. O `ChordPopup` aceita a prop `label` para isso e respela as notas em sustenidos quando o label começa com `#`.

**Why:** usuário clicou em C#7M(9) e viu "Db9M" — achou que o app abriu um acorde errado e "inventou" variações.

**How to apply:** ao criar novos pontos de clique em acordes (ex.: Audio Lab, novas páginas), sempre repassar o token clicado como `label` ao ChordPopup.
