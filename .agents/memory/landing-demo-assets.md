---
name: Landing demo assets (áudio real)
description: Como os áudios da demo do HeroShowcase (/assinar) foram gerados via o pipeline real do app; como regenerar.
---

Os arquivos em `artifacts/acordes/public/landing-audio/` vêm do fluxo REAL do app, nunca de material sintético:
- `audiolab-demo.mp3` (15s): "Santo Pra Sempre — Gabriel Guedes" (tom Db, BPM ~95.7), refrão a partir de ~169.97s dos stems Demucs. Envelope baked: 0–6s voz+instrumental+click (batidas reais), 6–10.5s só voz, 10.5–15s só instrumental (rampas de 0.5s). As fases visuais da cena (MESA_FASES) devem espelhar esses tempos.
- `metronomo-jo.mp3` (8.5s): "Jó — Midian Lima", MESMO áudio que o app usa na busca por título (YouTube ijNCc7ICCck, 5:10 — NÃO o mp3 do attached_assets, que é outra gravação e dá 132!). BPM 144 = detector do NAVEGADOR (`analyzeBpm` em `src/lib/bpm-detector.ts`), o mesmo que a mesa exibe; grade real: anchor=223.6546+0.2664s, período 60/144, clipe começa em 221.226s; clicks (triangular, acento a cada 4, −20ms) a partir de 2.695s do clipe → bolinhas iniciam 395ms após o lock (2.3s). O `detect_beats.py` do servidor deu 95.7 nesse arquivo — o número da mesa vem do navegador, não do servidor.

**Como regenerar** (mesmo fluxo do app):
1. `POST /api/cifra` `{query, pick}` → cifra real + `youtubeId`; `POST /api/stems/prepare-yt` → Demucs (~6 min) → stems em `/tmp/harmonic-stems/yt_<id>/`.
2. Batidas: `detect_beats.py` (com `NUMBA_CACHE_DIR` gravável) sobre wav mono 22k; click sintetizado (triangular, acento no 1) nesses instantes.
3. Trechos escolhidos por maior energia (volumedetect em janelas de 5s); mixagem/envelopes via script Python + loudnorm I=-15.
4. Sofisticador: `processChordChart` de `data/substitutions.ts` (nível intermediário) sobre o trecho real "As muitas gerações…"/"Cantando ao cordeiro…" gera os pares da cena: C→C7M(9), C4 fica C4 (não reconhecido como acorde), Am7→Am7(9), G→G7sus4, F9→F7M(9).

**Why:** o dono exige que a demo da landing use exatamente o que o app gera — nunca inventar áudio/cifra.
**How to apply:** qualquer mudança de música/trecho na demo deve repetir esse fluxo e atualizar BPM/tom/acordes/tempos das cenas do HeroShowcase em sincronia com os arquivos. BPM mostrado nas cenas deve vir do detector do NAVEGADOR sobre o áudio exato que o app usaria (cache em `/tmp/harmonic-yt-audio/`). Obs: yt-dlp no dev está bloqueado pelo YouTube (bot check); reutilizar o cache.
**Atenção:** trechos de gravações reais hospedados publicamente na landing — direitos autorais são responsabilidade do dono; já sinalizado a ele.
