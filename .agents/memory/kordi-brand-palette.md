---
name: Kordi brand palette (violet)
description: Current brand colors after the July 2026 logo swap; which oranges are semantic and must NOT be migrated.
---

# Kordi brand palette

Em julho/2026 o usuário trocou a logo laranja pela versão violeta. A marca agora é o gradiente **#C24BF7 (magenta-violeta) → #8B5CF6 → #4B45E8 (índigo)**. Tokens `--primary*` = violeta; tokens `--brand-purple-*` = índigo (#4B45E8), não mais #7C3AED.

**Why:** logo oficial fornecida pelo usuário (attached_assets/Logo_2_-_Kordi_*.png); toda a UI deve combinar com ela.

**How to apply:**
- Botões/CTAs/acentos de marca: tokens primary ou `.bg-gradient-cta`/`.bg-gradient-kordi` — nunca hex laranja.
- Laranja/âmbar restante é **semântico e intencional** (avisos no bpm-detector; escalas de dificuldade verde→laranja→vermelho em favorites, pad-continuous, chord-substitutor; estabilidade verde/amarelo/laranja). NÃO fazer bulk-replace nessas ocorrências.
- Mão direita do piano = roxo (#a855f7/#9333ea) em PianoKeyboard e chord-detail.
- Assets (logo.svg, wordmark.svg, favicon, ícones PWA, logo.png do rodapé) são PNGs base64 embutidos em SVG, extraídos da logo V3 (attached_assets/Logo_Kordi_V3_*.png) com sharp (crop por bounding-box + trim) + remoção de fundo; ícones compostos sobre #080B12. Wordmark V3 = "KORDI" caps branco com pontos violeta (O e i).
- Tipografia (jul/2026, 2ª iteração): usuário achou Quicksand/Outfit "amigáveis demais" — quer receptivo porém profissional. Agora `--font-display`/`--font-brand` = **Sora**, `--font-sans` = **Inter**. Sora/Inter carregadas só até weight 700 — não usar font-extrabold. Inter é mais larga: navbar precisa de whitespace-nowrap (já aplicado).

**Atualização jul/2026 (2 tons de roxo, aprovado pelo usuário):**
- `--primary` agora é o lilás luminoso **#D97AFF** (acentos/texto sobre fundo escuro); pressed = #C24BF7; CTAs sólidos usam `.bg-gradient-cta`/gradiente **#C24BF7 → #4B45E8** (2 tons, sem stop intermediário).
- Exceção intencional: `.bg-gradient-kordi`/`.text-gradient-kordi` mantêm o 3-stop com #8B5CF6 no meio porque espelham o gradiente da logo — não "consolidar" para 2 tons.
- Nunca usar `text-primary` (#D97AFF) sobre superfícies de papel claro (contraste ~2.5:1); nelas usar o violeta escuro #7C3AED (padrão do Sofisticador/Favoritos).
