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
- Assets (logo.svg, wordmark.svg, favicon, ícones PWA) são PNGs base64 embutidos em SVG, extraídos da folha de marca com sharp + remoção de fundo; recompor sobre #080B12 se regenerar.
