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

**Atualização jul/2026 (tom unissex, aprovado após rejeição do lilás rosado):**
- Usuário rejeitou o lilás #D97AFF como acento global ("muito rosa, muito feminino"). O acento deve puxar para o lado AZUL-violeta, nunca para o magenta/rosa.
- `--primary` = violeta-azulado **#9673FF** (hsl 252 100% 70%, escurecido a pedido do usuário); pressed hsl(252 90% 60%). Bordas/rings/realces em fundo escuro: #8B5CF6 com opacidade — não usar #C24BF7 sólido como acento.
- #C24BF7 (magenta) só aparece dentro dos gradientes da marca: `.bg-gradient-cta`/CTAs (2 tons #C24BF7 → #4B45E8) e `.bg-gradient-kordi`/`.text-gradient-kordi` (3-stop da logo, exceção intencional).
- Nunca usar `text-primary` claro sobre superfícies de papel claro (contraste baixo); nelas usar o violeta escuro #7C3AED (padrão do Sofisticador/Favoritos).
- Degradê de texto aprovado (jul/2026): `.text-gradient-primary` = #9673FF → #5570FF (violeta→azul, ecoa a logo); aplicado na palavra-chave dos H1 de cada módulo e no destaque do hero. Usuário associa o tom azul a "mais profissional".
