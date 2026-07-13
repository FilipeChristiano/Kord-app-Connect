---
name: Landing demo assets (áudio real)
description: Como os áudios da demo do HeroShowcase (/assinar) foram gerados via o pipeline real do app; como regenerar.
---

Os arquivos em `artifacts/acordes/public/landing-audio/` vêm do fluxo REAL do app, nunca de material sintético:
- `audiolab-demo.mp3` (15s): "Santo Pra Sempre — Gabriel Guedes" (tom Db, BPM ~95.7), refrão a partir de ~169.97s dos stems Demucs. Envelope baked: 0–6s voz+instrumental+click (batidas reais), 6–10.5s só voz, 10.5–15s só instrumental (rampas de 0.5s). As fases visuais da cena (MESA_FASES) devem espelhar esses tempos.
- `metronomo-jo.mp3` (8.5s): "Jó — Midian Lima", arquivo original enviado pelo dono (attached_assets), BPM 66.3 detectado pelo `detect_beats.py` real; trecho a partir de 255.3s (janela mais forte); click só após t=2.3s (quando a cena "trava" o BPM); primeiro click em ~2.715s → bolinhas iniciam 415ms após o lock.

**Como regenerar** (mesmo fluxo do app):
1. `POST /api/cifra` `{query, pick}` → cifra real + `youtubeId`; `POST /api/stems/prepare-yt` → Demucs (~6 min) → stems em `/tmp/harmonic-stems/yt_<id>/`.
2. Batidas: `detect_beats.py` (com `NUMBA_CACHE_DIR` gravável) sobre wav mono 22k; click sintetizado (triangular, acento no 1) nesses instantes.
3. Trechos escolhidos por maior energia (volumedetect em janelas de 5s); mixagem/envelopes via script Python + loudnorm I=-15.
4. Sofisticador: `processChordChart` de `data/substitutions.ts` sobre o refrão real gera os pares mostrados na cena (F9→F7M(9) etc.).

**Why:** o dono exige que a demo da landing use exatamente o que o app gera — nunca inventar áudio/cifra.
**How to apply:** qualquer mudança de música/trecho na demo deve repetir esse fluxo e atualizar BPM/tom/acordes/tempos das cenas do HeroShowcase em sincronia com os arquivos.
**Atenção:** trechos de gravações reais hospedados publicamente na landing — direitos autorais são responsabilidade do dono; já sinalizado a ele.
